import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { trackAIUsage } from '@/lib/ai-usage-tracker'

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
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get product with descriptions
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        id,
        sku,
        model_number,
        name,
        url_slug,
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

    const brand = product.brand || ''
    
    const prompt = `Generate an SEO-optimized URL slug for this Hungarian e-commerce product:

Product Name: ${productName}
Brand: ${brand || '(nincs)'}
Manufacturer Part Number: ${modelNumber || '(nincs)'}
Category: ${categoryName || '(nincs)'}
Top Search Keywords: ${topKeywords || '(nincs)'}
Current URL Slug: ${currentSlug || '(nincs)'}

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

    // Call Claude AI
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        { role: 'user', content: prompt }
      ]
    })

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
    const sanitizedSlug = generatedSlug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60) // Enforce max length

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
