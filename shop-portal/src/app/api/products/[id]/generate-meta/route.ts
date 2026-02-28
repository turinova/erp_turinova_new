import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateAllMetaFields, generateMetaTitle, generateMetaKeywords, generateMetaDescription, MetaGenerationContext } from '@/lib/meta-seo-generation-service'
import { trackAIUsage } from '@/lib/ai-usage-tracker'

/**
 * POST /api/products/[id]/generate-meta
 * Generate meta title, keywords, and/or description
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params

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

  try {
    const body = await request.json()
    const { fields = ['title', 'keywords', 'description'] } = body // Default to all fields

    // Fetch product data
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('*')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Fetch description
    const { data: description } = await supabase
      .from('shoprenter_product_descriptions')
      .select('description')
      .eq('product_id', productId)
      .eq('language_code', 'hu')
      .single()

    // Check parent-child relationships
    let parentProduct = null
    let childProducts: any[] = []
    const isParent = !product.parent_product_id || product.parent_product_id === product.id
    const isChild = !isParent && !!product.parent_product_id

    if (isChild && product.parent_product_id) {
      // Fetch parent product
      const { data: parent } = await supabase
        .from('shoprenter_products')
        .select('id, name, sku')
        .eq('id', product.parent_product_id)
        .single()
      parentProduct = parent
    }

    if (isParent) {
      // Fetch child products
      const { data: children } = await supabase
        .from('shoprenter_products')
        .select('id, name, sku, product_attributes')
        .eq('parent_product_id', product.id)
        .neq('id', product.id)
      childProducts = children || []
    }

    // Fetch Search Console queries for optimization
    const { data: searchPerformance } = await supabase
      .from('product_search_performance')
      .select('query, impressions, clicks, position')
      .eq('product_id', isChild && product.parent_product_id ? product.parent_product_id : productId)
      .order('impressions', { ascending: false })
      .limit(10)

    const searchQueries = searchPerformance?.map(p => ({
      query: p.query || '',
      impressions: p.impressions || 0,
      clicks: p.clicks || 0,
      position: p.position || 0
    })) || []

    // Build context
    const context: MetaGenerationContext = {
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        model_number: product.model_number,
        price: product.price,
        product_attributes: product.product_attributes
      },
      description: description?.description || null,
      isParent,
      isChild,
      parentProduct: parentProduct ? {
        name: parentProduct.name,
        sku: parentProduct.sku
      } : null,
      childProducts: childProducts.map(c => ({
        name: c.name,
        sku: c.sku,
        product_attributes: c.product_attributes
      })),
      searchQueries: searchQueries.length > 0 ? searchQueries : undefined
    }

    // Generate requested fields
    const result: any = {}
    let totalTokensUsed = 0

    if (fields.includes('title')) {
      result.meta_title = await generateMetaTitle(context)
      // Estimate tokens: ~200 tokens for meta title generation
      totalTokensUsed += 200
      await trackAIUsage({
        userId: user.id,
        featureType: 'meta_title',
        tokensUsed: 200,
        modelUsed: 'claude-sonnet-4-6',
        productId: productId,
        metadata: { generated: true }
      })
    }

    if (fields.includes('keywords')) {
      result.meta_keywords = await generateMetaKeywords(context)
      // Estimate tokens: ~150 tokens for meta keywords generation
      totalTokensUsed += 150
      await trackAIUsage({
        userId: user.id,
        featureType: 'meta_keywords',
        tokensUsed: 150,
        modelUsed: 'claude-sonnet-4-6',
        productId: productId,
        metadata: { generated: true }
      })
    }

    if (fields.includes('description')) {
      result.meta_description = await generateMetaDescription(context)
      // Estimate tokens: ~250 tokens for meta description generation
      totalTokensUsed += 250
      await trackAIUsage({
        userId: user.id,
        featureType: 'meta_description',
        tokensUsed: 250,
        modelUsed: 'claude-sonnet-4-6',
        productId: productId,
        metadata: { generated: true }
      })
    }

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Error in POST /api/products/[id]/generate-meta:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate meta fields'
    }, { status: 500 })
  }
}
