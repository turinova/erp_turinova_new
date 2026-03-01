'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  price_monthly: number | null
  price_yearly: number | null
  features: {
    ai_generation?: boolean
    analytics?: boolean
    ai_monthly_limit?: number | null // null = unlimited
  }
}

export interface UserSubscription {
  id: string
  plan_id: string
  status: 'trial' | 'active' | 'canceled' | 'expired'
  current_period_end: string | null
  plan: SubscriptionPlan
}

export interface AIUsageStats {
  current_month: number // tokens used this month
  monthly_limit: number | null // null = unlimited
  remaining: number | null
  percentage_used: number
  total_cost: number
  usage_count: number
  // Credit usage (new unified system)
  credit_used?: number
  credit_limit?: number | null
  credit_remaining?: number | null
  credit_percentage?: number
}

interface SubscriptionContextType {
  subscription: UserSubscription | null
  loading: boolean
  hasFeature: (feature: string) => boolean
  canUseAI: () => boolean
  aiUsage: AIUsageStats | null
  refreshSubscription: () => Promise<void>
  refreshUsage: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [aiUsage, setAiUsage] = useState<AIUsageStats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSubscription = async () => {
    try {
      // Add cache busting timestamp to ensure fresh data
      const res = await fetch(`/api/subscription/current?t=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.subscription) {
          setSubscription(data.subscription)
        } else {
          setSubscription(null)
        }
      } else {
        setSubscription(null)
      }
    } catch (error) {
      console.error('Error loading subscription:', error)
      setSubscription(null)
    }
  }

  const loadUsage = async () => {
    try {
      // Add cache busting timestamp to ensure fresh data
      const res = await fetch(`/api/subscription/usage?t=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          // Get credit limit - ALWAYS use creditUsage.credit_limit (effective limit = plan + bonus + purchased)
          // This is calculated in the API route and includes bonus_credits and purchased_credits
          const creditLimit = data.creditUsage?.credit_limit !== undefined 
            ? data.creditUsage.credit_limit 
            : null
          
          const totalCreditsUsed = data.creditUsage?.total_credits_used || 0
          const creditRemaining = data.creditUsage?.credit_remaining !== undefined
            ? data.creditUsage.credit_remaining
            : null
          const creditPercentage = data.creditUsage?.credit_percentage !== undefined
            ? data.creditUsage.credit_percentage
            : 0
          
          // Merge credit usage into aiUsage
          const usage = {
            ...data.usage,
            credit_used: totalCreditsUsed,
            credit_limit: creditLimit,
            credit_remaining: creditRemaining,
            credit_percentage: creditPercentage
          }
          setAiUsage(usage)
        } else {
          setAiUsage(null)
        }
      } else {
        setAiUsage(null)
      }
    } catch (error) {
      console.error('Error loading usage:', error)
      setAiUsage(null)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([loadSubscription(), loadUsage()])
      setLoading(false)
    }
    loadData()
  }, [])

  const hasFeature = (feature: string): boolean => {
    if (!subscription) return false
    if (subscription.status !== 'active' && subscription.status !== 'trial') return false
    return subscription.plan.features[feature as keyof SubscriptionPlan['features']] === true
  }

  const canUseAI = (): boolean => {
    if (!hasFeature('ai_generation')) return false
    if (!aiUsage) return false
    
    // Use credit system (new unified system)
    // If credit_limit is null or Infinity, it's unlimited
    if (aiUsage.credit_limit === null || aiUsage.credit_limit === Infinity) return true
    
    // Check if user has available credits
    const creditUsed = aiUsage.credit_used || 0
    const creditLimit = aiUsage.credit_limit || 0
    const creditRemaining = aiUsage.credit_remaining !== null && aiUsage.credit_remaining !== undefined
      ? aiUsage.credit_remaining
      : Math.max(0, creditLimit - creditUsed)
    
    // Allow if there are remaining credits
    return creditRemaining > 0
  }

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        hasFeature,
        canUseAI,
        aiUsage,
        refreshSubscription: loadSubscription,
        refreshUsage: loadUsage
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider')
  }
  return context
}
