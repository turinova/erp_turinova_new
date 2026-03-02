'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

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
  const pathname = usePathname()
  const { user, loading: authLoading } = useAuth()
  const isMountedRef = useRef(false)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const loadSubscription = async () => {
    // Triple-check we're not on a public route and component is mounted
    if (!isMountedRef.current || !pathname || pathname === '/login' || pathname === '/' || pathname?.startsWith('/api/') || pathname?.startsWith('/_next/')) {
      return
    }
    
    // Ensure user is authenticated
    if (!user) {
      return
    }
    
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
        // Silently handle errors - don't log or show toasts for 401/404
        // These are expected when user is not authenticated or has no subscription
        if (res.status !== 401 && res.status !== 404) {
          console.warn('Subscription API returned non-ok status:', res.status)
        }
        setSubscription(null)
      }
    } catch (error) {
      // Silently handle all network/fetch errors - don't log or show toasts
      // These are expected during initial load, login, or when user is not authenticated
      // Only log truly unexpected errors (not network-related)
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase()
        const isNetworkError = errorMsg.includes('fetch') || 
                               errorMsg.includes('network') || 
                               errorMsg.includes('failed to fetch') ||
                               errorMsg.includes('load failed')
        if (!isNetworkError) {
          console.error('Error loading subscription:', error)
        }
      }
      setSubscription(null)
    }
  }

  const loadUsage = async () => {
    // Triple-check we're not on a public route and component is mounted
    if (!isMountedRef.current || !pathname || pathname === '/login' || pathname === '/' || pathname?.startsWith('/api/') || pathname?.startsWith('/_next/')) {
      return
    }
    
    // Ensure user is authenticated
    if (!user) {
      return
    }
    
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
        // Silently handle errors - don't log or show toasts for 401/404
        // These are expected when user is not authenticated or has no subscription
        if (res.status !== 401 && res.status !== 404) {
          console.warn('Usage API returned non-ok status:', res.status)
        }
        setAiUsage(null)
      }
    } catch (error) {
      // Silently handle all network/fetch errors - don't log or show toasts
      // These are expected during initial load, login, or when user is not authenticated
      // Only log truly unexpected errors (not network-related)
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase()
        const isNetworkError = errorMsg.includes('fetch') || 
                               errorMsg.includes('network') || 
                               errorMsg.includes('failed to fetch') ||
                               errorMsg.includes('load failed')
        if (!isNetworkError) {
          console.error('Error loading usage:', error)
        }
      }
      setAiUsage(null)
    }
  }

  useEffect(() => {
    // Mark component as mounted
    isMountedRef.current = true
    
    // Early return if pathname is not yet available (during initial mount)
    if (!pathname) {
      setLoading(true)
      return
    }

    // Wait for auth to finish loading
    if (authLoading) {
      setLoading(true)
      return
    }

    // Only load subscription data if:
    // 1. User is authenticated
    // 2. Not on login page or other public routes
    const isPublicRoute = pathname === '/login' || 
                         pathname === '/' || 
                         pathname?.startsWith('/api/') ||
                         pathname?.startsWith('/_next/')
    
    if (!user || isPublicRoute) {
      setLoading(false)
      setSubscription(null)
      setAiUsage(null)
      // Clear any pending timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
      return
    }

    // Clear any existing timeout before setting a new one
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
      loadingTimeoutRef.current = null
    }

    // Add a delay to ensure session is fully established after login
    // This prevents errors during the redirect phase
    loadingTimeoutRef.current = setTimeout(() => {
      // Re-check conditions inside timeout (they might have changed)
      const currentPathname = pathname
      const currentUser = user
      const currentIsPublicRoute = currentPathname === '/login' || 
                                   currentPathname === '/' || 
                                   currentPathname?.startsWith('/api/') ||
                                   currentPathname?.startsWith('/_next/')
      
      if (!isMountedRef.current || !currentUser || currentIsPublicRoute) {
        setLoading(false)
        setSubscription(null)
        setAiUsage(null)
        loadingTimeoutRef.current = null
        return
      }

      const loadData = async () => {
        // Final check before making API calls
        if (!isMountedRef.current || !currentUser || currentIsPublicRoute) {
          return
        }

        setLoading(true)
        try {
          await Promise.all([loadSubscription(), loadUsage()])
        } catch (error) {
          // Silently handle ALL errors - don't show toasts or log network errors
          // This prevents error flashes during login
          if (error instanceof Error) {
            const errorMsg = error.message.toLowerCase()
            const isNetworkError = errorMsg.includes('fetch') || 
                                 errorMsg.includes('network') || 
                                 errorMsg.includes('failed to fetch') ||
                                 errorMsg.includes('load failed')
            if (!isNetworkError) {
              console.error('Error loading subscription data:', error)
            }
          }
        } finally {
          if (isMountedRef.current) {
            setLoading(false)
          }
          loadingTimeoutRef.current = null
        }
      }
      loadData()
    }, 300) // Delay to ensure session is ready after redirect

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
      isMountedRef.current = false
    }
  }, [user, pathname, authLoading])

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
