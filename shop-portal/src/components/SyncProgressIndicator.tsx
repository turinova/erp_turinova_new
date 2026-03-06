'use client'

import { useState, useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { Sync as SyncIcon } from '@mui/icons-material'

interface ActiveSync {
  connectionId: string
  connectionName: string
  progress: {
    total: number
    synced: number
    current: number
    status: string
    errors: number
    percentage: number
    elapsed: number
    currentBatch?: number
    totalBatches?: number
    batchProgress?: number
  }
}

export function SyncProgressIndicator() {
  const [activeSyncs, setActiveSyncs] = useState<ActiveSync[]>([])
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Poll for active syncs
  useEffect(() => {
    const pollActiveSyncs = async () => {
      try {
        const response = await fetch('/api/syncs/active')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.activeSyncs) {
            setActiveSyncs(data.activeSyncs)
          } else {
            setActiveSyncs([])
          }
        }
      } catch (error) {
        console.error('Error polling active syncs:', error)
      }
    }

    // Poll immediately
    pollActiveSyncs()

    // Then poll every 2 seconds
    pollingIntervalRef.current = setInterval(pollActiveSyncs, 2000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  // Don't render if no active syncs
  if (activeSyncs.length === 0) {
    return null
  }

  const totalSynced = activeSyncs.reduce((sum, sync) => sum + sync.progress.synced, 0)
  const totalTotal = activeSyncs.reduce((sum, sync) => sum + sync.progress.total, 0)
  const totalPercentage = totalTotal > 0 ? Math.round((totalSynced / totalTotal) * 100) : 0

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}
    >
      <SyncIcon 
        sx={{ 
          fontSize: 18, 
          color: 'primary.main', 
          animation: 'spin 2s linear infinite' 
        }} 
      />
      <Typography variant="body2" color="text.secondary">
        Szinkronizálás:
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {totalSynced} / {totalTotal} ({totalPercentage}%)
      </Typography>

      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Box>
  )
}
