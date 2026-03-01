import { getAdminSupabase, getTenantFromSession, getTenantSupabase } from './tenant-supabase'
import { calculateCreditsForAI, AIFeatureType } from './credit-calculator'

export interface TrackUsageParams {
  userId: string
  userEmail?: string // Optional - will be fetched if not provided
  featureType: AIFeatureType
  tokensUsed: number
  modelUsed: string
  productId?: string
  productName?: string // Optional - will be fetched if not provided
  productSku?: string // Optional - will be fetched if not provided
  categoryId?: string
  metadata?: Record<string, any>
  creditsUsed?: number // Optional - will be calculated if not provided
  creditType?: 'ai_generation' | 'competitor_scrape' // Default: 'ai_generation'
}

export async function trackAIUsage(params: TrackUsageParams) {
  try {
    // Get tenant context
    const tenant = await getTenantFromSession()
    if (!tenant) {
      console.error('[AI USAGE TRACKER] No tenant context found, cannot track usage')
      return
    }

    // Get Admin Supabase client (uses service role key)
    const adminSupabase = await getAdminSupabase()

    // Fetch product context if productId is provided but productName/SKU are missing
    let productName = params.productName
    let productSku = params.productSku
    let userEmail = params.userEmail

    if (params.productId && (!productName || !productSku)) {
      try {
        const tenantSupabase = await getTenantSupabase()
        const { data: product } = await tenantSupabase
          .from('shoprenter_products')
          .select('name, sku')
          .eq('id', params.productId)
          .single()
        
        if (product) {
          productName = product.name || productName
          productSku = product.sku || productSku
        }
      } catch (error) {
        console.warn('[AI USAGE TRACKER] Could not fetch product context:', error)
      }
    }

    // Fetch user email if not provided
    if (!userEmail) {
      try {
        const tenantSupabase = await getTenantSupabase()
        const { data: { user } } = await tenantSupabase.auth.getUser()
        if (user?.email) {
          userEmail = user.email
        }
      } catch (error) {
        console.warn('[AI USAGE TRACKER] Could not fetch user email:', error)
      }
    }

    // Estimate cost (adjust based on your AI provider pricing)
    const costEstimate = estimateCost(params.tokensUsed, params.modelUsed)
    
    // Calculate credits if not provided
    const creditsUsed = params.creditsUsed ?? calculateCreditsForAI(params.featureType)
    
    // Determine credit type
    const creditType = params.creditType || 
      (params.featureType.includes('competitor') ? 'competitor_scrape' : 'ai_generation')

    // Build product context JSON
    const productContext: Record<string, any> = {}
    if (params.productId) {
      productContext.product_id = params.productId
      if (productName) productContext.product_name = productName
      if (productSku) productContext.product_sku = productSku
    }
    if (params.categoryId) {
      productContext.category_id = params.categoryId
    }

    // Insert into Admin DB
    const { data, error } = await adminSupabase
      .from('tenant_credit_usage_logs')
      .insert({
        tenant_id: tenant.id,
        user_id_in_tenant_db: params.userId,
        user_email: userEmail || null,
        feature_type: params.featureType,
        credits_used: creditsUsed,
        credit_type: creditType,
        product_context: productContext,
        tokens_used: params.tokensUsed,
        model_used: params.modelUsed,
        cost_estimate: costEstimate,
        metadata: params.metadata || {}
      })
      .select()

    if (error) {
      console.error('[AI USAGE TRACKER] Error tracking AI usage:', error)
      console.error('[AI USAGE TRACKER] Failed to insert usage log:', {
        tenantId: tenant.id,
        userId: params.userId,
        featureType: params.featureType,
        creditsUsed,
        creditType,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      // Don't throw - usage tracking shouldn't break the feature
    } else {
      console.log(`[AI USAGE TRACKED] Tenant ${tenant.slug}, User ${params.userId}: ${params.featureType} - ${creditsUsed} credits (${creditType})`)
      if (data && data.length > 0) {
        console.log(`[AI USAGE TRACKED] Inserted log ID: ${data[0].id}`)
      }
    }
  } catch (error) {
    console.error('[AI USAGE TRACKER] Error in trackAIUsage:', error)
  }
}

function estimateCost(tokens: number, model: string): number {
  // Adjust these based on your actual AI provider pricing
  // Example for Anthropic Claude:
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-3-5-sonnet-20241022': { input: 3 / 1000000, output: 15 / 1000000 },
    'claude-3-opus-20240229': { input: 15 / 1000000, output: 75 / 1000000 },
    'claude-3-5-haiku-20241022': { input: 0.8 / 1000000, output: 4 / 1000000 },
    // Add more models as needed
  }
  
  const modelPricing = pricing[model] || pricing['claude-3-5-sonnet-20241022']
  // Rough estimate: assume 70% input, 30% output
  return tokens * (modelPricing.input * 0.7 + modelPricing.output * 0.3)
}
