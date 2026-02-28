import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { trackAIUsage } from '@/lib/ai-usage-tracker'

/**
 * POST /api/products/[id]/tags/generate
 * Generate product tags using AI
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

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get product with all relevant data
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        id,
        sku,
        name,
        model_number,
        brand,
        product_attributes,
        parent_product_id
      `)
      .eq('id', id)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { success: false, error: 'Termék nem található' },
        { status: 404 }
      )
    }

    // Get categories
    const { data: categoryRelations } = await supabase
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
      .limit(5)

    const categories = (categoryRelations || [])
      .map(rel => {
        const catDesc = rel.shoprenter_categories?.shoprenter_category_descriptions?.find(
          (d: any) => d.language_code === 'hu'
        )
        return catDesc?.name
      })
      .filter(Boolean)

    // Get Search Console queries
    const { data: searchQueries } = await supabase
      .from('product_search_queries')
      .select('query, impressions, clicks')
      .eq('product_id', id)
      .order('impressions', { ascending: false })
      .limit(5)

    const topSearchQueries = searchQueries?.map((q: any) => q.query).join(', ') || ''

    // Extract attributes for tags
    const attributeTags: string[] = []
    if (product.product_attributes && Array.isArray(product.product_attributes)) {
      product.product_attributes.forEach((attr: any) => {
        if (attr.display_name && attr.value) {
          if (Array.isArray(attr.value)) {
            attr.value.forEach((val: any) => {
              const value = typeof val === 'object' && val.value ? val.value : val
              if (value && typeof value === 'string') {
                attributeTags.push(value.toLowerCase())
              }
            })
          } else if (attr.value) {
            attributeTags.push(String(attr.value).toLowerCase())
          }
        }
      })
    }

    // Get related products' tags for context
    const { data: relatedProducts } = await supabase
      .from('shoprenter_product_category_relations')
      .select(`
        shoprenter_products!inner (
          id,
          shoprenter_product_descriptions (
            tags
          )
        )
      `)
      .eq('product_id', id)
      .neq('shoprenter_products.id', id)
      .limit(5)

    const relatedTags: string[] = []
    if (relatedProducts) {
      relatedProducts.forEach((rel: any) => {
        const tags = rel.shoprenter_products?.shoprenter_product_descriptions?.[0]?.tags
        if (tags) {
          const tagArray = tags.split(',').map((t: string) => t.trim()).filter(Boolean)
          relatedTags.push(...tagArray.slice(0, 3))
        }
      })
    }

    // Prepare AI prompt
    const systemPrompt = `You are an expert e-commerce SEO specialist creating product tags for Hungarian e-commerce products.

CRITICAL REQUIREMENTS:
1. **Format**: Comma-separated tags, no quotes, lowercase
2. **Count**: 5-10 tags optimal (max 15)
3. **Language**: ALL tags in Hungarian
4. **Relevance**: Only highly relevant tags
5. **Categories**: Include category-based tags
6. **Attributes**: Include attribute-based tags (color, size, material, etc.)
7. **Brand**: Include brand if relevant and well-known
8. **Use cases**: Include application/use case tags
9. **No duplicates**: Each tag appears only once
10. **Order**: Most important first

TAG TYPES TO INCLUDE:
- Product category (e.g., "szekrény kellék", "fiókcsúszka")
- Product type (e.g., "fiókrendszer", "csukló", "kuka")
- Attributes (e.g., "fehér", "400mm", "soft close")
- Brand (if available and well-known, e.g., "blum", "hafele")
- Use case (e.g., "konyha", "fürdőszoba", "hálószoba")
- Material (if relevant, e.g., "acél", "műanyag")
- Style (if relevant, e.g., "modern", "klasszikus")

SEO BEST PRACTICES:
- Start with most important category/type tags
- Include specific attributes that customers search for
- Use natural Hungarian terms
- Avoid generic terms unless highly relevant
- Match search query patterns from Search Console
- Include brand only if it's well-known and adds search value

BRAND INTEGRATION:
- Include brand if it's well-known (e.g., Blum, Hafele, Hettich)
- Format: lowercase brand name (e.g., "blum", "hafele")
- Omit brand if it's unknown or doesn't add search value
- Use brand + product type combination (e.g., "blum fiókcsúszka")

**CONVERSION & SEARCHABILITY (BASED ON ACTUAL DATA):**
1. **Customer Journey Tags**: Tags for different search stages (only if relevant)
   - Discovery: "szekrény kellék", "bútorkellék" (general category tags)
   - Research: "fiókcsúszka összehasonlítás" (only for parent products with variants)
   - Purchase: "fiókcsúszka vásárlás", "fiókcsúszka ár" (only if price data available)
   - **CRITICAL**: Only use journey tags that match actual product context

2. **Pain Point Tags**: Tags that address problems (only if product solves them)
   - "zajmentes fiók", "csendes zárás" (only if soft close is confirmed)
   - "könnyű beszerelés", "egyszerű montázs" (only if installation is simple based on product type)
   - **NEVER use**: Pain point tags if product doesn't actually solve that problem

3. **Use Case Tags**: Application-specific (based on product attributes and categories)
   - "konyha", "fürdőszoba", "hálószoba" (only if categories indicate these use cases)
   - "lakás", "iroda" (only if product is suitable for these contexts)
   - **CRITICAL**: Use case tags must match actual product categories/attributes

4. **Emotional Tags**: Feelings and outcomes (only when product characteristics support)
   - "prémium", "minőségi", "megbízható" (only if quality is confirmed)
   - "kényelmes", "modern", "stílusos" (only if product attributes indicate these)
   - **NEVER use**: Emotional tags that don't match product reality

**LONG-TAIL KEYWORD TAGS:**
1. **Attribute Combinations**: Create compound tags from actual attributes
   - "soft close fiókcsúszka" (only if soft close is confirmed)
   - "400mm fiókcsúszka fehér" (only if both 400mm and white are attributes)
   - "beépített fiókcsúszka" (only if product is built-in type)
   - **CRITICAL**: Only combine attributes that actually exist for this product

2. **Question-Based Tags**: Include question formats when Search Console shows them
   - "hogyan válasszak fiókcsúszkát" (only if Search Console queries show "hogyan" patterns)
   - **CRITICAL**: Match question tags to actual search patterns if provided

Return ONLY comma-separated tags, nothing else. No quotes, no explanations.`

    const userPrompt = `Generate product tags for this product:

Product Name: ${product.name || 'N/A'}
SKU: ${product.sku}
Model Number: ${product.model_number || 'N/A'}
Brand: ${product.brand || 'N/A'}
Categories: ${categories.length > 0 ? categories.join(', ') : 'N/A'}
Attributes: ${attributeTags.length > 0 ? attributeTags.slice(0, 10).join(', ') : 'N/A'}
Top Search Queries: ${topSearchQueries || 'N/A'}
${relatedTags.length > 0 ? `Related Products Tags (for context): ${relatedTags.slice(0, 5).join(', ')}` : ''}

Generate 5-10 highly relevant tags in Hungarian, comma-separated.`

    // Call Claude AI
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    })

    let generatedTags = ''
    if (message.content[0].type === 'text') {
      generatedTags = message.content[0].text.trim()
    }

    // Clean up
    generatedTags = generatedTags
      .replace(/^["']|["']$/g, '')
      .replace(/^(Tags?|Címkék?):\s*/i, '')
      .trim()

    // Fallback
    if (!generatedTags || generatedTags.length < 5) {
      const fallbackTags = [
        product.name || product.sku,
        ...categories.slice(0, 2),
        ...attributeTags.slice(0, 3),
        'szekrény kellék'
      ].filter(Boolean).slice(0, 10)
      generatedTags = fallbackTags.join(', ')
    }

    // Track AI usage
    const estimatedTokens = message.usage?.input_tokens && message.usage?.output_tokens
      ? message.usage.input_tokens + message.usage.output_tokens
      : 150 // Fallback estimate

    await trackAIUsage({
      userId: user.id,
      featureType: 'product_tags',
      tokensUsed: estimatedTokens,
      modelUsed: 'claude-haiku-4-5-20251001',
      productId: id,
      metadata: { generated: true }
    })

    return NextResponse.json({
      success: true,
      tags: generatedTags
    })
  } catch (error: any) {
    console.error('Error generating product tags:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Hiba történt a címkék generálása során' },
      { status: 500 }
    )
  }
}
