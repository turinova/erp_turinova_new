'use client'

import React from 'react'
import { Box, Stack, Typography } from '@mui/material'

/** Marketing-only Inomat swatches (static — not priced from DB). */
const MARKETING_SWATCHES: { label: string; hex: string; finish: 'Matt' | 'Fényes' }[] = [
  { label: 'Pure White', hex: '#F4F2EC', finish: 'Matt' },
  { label: 'Pearl', hex: '#E6E1D6', finish: 'Matt' },
  { label: 'Sand', hex: '#D4C4A8', finish: 'Matt' },
  { label: 'Bronze', hex: '#8B7355', finish: 'Matt' },
  { label: 'Light Grey', hex: '#C5C5C5', finish: 'Matt' },
  { label: 'Anthracite', hex: '#3A3A3A', finish: 'Matt' },
  { label: 'Black', hex: '#1A1A1A', finish: 'Matt' },
  { label: 'Navy', hex: '#1B2A4A', finish: 'Matt' },
  { label: 'Hg Pure White', hex: '#FAFAFA', finish: 'Fényes' },
  { label: 'Hg Pearl', hex: '#F0EBE3', finish: 'Fényes' },
  { label: 'Hg Grey', hex: '#9A9A9A', finish: 'Fényes' },
  { label: 'Hg Anthracite', hex: '#2E2E2E', finish: 'Fényes' }
]

/**
 * Color grid for the home Nettfront marketing card — fills visual height
 * next to the taller ügyfélajánlat card.
 */
export default function InomatMarketingSwatches() {
  return (
    <Box>
      <Stack
        direction="row"
        alignItems="baseline"
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1.25 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          Színek, amiket az ügyfeleid várnak
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, flexShrink: 0 }}>
          Matt · Fényes
        </Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.55 }}>
        Matt és fényes (HG) felületek, klasszikus fehértől az antracitig. Válassz színmintát, add meg
        a méreteket — és küldd el a rendelést online.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(4, 1fr)',
            sm: 'repeat(6, 1fr)'
          },
          gap: 1
        }}
      >
        {MARKETING_SWATCHES.map(s => (
          <Box
            key={s.label}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              minWidth: 0
            }}
          >
            <Box
              sx={{
                aspectRatio: '1',
                borderRadius: 1.25,
                bgcolor: s.hex,
                border: '1px solid',
                borderColor: 'rgba(0,0,0,0.14)',
                boxShadow:
                  s.finish === 'Fényes'
                    ? 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -8px 14px rgba(0,0,0,0.08)'
                    : 'none'
              }}
              aria-hidden
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                lineHeight: 1.2,
                fontSize: '0.65rem',
                color: 'text.secondary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={`${s.label} · ${s.finish}`}
            >
              {s.label.replace(/^Hg /, '')}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
