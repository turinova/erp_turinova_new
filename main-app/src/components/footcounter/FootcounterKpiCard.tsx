'use client'

import { Box, Paper, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'

type FootcounterKpiCardProps = {
  label: string
  value: string | number
  sub?: string
  highlight?: boolean
}

export default function FootcounterKpiCard({ label, value, sub, highlight }: FootcounterKpiCardProps) {
  return (
    <Paper
      variant='outlined'
      sx={{
        p: 2.5,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        ...(highlight
          ? {
              borderColor: 'success.main',
              borderWidth: 2,
              bgcolor: (t: Theme) =>
                t.palette.mode === 'dark' ? 'rgba(var(--mui-palette-success-mainChannel) / 0.08)' : 'success.lighterOpacity'
            }
          : {})
      }}
    >
      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: '0.7rem' }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: { xs: '1.35rem', md: '1.6rem' },
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography variant='caption' color='text.secondary' sx={{ lineHeight: 1.35 }}>
          {sub}
        </Typography>
      )}
    </Paper>
  )
}
