'use client'

import { useState, useEffect } from 'react'
import { Box, Typography, LinearProgress, Chip, Tooltip } from '@mui/material'
import { AccountBalanceWallet as WalletIcon } from '@mui/icons-material'
import { useSubscription } from '@/lib/subscription-context'

interface CreditStats {
  used: number
  limit: number
  available: number
  percentage: number
}

export function CreditBalance({ compact = false }: { compact?: boolean }) {
  const { aiUsage, subscription, refreshUsage } = useSubscription()
  const [stats, setStats] = useState<CreditStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCreditStats()
  }, [aiUsage, subscription])

  // Listen for manual refresh events
  useEffect(() => {
    const handleRefresh = () => {
      console.log('[CreditBalance] Refresh event received, reloading stats...')
      refreshUsage() // Refresh subscription context first
      setTimeout(() => {
        loadCreditStats() // Then reload local stats
      }, 300) // Small delay to ensure context is updated
    }
    
    // Listen for both credit limit updates and credit usage updates
    window.addEventListener('creditLimitUpdated', handleRefresh)
    window.addEventListener('creditUsageUpdated', handleRefresh)
    
    return () => {
      window.removeEventListener('creditLimitUpdated', handleRefresh)
      window.removeEventListener('creditUsageUpdated', handleRefresh)
    }
  }, [refreshUsage])

  const loadCreditStats = async () => {
    try {
      setLoading(true)
      
      // Don't set stats if aiUsage is not loaded yet
      if (!aiUsage) {
        setStats(null)
        return
      }
      
      // ALWAYS use aiUsage.credit_limit (effective limit = plan + bonus + purchased)
      // This is calculated in the API and includes bonus_credits and purchased_credits
      // If credit_limit is null from API, it means unlimited (API sets it to null for unlimited plans)
      const creditLimit = aiUsage.credit_limit !== undefined && aiUsage.credit_limit !== null
        ? aiUsage.credit_limit 
        : null
      
      // Check if plan is truly unlimited
      // API returns credit_limit: null for unlimited plans, OR we can check subscription plan
      const planCredits = subscription?.plan?.ai_credits_per_month
      const isUnlimited = creditLimit === null || 
                         planCredits === null || 
                         planCredits === Infinity
      
      // Get credit used and remaining from aiUsage (already calculated correctly)
      const creditUsed = aiUsage.credit_used || 0
      const creditRemaining = aiUsage.credit_remaining !== undefined
        ? aiUsage.credit_remaining
        : null
      const creditPercentage = aiUsage.credit_percentage !== undefined
        ? aiUsage.credit_percentage
        : 0
      
      const available = creditRemaining !== null && creditRemaining !== Infinity
        ? creditRemaining
        : (isUnlimited
          ? Infinity 
          : (creditLimit !== null && creditLimit !== Infinity
            ? Math.max(0, creditLimit - creditUsed)
            : 0))
      const percentage = creditPercentage > 0 
        ? creditPercentage
        : (creditLimit !== null && creditLimit !== Infinity && creditLimit > 0
          ? (creditUsed / creditLimit) * 100 
          : 0)

      setStats({
        used: creditUsed,
        limit: isUnlimited ? Infinity : (creditLimit !== null ? creditLimit : 0),
        available,
        percentage
      })
    } catch (error) {
      console.error('Error loading credit stats:', error)
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  // Show nothing while loading
  if (loading) {
    return null
  }
  
  // If we have stats, show them even if subscription is null
  // (subscription might be null but plan info comes from tenants table fallback)
  if (!stats) {
    return null
  }

  // Unlimited plan - only show if we're certain it's unlimited
  // Need both: stats showing Infinity AND subscription data confirming unlimited plan
  // Also need to ensure subscription data is actually loaded (not null/undefined)
  const planIsUnlimited = subscription?.plan?.ai_credits_per_month === null || 
                          subscription?.plan?.ai_credits_per_month === Infinity
  const hasSubscriptionData = subscription !== null && subscription !== undefined && subscription.plan !== null && subscription.plan !== undefined
  
  // Only show "Unlimited" if we have confirmed subscription data AND it's truly unlimited
  if (stats.limit === Infinity && planIsUnlimited && hasSubscriptionData) {
    return (
      <Chip
        icon={<WalletIcon />}
        label="Unlimited Turitoken"
        color="success"
        size="small"
        sx={{ ml: 1 }}
      />
    )
  }
  
  // If we don't have subscription data but we have stats with a valid limit, still show it
  // This handles cases where subscription API returns plan from tenants table fallback
  // Only hide if we truly don't have any data (stats.limit is 0 or Infinity without confirmation)
  if (!hasSubscriptionData && stats.limit === Infinity) {
    // Don't show "Unlimited" without confirmation, but if we have a valid numeric limit, show it
    if (stats.limit === Infinity) {
      return null // Hide if truly unlimited but not confirmed
    }
  }

  if (compact) {
    return (
      <Tooltip title={`${stats.used} / ${stats.limit} Turitoken használva ebben a hónapban`}>
        <Chip
          icon={<WalletIcon />}
          label={`${stats.available} Turitoken`}
          color={stats.available < 10 ? 'error' : stats.available < 50 ? 'warning' : 'default'}
          size="small"
          sx={{ ml: 1 }}
        />
      </Tooltip>
    )
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          AI Turitoken
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {stats.used} / {stats.limit}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(stats.percentage, 100)}
        color={stats.percentage > 90 ? 'error' : stats.percentage > 70 ? 'warning' : 'primary'}
        sx={{ height: 8, borderRadius: 1 }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {stats.available} Turitoken maradt
        </Typography>
        {stats.available < 10 && (
          <Typography variant="caption" color="error.main" fontWeight={600}>
            Kevés Turitoken
          </Typography>
        )}
      </Box>
    </Box>
  )
}
