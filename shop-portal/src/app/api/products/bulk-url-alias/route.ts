import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/products/bulk-url-alias
 * Bulk generate and update URL aliases for multiple products
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const { productIds } = body

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Termék ID-k megadása kötelező' },
        { status: 400 }
      )
    }

    // Limit to 200 products at a time
    if (productIds.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Maximum 200 termék optimalizálható egyszerre' },
        { status: 400 }
      )
    }

    // Get all products with their data
    const { data: products, error: productsError } = await supabase
      .from('shoprenter_products')
      .select(`
        id,
        connection_id,
        sku,
        model_number,
        name,
        url_slug,
        url_alias_id,
        shoprenter_id,
        shoprenter_product_descriptions (
          name,
          language_code
        )
      `)
      .in('id', productIds)

    if (productsError || !products || products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Termékek nem találhatók' },
        { status: 404 }
      )
    }

    // Filter out products without required data
    const validProducts = products.filter(p => 
      p.connection_id && 
      p.shoprenter_id && 
      p.name // At least need a name to generate slug
    )

    if (validProducts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nincs érvényes termék az optimalizáláshoz (hiányzó connection_id, shoprenter_id vagy név)' },
        { status: 400 }
      )
    }

    const results: Array<{
      productId: string
      success: boolean
      suggestedSlug?: string
      currentSlug?: string
      modelNumber?: string | null
      sku?: string
      error?: string
    }> = []

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    // Process products in batches of 10
    const BATCH_SIZE = 10
    for (let i = 0; i < validProducts.length; i += BATCH_SIZE) {
      const batch = validProducts.slice(i, i + BATCH_SIZE)
      
      // Generate slugs for batch
      const batchPromises = batch.map(async (product) => {
        try {
          const huDescription = (product.shoprenter_product_descriptions || []).find(
            (d: any) => d.language_code === 'hu'
          ) || { name: product.name || '' }

          const productName = huDescription.name || product.name || product.sku
          const modelNumber = product.model_number || ''
          const currentSlug = product.url_slug || ''

          const prompt = `Generate an SEO-optimized URL slug for this Hungarian e-commerce product:

Product Name: ${productName}
Manufacturer Part Number: ${modelNumber || '(nincs)'}
Current URL Slug: ${currentSlug || '(nincs)'}

Requirements:
- Hungarian language, convert accents to ASCII (á→a, é→e, í→i, ó→o, ö→o, ő→o, ú→u, ü→u, ű→u)
- Maximum 60 characters
- Use hyphens (-) between words
- Include primary keyword from product name
- Include model number if it's unique and short
- No stop words (a, az, és, vagy, van, volt, lesz)
- Lowercase only
- No special characters except hyphens

Return ONLY the slug, nothing else.`

          const message = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 100,
            messages: [{ role: 'user', content: prompt }]
          })

          const generatedSlug = message.content[0].type === 'text' 
            ? message.content[0].text.trim()
            : ''

          if (!generatedSlug) {
            return {
              productId: product.id,
              success: false,
              error: 'AI nem tudott slug-ot generálni',
              currentSlug: product.url_slug || null,
              modelNumber: product.model_number || null,
              sku: product.sku || null
            }
          }

          // Sanitize
          const sanitizedSlug = generatedSlug
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 60)

          // Skip if slug is same as current (no change needed)
          if (sanitizedSlug === currentSlug) {
            return {
              productId: product.id,
              success: false,
              error: 'Az új URL megegyezik a jelenlegivel',
              currentSlug: product.url_slug || null,
              modelNumber: product.model_number || null,
              sku: product.sku || null
            }
          }

          // Validate slug is not empty
          if (!sanitizedSlug || sanitizedSlug.length === 0) {
            return {
              productId: product.id,
              success: false,
              error: 'Generált URL üres',
              currentSlug: product.url_slug || null,
              modelNumber: product.model_number || null,
              sku: product.sku || null
            }
          }

          return {
            productId: product.id,
            success: true,
            suggestedSlug: sanitizedSlug,
            currentSlug: product.url_slug || null,
            modelNumber: product.model_number || null,
            sku: product.sku || null
          }
        } catch (error: any) {
          console.error(`Error generating slug for product ${product.id}:`, error)
          return {
            productId: product.id,
            success: false,
            error: error.message || 'Hiba történt',
            currentSlug: product.url_slug || null,
            modelNumber: product.model_number || null,
            sku: product.sku || null
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < products.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    return NextResponse.json({
      success: true,
      results,
      stats: {
        total: results.length,
        successful: successful.length,
        failed: failed.length
      }
    })
  } catch (error: any) {
    console.error('Error in bulk URL alias generation:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Hiba történt' },
      { status: 500 }
    )
  }
}
