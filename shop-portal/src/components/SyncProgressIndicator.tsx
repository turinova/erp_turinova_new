'use client'

import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Tooltip } from '@mui/material'
import { Sync as SyncIcon } from '@mui/icons-material'

interface ActiveSync {
  connectionId: string
  connectionName: string
  source?: 'memory' | 'database'
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
  const activeSyncsRef = useRef<ActiveSync[]>([])

  // Poll for active syncs with dynamic interval
  useEffect(() => {
    const pollActiveSyncs = async () => {
      try {
        const response = await fetch('/api/syncs/active')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.activeSyncs) {
            const newSyncs = data.activeSyncs
            activeSyncsRef.current = newSyncs
            setActiveSyncs(newSyncs)
          } else {
            activeSyncsRef.current = []
            setActiveSyncs([])
          }
        }
      } catch (error) {
        console.error('Error polling active syncs:', error)
      }
    }

    // Poll immediately
    pollActiveSyncs()

    // Dynamic polling: 2s when active syncs exist, 10s when inactive
    const schedulePoll = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }

      const hasActiveSyncs = activeSyncsRef.current.length > 0
      const interval = hasActiveSyncs ? 2000 : 10000 // 2s if active, 10s if not

      pollingIntervalRef.current = setInterval(async () => {
        await pollActiveSyncs()
        schedulePoll() // Reschedule based on updated state
      }, interval)
    }

    schedulePoll()

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, []) // Empty deps - only run on mount/unmount

  // Don't render if no active syncs
  if (activeSyncs.length === 0) {
    return null
  }

  const totalSynced = activeSyncs.reduce((sum, sync) => sum + sync.progress.synced, 0)
  const totalTotal = activeSyncs.reduce((sum, sync) => sum + sync.progress.total, 0)
  const totalPercentage = totalTotal > 0 ? Math.round((totalSynced / totalTotal) * 100) : 0

  const tooltipLines = activeSyncs.map(
    (s) =>
      `${s.connectionName}: ${s.progress.synced}/${s.progress.total}${s.source === 'database' ? ' (állapot szerverről)' : ''}`
  )
  const progressLabel =
    totalTotal > 0
      ? `${totalSynced} / ${totalTotal} (${totalPercentage}%)`
      : 'előkészítés / lista…'

  return (
    <Tooltip title={<Box sx={{ whiteSpace: 'pre-line' }}>{tooltipLines.join('\n')}</Box>} arrow placement="bottom">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          maxWidth: 320,
          cursor: 'default'
        }}
      >
        <SyncIcon
          sx={{
            fontSize: 18,
            color: 'primary.main',
            animation: 'spin 2s linear infinite'
          }}
        />
        <Typography variant="body2" color="text.secondary" noWrap>
          Szinkronizálás:
        </Typography>
        <Typography variant="body2" fontWeight={500} noWrap>
          {progressLabel}
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
    </Tooltip>
  )
}
