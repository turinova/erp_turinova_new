import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import Anthropic from '@anthropic-ai/sdk'
import { trackAIUsage } from '@/lib/ai-usage-tracker'
import { checkCreditsForAIFeature } from '@/lib/credit-checker'
import {
  isChildVariant,
  slugTokensFromAttributes,
  variantDifferentiatorFromAttributes
} from '@/lib/product-variant-helpers'

function parseProductAttributes(raw: unknown): any[] | null {
  if (raw == null) return null
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return Array.isArray(p) ? p : null
    } catch {
      return null
    }
  }
  return null
}

/** Ensure slug is unique among other products (same tenant). */
async function resolveUniqueSlug(
  supabase: { from: (t: string) => any },
  productId: string,
  baseSlug: string
): Promise<string> {
  const clean = baseSlug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60)

  let candidate = clean
  for (let n = 0; n < 40; n++) {
    const { data: rows, error } = await supabase
      .from('shoprenter_products')
      .select('id')
      .eq('url_slug', candidate)
      .neq('id', productId)
      .limit(1)

    if (error) {
      console.warn('[URL SLUG] uniqueness check failed:', error)
      return candidate
    }
    if (!rows || rows.length === 0) {
      return candidate
    }
    const suffix = n === 0 ? '-2' : `-${n + 2}`
    const maxStem = 60 - suffix.length
    candidate = (clean.slice(0, Math.max(1, maxStem)) + suffix)
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60)
  }
  return `${clean.slice(0, 40)}-${productId.slice(0, 8)}`.substring(0, 60)
}

/**
 * POST /api/products/[id]/url-alias/generate
 * Generate SEO-optimized URL slug using AI
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check credits before generation
    const creditCheck = await checkCreditsForAIFeature(user.id, 'url_slug')
    if (!creditCheck.hasEnough) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient credits',
        credits: {
          available: creditCheck.available,
          required: creditCheck.required,
          limit: creditCheck.limit,
          used: creditCheck.used
        }
      }, { status: 402 }) // 402 Payment Required
    }

    // Get product with descriptions and manufacturer
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        id,
        sku,
        model_number,
        name,
        url_slug,
        parent_product_id,
        product_attributes,
        erp_manufacturer_id,
        manufacturers (
          name
        ),
        shoprenter_product_descriptions (
          name,
          language_code
        )
      `)
      .eq('id', id)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { success: false, error: 'Termék nem található' },
        { status: 404 }
      )
    }

    // Get Hungarian description
    const huDescription = (product.shoprenter_product_descriptions || []).find(
      (d: any) => d.language_code === 'hu'
    ) || { name: product.name || '' }

    // Get category name (if available)
    const { data: categoryData } = await supabase
      .from('shoprenter_product_category_relations')
      .select(`
        shoprenter_categories (
          shoprenter_category_descriptions (
            name,
            language_code
          )
        )
      `)
      .eq('product_id', id)
      .limit(1)
      .single()

    let categoryName = ''
    if (categoryData?.shoprenter_categories?.shoprenter_category_descriptions) {
      const catDesc = categoryData.shoprenter_categories.shoprenter_category_descriptions.find(
        (d: any) => d.language_code === 'hu'
      )
      categoryName = catDesc?.name || ''
    }

    // Get top search queries from Search Console (if available)
    const { data: searchQueries } = await supabase
      .from('product_search_queries')
      .select('query, impressions, clicks')
      .eq('product_id', id)
      .order('impressions', { ascending: false })
      .limit(5)

    const topKeywords = searchQueries?.map((q: any) => q.query).join(', ') || ''

    // Prepare AI prompt
    const productName = huDescription.name || product.name || product.sku
    const modelNumber = product.model_number || ''
    const currentSlug = product.url_slug || ''

    const brand = (product.manufacturers as any)?.name || ''
    const attrs = parseProductAttributes(product.product_attributes)
    const variantToken = slugTokensFromAttributes(attrs, 28)
    const variantHint = variantDifferentiatorFromAttributes(attrs, 4)
    const childVariant = isChildVariant(product.parent_product_id, product.id)

    const prompt = `Generate an SEO-optimized URL slug for this Hungarian e-commerce product:

Product Name: ${productName}
Brand: ${brand || '(nincs)'}
Manufacturer Part Number: ${modelNumber || '(nincs)'}
Category: ${categoryName || '(nincs)'}
Top Search Keywords: ${topKeywords || '(nincs)'}
Current URL Slug: ${currentSlug || '(nincs)'}
${childVariant ? `This is a VARIANT / child product (separate indexed URL). Variant attributes: ${variantHint || '(nincs)'}
**CRITICAL**: The slug MUST include a discriminating token (size, color, or short model) so it is NOT identical to sibling product URLs. Suggested token to weave in: ${variantToken || '(derive from name/SKU)'}
` : `This is a parent or standalone product. Slug should be family-focused; do not invent variant-specific tokens unless the name contains them.
`}

Requirements:
- Hungarian language, convert accents to ASCII (á→a, é→e, í→i, ó→o, ö→o, ő→o, ú→u, ü→u, ű→u)
- Maximum 60 characters
- Use hyphens (-) between words
- Include primary keyword from product name
- Include brand if it's well-known and short (e.g., "blum", "hafele") - place at beginning if space allows
- Include model number if it's unique and short
- No stop words (a, az, és, vagy, van, volt, lesz)
- Lowercase only
- No special characters except hyphens
- Make it readable and SEO-friendly
- Brand format: "brand-product-name" (e.g., "blum-clip-top") if brand is well-known

Return ONLY the slug, nothing else. Example: "blum-clip-top-blumotion-pant-110-fok-egyenes" or "hafele-csuklo-110-fok"`

    // Call Claude AI with retry logic for 529 (overloaded) errors
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    let message: any = null
    let lastError: any = null
    const maxRetries = 5
    const baseDelayMs = 1000

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        { role: 'user', content: prompt }
      ]
    })
        break // Success, exit retry loop
      } catch (error: any) {
        lastError = error
        
        // Check if it's an overloaded error or rate limit
        const isRetryable = 
          error?.message?.includes('overloaded') ||
          error?.message?.includes('Overloaded') ||
          error?.status === 529 ||
          error?.status === 429 ||
          error?.error?.type === 'overloaded_error'
        
        if (!isRetryable || attempt === maxRetries - 1) {
          // Not retryable or last attempt - throw error
          console.error('[URL SLUG GENERATION] API error:', error)
          throw new Error(`Failed to generate URL slug: ${error?.message || 'Unknown error'}`)
        }
        
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = baseDelayMs * Math.pow(2, attempt)
        console.log(`[URL SLUG GENERATION] API overloaded (529), retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'AI nem tudott URL slug-ot generálni (túlterhelt szolgáltatás)' },
        { status: 503 } // Service Unavailable
      )
    }

    const generatedSlug = message.content[0].type === 'text' 
      ? message.content[0].text.trim()
      : ''

    if (!generatedSlug) {
      return NextResponse.json(
        { success: false, error: 'AI nem tudott URL slug-ot generálni' },
        { status: 500 }
      )
    }

    // Sanitize the generated slug
    let sanitizedSlug = generatedSlug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60) // Enforce max length

    sanitizedSlug = await resolveUniqueSlug(supabase, id, sanitizedSlug)

    // Track AI usage
    const estimatedTokens = message.usage?.input_tokens && message.usage?.output_tokens
      ? message.usage.input_tokens + message.usage.output_tokens
      : 100 // Fallback estimate

    await trackAIUsage({
      userId: user.id,
      featureType: 'url_slug',
      tokensUsed: estimatedTokens,
      modelUsed: 'claude-haiku-4-5-20251001',
      productId: id,
      creditsUsed: 1,
      creditType: 'ai_generation',
      metadata: { generated: true }
    })

    return NextResponse.json({
      success: true,
      data: {
        suggestedSlug: sanitizedSlug,
        currentSlug: currentSlug || '',
        previewUrl: sanitizedSlug ? `https://turinovakft.hu/${sanitizedSlug}` : null
      }
    })
  } catch (error: any) {
    console.error('Error generating URL alias:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Hiba történt az AI generálás során' },
      { status: 500 }
    )
  }
}
