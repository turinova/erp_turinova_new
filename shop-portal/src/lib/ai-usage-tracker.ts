import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export interface TrackUsageParams {
  userId: string
  featureType: 'product_description' | 'meta_title' | 'meta_keywords' | 'meta_description' | 'url_slug' | 'category_description' | 'category_meta'
  tokensUsed: number
  modelUsed: string
  productId?: string
  categoryId?: string
  metadata?: Record<string, any>
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

    const { error } = await supabase
      .from('ai_usage_logs')
      .insert({
        user_id: params.userId,
        feature_type: params.featureType,
        product_id: params.productId || null,
        category_id: params.categoryId || null,
        tokens_used: params.tokensUsed,
        model_used: params.modelUsed,
        cost_estimate: costEstimate,
        metadata: params.metadata || {}
      })

    if (error) {
      console.error('Error tracking AI usage:', error)
      // Don't throw - usage tracking shouldn't break the feature
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
