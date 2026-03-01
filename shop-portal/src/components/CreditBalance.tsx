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
      
      // ALWAYS use aiUsage.credit_limit (effective limit = plan + bonus + purchased)
      // This is calculated in the API and includes bonus_credits and purchased_credits
      const creditLimit = aiUsage?.credit_limit !== undefined 
        ? aiUsage.credit_limit 
        : null
      
      // Get credit used and remaining from aiUsage (already calculated correctly)
      const creditUsed = aiUsage?.credit_used || 0
      const creditRemaining = aiUsage?.credit_remaining !== undefined
        ? aiUsage.credit_remaining
        : null
      const creditPercentage = aiUsage?.credit_percentage !== undefined
        ? aiUsage.credit_percentage
        : 0
      
      const available = creditRemaining !== null && creditRemaining !== Infinity
        ? creditRemaining
        : (creditLimit === null || creditLimit === Infinity 
          ? Infinity 
          : Math.max(0, creditLimit - creditUsed))
      const percentage = creditPercentage > 0 
        ? creditPercentage
        : (creditLimit !== null && creditLimit !== Infinity && creditLimit > 0
          ? (creditUsed / creditLimit) * 100 
          : 0)

      setStats({
        used: creditUsed,
        limit: creditLimit === null ? Infinity : creditLimit,
        available,
        percentage
      })
    } catch (error) {
      console.error('Error loading credit stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return null
  }

  if (!stats) {
    return null
  }

  // Unlimited plan
  if (stats.limit === Infinity) {
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
