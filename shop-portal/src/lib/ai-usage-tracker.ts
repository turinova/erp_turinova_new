import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { calculateCreditsForAI, AIFeatureType } from './credit-calculator'

export interface TrackUsageParams {
  userId: string
  featureType: AIFeatureType
  tokensUsed: number
  modelUsed: string
  productId?: string
  categoryId?: string
  metadata?: Record<string, any>
  creditsUsed?: number // Optional - will be calculated if not provided
  creditType?: 'ai_generation' | 'competitor_scrape' // Default: 'ai_generation'
}

export async function trackAIUsage(params: TrackUsageParams) {
  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Estimate cost (adjust based on your AI provider pricing)
    const costEstimate = estimateCost(params.tokensUsed, params.modelUsed)
    
    // Calculate credits if not provided
    const creditsUsed = params.creditsUsed ?? calculateCreditsForAI(params.featureType)
    
    // Determine credit type
    const creditType = params.creditType || 
      (params.featureType.includes('competitor') ? 'competitor_scrape' : 'ai_generation')

    const { data, error } = await supabase
      .from('ai_usage_logs')
      .insert({
        user_id: params.userId,
        feature_type: params.featureType,
        product_id: params.productId || null,
        category_id: params.categoryId || null,
        tokens_used: params.tokensUsed,
        model_used: params.modelUsed,
        cost_estimate: costEstimate,
        credits_used: creditsUsed,
        credit_type: creditType,
        metadata: params.metadata || {}
      })
      .select()

    if (error) {
      console.error('Error tracking AI usage:', error)
      console.error('Failed to insert usage log:', {
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
      console.log(`[AI USAGE TRACKED] User ${params.userId}: ${params.featureType} - ${creditsUsed} credits (${creditType})`)
      if (data && data.length > 0) {
        console.log(`[AI USAGE TRACKED] Inserted log ID: ${data[0].id}`)
      }
    }
  } catch (error) {
    console.error('Error in trackAIUsage:', error)
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
