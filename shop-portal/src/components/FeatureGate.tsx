'use client'

import React from 'react'
import { useSubscription } from '@/lib/subscription-context'
import { useRouter } from 'next/navigation'
import { Box, Button, Paper, Typography, CircularProgress, Tooltip } from '@mui/material'
import { Lock as LockIcon } from '@mui/icons-material'

interface FeatureGateProps {
  feature: 'ai_generation' | 'analytics'
  children: React.ReactNode
  showUpgrade?: boolean
  disabled?: boolean
  compact?: boolean // If true, show only tooltip on children, not full card
}

export function FeatureGate({ feature, children, showUpgrade = true, disabled = false, compact = false }: FeatureGateProps) {
  let subscriptionContext
  try {
    subscriptionContext = useSubscription()
  } catch (error) {
    // If subscription context is not available, show children as disabled
    console.warn('Subscription context not available:', error)
    return (
      <Box sx={{ opacity: 0.5, pointerEvents: 'none' }}>
        {children}
      </Box>
    )
  }

  const { hasFeature, subscription, loading, canUseAI } = subscriptionContext
  const router = useRouter()

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  // Safety check: if hasFeature is undefined, show disabled
  if (!hasFeature) {
    return (
      <Box sx={{ opacity: 0.5, pointerEvents: 'none' }}>
        {children}
      </Box>
    )
  }

  // For AI features, check both feature access and usage limits
  if (feature === 'ai_generation') {
    const hasAIFeature = hasFeature('ai_generation')
    const canUse = canUseAI ? canUseAI() : false
    if (!hasAIFeature || !canUse) {
      // If compact mode, show tooltip on disabled children
      if (compact) {
        return (
          <Tooltip 
            title={!hasAIFeature 
              ? 'Ez a funkció a Pro előfizetéshez szükséges' 
              : 'Elérte a havi AI használati limitet. Frissítse előfizetését korlátlan használathoz.'}
            arrow
          >
            <Box component="span" sx={{ display: 'inline-block' }}>
              <Box sx={{ opacity: 0.5, pointerEvents: 'none' }}>
                {children}
              </Box>
            </Box>
          </Tooltip>
        )
      }
      
      if (!showUpgrade) {
        // Show premium card first, then disabled children
        return (
          <Box>
            <Paper 
              elevation={2}
              sx={{ 
                p: 3, 
                textAlign: 'center',
                bgcolor: 'background.paper',
                border: '2px solid',
                borderColor: 'warning.main',
                borderRadius: 2,
                mb: 3
              }}
            >
              <LockIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Premium funkció
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {!hasAIFeature
                  ? 'Ez a funkció a Pro előfizetéshez szükséges'
                  : 'Elérte a havi AI használati limitet. Frissítse előfizetését korlátlan használathoz.'}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => router.push('/subscription')}
              >
                Előfizetés frissítése
              </Button>
            </Paper>
            <Box sx={{ opacity: 0.4, pointerEvents: 'none', filter: 'grayscale(50%)' }}>
              {children}
            </Box>
          </Box>
        )
      }
      return (
        <Box>
          <Paper 
            elevation={2}
            sx={{ 
              p: 3, 
              textAlign: 'center',
              bgcolor: 'background.paper',
              border: '2px solid',
              borderColor: 'warning.main',
              borderRadius: 2,
              mb: 3
            }}
          >
            <LockIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Premium funkció
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {!hasAIFeature
                ? 'Ez a funkció a Pro előfizetéshez szükséges'
                : 'Elérte a havi AI használati limitet. Frissítse előfizetését korlátlan használathoz.'}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => router.push('/subscription')}
            >
              Előfizetés frissítése
            </Button>
          </Paper>
          <Box sx={{ opacity: 0.4, pointerEvents: 'none', filter: 'grayscale(50%)' }}>
            {children}
          </Box>
        </Box>
      )
    }
  }

  // For analytics feature
  if (feature === 'analytics') {
    const hasAnalyticsFeature = hasFeature('analytics')
    if (!hasAnalyticsFeature) {
      if (!showUpgrade) {
        // Show premium card first, then disabled children
        return (
          <Box>
            <Paper 
              elevation={2}
              sx={{ 
                p: 3, 
                textAlign: 'center',
                bgcolor: 'background.paper',
                border: '2px solid',
                borderColor: 'warning.main',
                borderRadius: 2,
                mb: 3
              }}
            >
              <LockIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Premium funkció
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Ez a funkció a Pro előfizetéshez szükséges
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => router.push('/subscription')}
              >
                Előfizetés frissítése
              </Button>
            </Paper>
            <Box sx={{ opacity: 0.4, pointerEvents: 'none', filter: 'grayscale(50%)' }}>
              {children}
            </Box>
          </Box>
        )
      }
      return (
        <Box>
          <Paper 
            elevation={2}
            sx={{ 
              p: 3, 
              textAlign: 'center',
              bgcolor: 'background.paper',
              border: '2px solid',
              borderColor: 'warning.main',
              borderRadius: 2,
              mb: 3
            }}
          >
            <LockIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Premium funkció
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Ez a funkció a Pro előfizetéshez szükséges
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => router.push('/subscription')}
            >
              Előfizetés frissítése
            </Button>
          </Paper>
          <Box sx={{ opacity: 0.4, pointerEvents: 'none', filter: 'grayscale(50%)' }}>
            {children}
          </Box>
        </Box>
      )
    }
  }

  // Feature is available
  return <>{children}</>
}
