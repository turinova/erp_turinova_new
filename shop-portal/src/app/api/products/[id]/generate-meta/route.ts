import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { generateMetaTitle, generateMetaKeywords, generateMetaDescription, MetaGenerationContext } from '@/lib/meta-seo-generation-service'
import { trackAIUsage } from '@/lib/ai-usage-tracker'
import { checkAvailableCredits } from '@/lib/credit-checker'
import {
  mergeSearchQueriesByImpressions,
  variantDifferentiatorFromAttributes,
  isChildVariant
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

// Helper to get current month credit usage (for response)
async function getCurrentMonthCreditUsage(userId: string): Promise<number> {
  const supabase = await getTenantSupabase()
  const { data } = await supabase
    .rpc('get_user_credit_usage_current_month', { user_uuid: userId })

  return data?.[0]?.total_credits_used || 0
}

/**
 * POST /api/products/[id]/generate-meta
 * Generate meta title, keywords, and/or description
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params

  const supabase = await getTenantSupabase()

  // Get auth user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { fields = ['title', 'keywords', 'description'] } = body // Default to all fields

    // Calculate total credits needed
    let totalCreditsNeeded = 0
    if (fields.includes('title')) totalCreditsNeeded += 1
    if (fields.includes('keywords')) totalCreditsNeeded += 1
    if (fields.includes('description')) totalCreditsNeeded += 1

    // Check credits before generation
    if (totalCreditsNeeded > 0) {
      const creditCheck = await checkAvailableCredits(user.id, totalCreditsNeeded)
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
    }

    // Fetch product data with manufacturer
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        *,
        manufacturers (
          name
        )
      `)
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

    // Check parent-child relationships (self-reference = parent hub)
    let parentProduct = null
    let childProducts: any[] = []
    let siblingProducts: any[] = []
    const isParent = !product.parent_product_id || product.parent_product_id === product.id
    const isChild = isChildVariant(product.parent_product_id, product.id)

    if (isChild && product.parent_product_id) {
      // Fetch parent product
      const { data: parent } = await supabase
        .from('shoprenter_products')
        .select('id, name, sku')
        .eq('id', product.parent_product_id)
        .single()
      parentProduct = parent

      const { data: siblings } = await supabase
        .from('shoprenter_products')
        .select('id, name, sku, product_attributes')
        .eq('parent_product_id', product.parent_product_id)
        .neq('id', product.id)
        .is('deleted_at', null)
      siblingProducts = siblings || []
    }

    if (isParent) {
      // Fetch child products
      const { data: children } = await supabase
        .from('shoprenter_products')
        .select('id, name, sku, product_attributes')
        .eq('parent_product_id', product.id)
        .neq('id', product.id)
        .is('deleted_at', null)
      childProducts = children || []
    }

    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const dateStr = ninetyDaysAgo.toISOString().split('T')[0]

    const performanceProductId =
      isChild && product.parent_product_id ? product.parent_product_id : productId

    const [searchPerformanceResult, queriesThisResult, queriesParentResult] = await Promise.all([
      supabase
        .from('product_search_performance')
        .select('query, impressions, clicks, position')
        .eq('product_id', performanceProductId)
        .order('impressions', { ascending: false })
        .limit(12),
      supabase
        .from('product_search_queries')
        .select('query, impressions, clicks, ctr, position')
        .eq('product_id', productId)
        .gte('date', dateStr)
        .order('impressions', { ascending: false })
        .limit(15),
      isChild && product.parent_product_id
        ? supabase
            .from('product_search_queries')
            .select('query, impressions, clicks, ctr, position')
            .eq('product_id', product.parent_product_id)
            .gte('date', dateStr)
            .order('impressions', { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] as any[] })
    ])

    const perfRows =
      searchPerformanceResult.data?.map(p => ({
        query: p.query || '',
        impressions: p.impressions || 0,
        clicks: p.clicks || 0,
        position: p.position ?? 0
      })) || []

    const qThis = (queriesThisResult.data || []).map((p: any) => ({
      query: p.query || '',
      impressions: p.impressions || 0,
      clicks: p.clicks || 0,
      position: p.position ?? 0
    }))
    const qParent = (queriesParentResult.data || []).map((p: any) => ({
      query: p.query || '',
      impressions: p.impressions || 0,
      clicks: p.clicks || 0,
      position: p.position ?? 0
    }))

    const merged = mergeSearchQueriesByImpressions(perfRows, qThis, isChild ? qParent : [])
    const searchQueries = merged.slice(0, 12).map(p => ({
      query: p.query,
      impressions: p.impressions,
      clicks: p.clicks,
      position: p.position ?? 0
    }))

    // Get competitor price if available
    let competitorPrice: number | null = null
    try {
      const { data: competitorData } = await supabase
        .from('competitor_product_links')
        .select('price')
        .eq('product_id', productId)
        .eq('is_active', true)
        .not('price', 'is', null)
        .order('price', { ascending: true })
        .limit(1)
        .single()
      
      if (competitorData?.price) {
        competitorPrice = parseFloat(competitorData.price)
      }
    } catch (e) {
      // Ignore errors - competitor price is optional
    }

    const productAttrs = parseProductAttributes(product.product_attributes)
    const currentDifferentiator = variantDifferentiatorFromAttributes(productAttrs)
    const siblingVariants =
      isChild && siblingProducts.length > 0
        ? siblingProducts.map(s => ({
            sku: s.sku,
            name: s.name,
            differentiator: variantDifferentiatorFromAttributes(parseProductAttributes(s.product_attributes))
          }))
        : undefined

    // Build context
    const context: MetaGenerationContext = {
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        model_number: product.model_number,
        price: product.price,
        brand: (product.manufacturers as any)?.name || null,
        product_attributes: productAttrs
      },
      description: description?.description || null,
      isParent,
      isChild,
      isParentWithoutChildren: isParent && childProducts.length === 0,
      currentDifferentiator: currentDifferentiator || undefined,
      siblingVariants,
      parentProduct: parentProduct ? {
        name: parentProduct.name,
        sku: parentProduct.sku
      } : null,
      childProducts: childProducts.map(c => ({
        name: c.name,
        sku: c.sku,
        product_attributes: parseProductAttributes(c.product_attributes)
      })),
      searchQueries: searchQueries.length > 0 ? searchQueries : undefined,
      competitorPrice: competitorPrice
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
        creditsUsed: 1,
        creditType: 'ai_generation',
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
        creditsUsed: 1,
        creditType: 'ai_generation',
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
        creditsUsed: 1,
        creditType: 'ai_generation',
        metadata: { generated: true }
      })
    }

    // Return success with credit info for frontend refresh
    return NextResponse.json({
      success: true,
      ...result,
      credits: {
        used: await getCurrentMonthCreditUsage(user.id),
        // Note: Frontend should refresh subscription context to get updated credit usage
      }
    })
  } catch (error) {
    console.error('Error in POST /api/products/[id]/generate-meta:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate meta fields'
    }, { status: 500 })
  }
}
