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
      const res = await fetch('/api/subscription/current')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
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
      const res = await fetch('/api/subscription/usage')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setAiUsage(data.usage)
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
    if (aiUsage.monthly_limit === null) return true // Unlimited
    return aiUsage.current_month < aiUsage.monthly_limit
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
