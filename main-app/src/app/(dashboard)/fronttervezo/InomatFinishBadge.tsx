'use client'

import React from 'react'

import { Chip } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

import {
  getInomatFinishLabel,
  type InomatColorDef,
  type InomatColorGroup
} from '@/lib/pricing/inomatCatalog'

type InomatFinishBadgeProps = {
  /** Color label, or pass group directly */
  szin?: string
  group?: InomatColorGroup
  catalog?: InomatColorDef[]
  size?: 'small' | 'medium'
}

export default function InomatFinishBadge({
  szin,
  group,
  catalog = [],
  size = 'small'
}: InomatFinishBadgeProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const resolvedGroup: InomatColorGroup =
    group ?? (szin ? (getInomatFinishLabel(szin, catalog) === 'Fényes' ? 'hg' : 'matt') : 'matt')
  const label = resolvedGroup === 'hg' ? 'Fényes' : 'Matt'
  const isHg = resolvedGroup === 'hg'

  return (
    <Chip
      component="span"
      size={size}
      label={label}
      sx={{
        height: size === 'small' ? 22 : 26,
        fontWeight: 800,
        fontSize: size === 'small' ? '0.7rem' : '0.75rem',
        letterSpacing: 0.2,
        cursor: 'default',
        border: '1px solid',
        borderColor: isHg
          ? isDark
            ? alpha('#D4AF37', 0.55)
            : alpha('#B8860B', 0.45)
          : isDark
            ? alpha(theme.palette.common.white, 0.28)
            : alpha(theme.palette.common.black, 0.28),
        bgcolor: isHg
          ? isDark
            ? alpha('#D4AF37', 0.18)
            : alpha('#F5E6B8', 0.85)
          : isDark
            ? alpha(theme.palette.common.white, 0.08)
            : alpha(theme.palette.grey[800], 0.08),
        color: isHg
          ? isDark
            ? '#F5E6B8'
            : '#6B4E00'
          : isDark
            ? theme.palette.grey[100]
            : theme.palette.grey[900],
        '& .MuiChip-label': { px: 0.9 }
      }}
    />
  )
}
