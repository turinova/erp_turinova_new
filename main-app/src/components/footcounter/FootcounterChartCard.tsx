'use client'

import type { ReactNode } from 'react'
import { Box, Card, CardContent, CircularProgress, Typography } from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'

type PaletteKey = 'success' | 'info' | 'warning' | 'primary' | 'secondary'

type FootcounterChartCardProps = {
  title: string
  subtitle?: string
  borderColor?: PaletteKey
  loading?: boolean
  minHeight?: number
  children: ReactNode
  headerExtra?: ReactNode
}

export default function FootcounterChartCard({
  title,
  subtitle,
  borderColor = 'success',
  loading,
  minHeight = 300,
  children,
  headerExtra
}: FootcounterChartCardProps) {
  return (
    <Card
      variant='outlined'
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderColor: 'divider',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          bgcolor: `${borderColor}.main`,
          borderRadius: '4px 0 0 4px'
        }
      }}
    >
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 2.5, pl: 2.75, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: subtitle ? 0.25 : 1 }}>
          <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {headerExtra}
        </Box>
        {subtitle && (
          <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 2 }}>
            {subtitle}
          </Typography>
        )}
        {loading ? (
          <Box sx={{ minHeight, display: 'flex', alignItems: 'flex-start', pt: 2 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <Box sx={{ minHeight, width: '100%', alignSelf: 'stretch' }}>{children}</Box>
        )}
      </CardContent>
    </Card>
  )
}

export function chartCardStripeBg(theme: Theme, color: PaletteKey): string {
  return alpha(theme.palette[color].main, theme.palette.mode === 'dark' ? 0.06 : 0.03)
}
