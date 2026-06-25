'use client'

import { useMemo } from 'react'
import { Box, Card, CardContent, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import DirectionsWalkOutlinedIcon from '@mui/icons-material/DirectionsWalkOutlined'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'

import type { FootcounterDashboardStats } from '@/types/footcounter'
import { dayMoodFromStats, moodStripeColor } from '@/lib/footcounter-day-mood'
import { FOOTCOUNTER_LOCAL_TZ } from '@/lib/footcounter-weather'

const STALE_MINUTES = 20

function formatShortTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('hu-HU', {
    timeZone: FOOTCOUNTER_LOCAL_TZ,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function minutesSince(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return (Date.now() - t) / 60_000
}

type FootcounterHeroCardProps = {
  stats: FootcounterDashboardStats
}

export default function FootcounterHeroCard({ stats }: FootcounterHeroCardProps) {
  const theme = useTheme()
  const moodResult = useMemo(() => dayMoodFromStats(stats), [stats])
  const seenMin = minutesSince(stats.device_last_seen)
  const online = seenMin != null && seenMin <= STALE_MINUTES

  return (
    <Card
      variant='outlined'
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: t => (t.palette.mode === 'dark' ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.04)'),
        mb: 2,
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: moodStripeColor(theme, moodResult.mood),
          borderRadius: '4px 0 0 4px'
        }
      }}
    >
      <CardContent sx={{ py: 2, px: 2.5, pl: 2.75, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
              <DirectionsWalkOutlinedIcon sx={{ fontSize: 22, color: 'info.main' }} />
              <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
                Mai helyzet
              </Typography>
            </Box>
            <Typography
              variant='h4'
              sx={{
                fontWeight: 800,
                color: moodResult.heroColor(theme),
                lineHeight: 1.15,
                mb: 0.5
              }}
            >
              {moodResult.heroLabel}
            </Typography>
            {moodResult.subtitle && (
              <Typography variant='body2' color='text.secondary'>
                {moodResult.subtitle}
              </Typography>
            )}
            <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 1 }}>
              Ma: <strong>{stats.today_in}</strong> be · <strong>{stats.today_out}</strong> ki
            </Typography>
          </Box>
          <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
              <FiberManualRecordIcon sx={{ fontSize: 10, color: online ? 'success.main' : 'text.disabled' }} />
              <Typography variant='caption' sx={{ fontWeight: online ? 600 : 400, color: online ? 'success.main' : 'text.secondary' }}>
                {online ? 'Számláló aktív' : 'Számláló nem jelez'}
              </Typography>
            </Box>
            <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.75 }}>
              Utolsó esemény: {formatShortTime(stats.last_event_at)}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
