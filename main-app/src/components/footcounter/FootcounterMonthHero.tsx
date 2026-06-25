'use client'

import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

import type { FootcounterDashboardStats } from '@/types/footcounter'
import { formatAvg } from '@/lib/footcounter-format'

type FootcounterMonthHeroProps = {
  stats: FootcounterDashboardStats
  monthLabel: string
  inSum: number
}

function monthMood(mom: number | null | undefined, avgIn: number): { label: string; color: 'success' | 'warning' | 'info' } {
  if (mom != null) {
    if (mom >= 10) return { label: 'Erős hónap', color: 'success' }
    if (mom <= -10) return { label: 'Gyengébb hónap', color: 'warning' }
  }
  if (avgIn >= 50) return { label: 'Forgalmas hónap', color: 'success' }
  return { label: 'Átlagos hónap', color: 'info' }
}

export default function FootcounterMonthHero({ stats, monthLabel, inSum }: FootcounterMonthHeroProps) {
  const theme = useTheme()
  const avg = stats.month_summary?.avg_in_per_active_day ?? 0
  const mood = monthMood(stats.mom_change_pct, avg)

  return (
    <Card
      variant='outlined'
      sx={{
        mb: 2,
        borderColor: 'divider',
        bgcolor: alpha(theme.palette[mood.color].main, theme.palette.mode === 'dark' ? 0.08 : 0.04)
      }}
    >
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent='space-between' alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
          <Box>
            <Typography variant='overline' color='text.secondary' sx={{ letterSpacing: 0.6 }}>
              Havi összefoglaló
            </Typography>
            <Typography variant='h5' sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {monthLabel}
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
              {inSum.toLocaleString('hu-HU')} belépő · átlag {formatAvg(avg)} be/aktív nap
            </Typography>
          </Box>
          <Chip label={mood.label} color={mood.color} size='small' sx={{ fontWeight: 600 }} />
        </Stack>
      </CardContent>
    </Card>
  )
}
