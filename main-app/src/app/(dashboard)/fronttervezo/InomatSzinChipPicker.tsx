'use client'

import React from 'react'

import { Box, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

import InomatFinishBadge from './InomatFinishBadge'
import {
  INOMAT_ALL_COLORS,
  splitInomatCatalog,
  type InomatColorDef
} from '@/lib/pricing/inomatCatalog'
import { formatPrice } from '@/lib/pricing/quoteCalculations'

type InomatSzinChipPickerProps = {
  value: string
  onChange: (label: string) => void
  catalog?: InomatColorDef[]
}

function ColorChip({
  def,
  selected,
  onSelect
}: {
  def: InomatColorDef
  selected: boolean
  onSelect: () => void
}) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        textAlign: 'left',
        cursor: 'pointer',
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 2,
        px: 1.25,
        py: 1,
        minWidth: 160,
        maxWidth: 220,
        bgcolor: selected
          ? isDark
            ? alpha(theme.palette.primary.main, 0.2)
            : alpha(theme.palette.primary.main, 0.08)
          : isDark
            ? alpha(theme.palette.common.white, 0.04)
            : 'background.paper',
        boxShadow: selected ? `0 0 0 1px ${theme.palette.primary.main}` : 'none',
        transition: 'border-color 0.15s, background-color 0.15s',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: isDark ? alpha(theme.palette.primary.main, 0.14) : alpha(theme.palette.primary.main, 0.05)
        }
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 1,
          bgcolor: def.swatchHex,
          border: '1px solid',
          borderColor: alpha(theme.palette.common.black, 0.2),
          mt: 0.25
        }}
        aria-hidden
      />
      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
        <Typography
          component="span"
          sx={{
            fontWeight: 800,
            fontSize: '0.82rem',
            lineHeight: 1.25,
            color: 'text.primary'
          }}
        >
          {def.label}
        </Typography>
        <InomatFinishBadge group={def.group} />
        <Typography
          component="span"
          sx={{
            fontSize: '0.68rem',
            lineHeight: 1.3,
            color: 'text.primary',
            opacity: 0.75,
            fontWeight: 600
          }}
        >
          {formatPrice(def.grossPerSqm, 'HUF')}/m²
        </Typography>
      </Box>
    </Box>
  )
}

function ColorGroup({
  title,
  colors,
  value,
  onChange
}: {
  title: string
  colors: InomatColorDef[]
  value: string
  onChange: (label: string) => void
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: '0.8rem',
          letterSpacing: 0.4,
          mb: 0.75,
          color: 'text.primary'
        }}
      >
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {colors.map(def => (
          <ColorChip
            key={def.id}
            def={def}
            selected={value === def.label}
            onSelect={() => onChange(def.label)}
          />
        ))}
      </Box>
    </Box>
  )
}

export default function InomatSzinChipPicker({
  value,
  onChange,
  catalog = INOMAT_ALL_COLORS
}: InomatSzinChipPickerProps) {
  const { matt, hg } = splitInomatCatalog(catalog)

  return (
    <Box>
      <ColorGroup title="Matt felület" colors={matt} value={value} onChange={onChange} />
      <ColorGroup title="Fényes felület (High Gloss)" colors={hg} value={value} onChange={onChange} />
    </Box>
  )
}
