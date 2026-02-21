import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

// Use the same Anthropic client creation as product generation
function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables')
  }
  
  return new Anthropic({
    apiKey: apiKey,
    baseURL: 'https://api.anthropic.com',
    defaultHeaders: {
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }
  })
}

/**
 * POST /api/categories/[id]/generate-meta
 * Generate category name, meta title, and meta description using AI
 * Uses the same rules and logic as product meta generation
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
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const body = await request.json().catch(() => ({}))
    const { fields = ['name', 'meta_title', 'meta_description'] } = body

    // Get category data
    const { data: category, error: categoryError } = await supabase
      .from('shoprenter_categories')
      .select(`
        *,
        shoprenter_category_descriptions(*)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (categoryError || !category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Get products in category for context (same as description generation)
    const { data: relations } = await supabase
      .from('shoprenter_product_category_relations')
      .select(`
        shoprenter_products(
          id,
          sku,
          name,
          status,
          price,
          product_attributes,
          shoprenter_product_descriptions(name, description, short_description)
        )
      `)
      .eq('category_id', id)
      .is('deleted_at', null)
      .is('shoprenter_products.deleted_at', null)
      .limit(20)

    const products = (relations || [])
      .map(rel => rel.shoprenter_products)
      .filter(Boolean)
      .filter((p: any) => p.status === 1)

    // Get current description
    const currentDescription = category.shoprenter_category_descriptions?.find(
      (desc: any) => desc.language_id === 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian
    ) || category.shoprenter_category_descriptions?.[0]

    const categoryName = currentDescription?.name || category.name || 'Kategória'
    const categoryDescription = currentDescription?.description || ''

    // Build comprehensive product context (same as description generation)
    let productContext = ''
    if (products.length > 0) {
      productContext = `\n\n=== TERMÉKEK EBBEN A KATEGÓRIÁBAN (${products.length} termék) ===\n`
      products.slice(0, 10).forEach((product: any, idx: number) => {
        const name = product.name || product.shoprenter_product_descriptions?.[0]?.name || product.sku
        const sku = product.sku || ''
        const attrs = product.product_attributes || []
        
        const keyAttrs = attrs
          .filter((attr: any) => attr.display_name && attr.value)
          .map((attr: any) => {
            const value = Array.isArray(attr.value) 
              ? attr.value.map((v: any) => typeof v === 'object' && v.value ? v.value : v).join(', ')
              : attr.value
            return `${attr.display_name}: ${value}`
          })
          .slice(0, 3)
        
        productContext += `Termék ${idx + 1}: ${name} (SKU: ${sku})\n`
        if (keyAttrs.length > 0) {
          productContext += `   Főbb jellemzők: ${keyAttrs.join('; ')}\n`
        }
        productContext += `\n`
      })
    }

    // Initialize Anthropic client (same as product generation)
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
    }

    const anthropic = getAnthropicClient()
    const modelsToTry = [
      'claude-sonnet-4-6',
      'claude-opus-4-6',
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-5-20250929',
      'claude-sonnet-4-20250514'
    ]

    const results: any = {}

    // Generate name (similar to product name generation)
    if (fields.includes('name')) {
      const systemPrompt = `You are an expert SEO copywriter creating optimized category names for e-commerce in Hungarian.

CRITICAL REQUIREMENTS:
1. **Language**: Write EXCLUSIVELY in Hungarian
2. **Length**: Keep it concise (2-5 words, max 8 words)
3. **SEO-friendly**: Use relevant keywords naturally
4. **Clear**: Must clearly describe what products are in this category
5. **Appealing**: Make it attractive and professional

Return ONLY the category name, nothing else. No quotes, no explanations.`

      const userPrompt = `Generate an optimized category name for: ${categoryName}

${productContext}
${categoryDescription ? `Current category description (for context): ${categoryDescription.substring(0, 300)}...` : ''}

Generate a better, SEO-optimized category name in Hungarian based on the products in this category.`

      let nameGenerated = false
      for (const model of modelsToTry) {
        try {
          const message = await anthropic.messages.create({
            model: model,
            max_tokens: 50,
            temperature: 0.7,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
          })
          let generatedName = message.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('')
            .trim()
          
          // Clean up
          generatedName = generatedName.replace(/^["']|["']$/g, '').trim()
          
          if (generatedName && generatedName.length > 0) {
            results.name = generatedName
            nameGenerated = true
            break
          }
        } catch (error: any) {
          if (error.status === 404) continue
          if (error.status === 401 || error.status === 429) throw error
        }
      }
      if (!nameGenerated) {
        results.name = categoryName // Fallback to current name
      }
    }

    // Generate meta title (same rules as product meta title)
    if (fields.includes('meta_title')) {
      const systemPrompt = `You are an expert SEO copywriter creating high-ranking meta titles for e-commerce categories in Hungarian.

CRITICAL REQUIREMENTS:
1. **Length**: MUST be between 50-60 characters (optimal for Google). Maximum 70 characters.
2. **Language**: Write EXCLUSIVELY in Hungarian
3. **Keyword placement**: Primary keyword should be near the beginning
4. **Dynamic tags**: You MUST include ShopRenter dynamic tags where appropriate:
   - [CATEGORY] - Category name (use this for the main category name)
   - [PRODUCT] - Can be used if mentioning specific products
5. **Action words**: Use compelling action words when space allows
6. **No special characters**: Avoid characters that might break display (except the dynamic tags)
7. **Unique**: Must be unique and specific to this category

SEO BEST PRACTICES:
- Start with the most important keyword
- Include [CATEGORY] tag for the category name
- Add value proposition if space allows
- Use natural Hungarian language
- Avoid keyword stuffing
- Make it click-worthy but accurate

DYNAMIC TAG USAGE:
- Always include [CATEGORY] for the category name
- The tags will be replaced by ShopRenter with actual values, so write around them naturally

Return ONLY the meta title text with dynamic tags, nothing else. No quotes, no explanations.`

      const userPrompt = `Generate a high-ranking meta title for this category:

Category Name: ${categoryName}
${productContext}
${categoryDescription ? `Category Description (for context): ${categoryDescription.substring(0, 500)}` : ''}

Generate a meta title that:
- Is 50-60 characters (optimal) - COUNT THE CHARACTERS INCLUDING THE DYNAMIC TAGS
- Contains the primary keyword
- Includes [CATEGORY] tag for the category name
- Is compelling and click-worthy
- Is in Hungarian
- Follows SEO best practices

Example format: "[CATEGORY] - Minőségi szekrény kellékek | Széles választék" or "[CATEGORY] - Versenyképes áron | Gyors szállítás"`

      let titleGenerated = false
      for (const model of modelsToTry) {
        try {
          const message = await anthropic.messages.create({
            model: model,
            max_tokens: 100,
            temperature: 0.7,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
          })
          let metaTitle = message.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('')
            .trim()
          
          // Clean up and validate (same as product generation)
          metaTitle = metaTitle.replace(/^["']|["']$/g, '').trim()
          
          // Ensure length is within limits
          if (metaTitle.length > 70) {
            metaTitle = metaTitle.substring(0, 67) + '...'
          }
          
          // Ensure minimum length
          if (metaTitle.length < 30) {
            metaTitle = `[CATEGORY] - Szekrény kellékek`
          }
          
          // Ensure [CATEGORY] tag is included
          if (!metaTitle.includes('[CATEGORY]')) {
            if (metaTitle.length + 12 <= 70) {
              metaTitle = `[CATEGORY] - ${metaTitle}`
            } else {
              metaTitle = metaTitle.replace(categoryName, '[CATEGORY]')
            }
          }
          
          results.meta_title = metaTitle
          titleGenerated = true
          break
        } catch (error: any) {
          if (error.status === 404) continue
          if (error.status === 401 || error.status === 429) throw error
        }
      }
      if (!titleGenerated) {
        results.meta_title = `[CATEGORY] - Szekrény kellékek` // Fallback with dynamic tag
      }
    }

    // Generate meta description (same rules as product meta description)
    if (fields.includes('meta_description')) {
      const systemPrompt = `You are an expert SEO copywriter creating high-ranking meta descriptions for e-commerce categories in Hungarian.

CRITICAL REQUIREMENTS:
1. **Length**: MUST be between 150-160 characters (optimal for Google). Maximum 160 characters.
2. **Language**: Write EXCLUSIVELY in Hungarian
3. **Compelling**: Must be compelling and encourage clicks
4. **Value proposition**: Include key benefits or unique selling points
5. **Call to action**: Include subtle call to action when space allows
6. **Keyword-rich**: Naturally include primary keywords
7. **Dynamic tags**: You MUST include ShopRenter dynamic tags where appropriate:
   - [CATEGORY] - Category name (use this for the main category name)
8. **No special characters**: Avoid characters that might break display (except the dynamic tags)
9. **Complete sentence**: Must be a complete, readable sentence

SEO BEST PRACTICES:
- Start with the most important benefit or feature
- Include primary keyword naturally
- Use [CATEGORY] tag for the category name
- Add value proposition
- Include call to action (e.g., "vásároljon", "fedezze fel", "további információ")
- Make it compelling but accurate
- Use active voice
- Avoid keyword stuffing

DYNAMIC TAG USAGE:
- Always include [CATEGORY] for the category name
- The tags will be replaced by ShopRenter with actual values, so write around them naturally

Return ONLY the meta description text with dynamic tags, nothing else. No quotes, no explanations.`

      const userPrompt = `Generate a high-ranking meta description for this category:

Category Name: ${categoryName}
${productContext}
${categoryDescription ? `Category Description (for context): ${categoryDescription.substring(0, 500)}` : ''}

Generate a meta description that:
- Is 150-160 characters (optimal) - COUNT THE CHARACTERS INCLUDING THE DYNAMIC TAGS
- Is compelling and click-worthy
- Includes [CATEGORY] tag for the category name
- Includes key benefits
- Has a subtle call to action
- Is in Hungarian
- Follows SEO best practices

Example format: "[CATEGORY] - Minőségi szekrény kellékek, széles választék. Fedezze fel termékeinket és vásároljon most!"`

      let descGenerated = false
      for (const model of modelsToTry) {
        try {
          const message = await anthropic.messages.create({
            model: model,
            max_tokens: 200,
            temperature: 0.7,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
          })
          let metaDescription = message.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('')
            .trim()
          
          // Clean up and validate (same as product generation)
          metaDescription = metaDescription.replace(/^["']|["']$/g, '').trim()
          
          // Ensure length is within limits
          if (metaDescription.length > 160) {
            const cutAt = metaDescription.lastIndexOf('.', 157)
            if (cutAt > 120) {
              metaDescription = metaDescription.substring(0, cutAt + 1)
            } else {
              metaDescription = metaDescription.substring(0, 157) + '...'
            }
          }
          
          // Ensure minimum length
          if (metaDescription.length < 120) {
            const fallback = `[CATEGORY] - Minőségi szekrény kellékek, versenyképes áron. Fedezze fel részleteket és vásároljon most!`
            metaDescription = fallback.length > 160 ? fallback.substring(0, 157) + '...' : fallback
          }
          
          // Ensure [CATEGORY] tag is included
          if (!metaDescription.includes('[CATEGORY]')) {
            if (metaDescription.length + 12 <= 160) {
              metaDescription = `[CATEGORY] - ${metaDescription}`
            } else {
              metaDescription = metaDescription.replace(categoryName, '[CATEGORY]')
            }
          }
          
          results.meta_description = metaDescription
          descGenerated = true
          break
        } catch (error: any) {
          if (error.status === 404) continue
          if (error.status === 401 || error.status === 429) throw error
        }
      }
      if (!descGenerated) {
        const fallback = `[CATEGORY] - Minőségi szekrény kellékek, versenyképes áron. Fedezze fel részleteket!`
        results.meta_description = fallback.length > 160 ? fallback.substring(0, 157) + '...' : fallback
      }
    }

    return NextResponse.json({ success: true, ...results })
  } catch (error: any) {
    console.error('[CATEGORY META GENERATION] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate meta fields' },
      { status: 500 }
    )
  }
}
