'use client'

import React from 'react'

import { Box, Typography } from '@mui/material'

import FrontTypeLineCountBadge from './FrontTypeLineCountBadge'

type ButorlapRadioTileTitleProps = {
  lineCount: number
  comingSoon?: boolean
}

export default function ButorlapRadioTileTitle({ lineCount, comingSoon = false }: ButorlapRadioTileTitleProps) {
  return (
    <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', minWidth: 0 }}>
        <Typography
          component="span"
          variant="body2"
          sx={{
            fontWeight: 700,
            lineHeight: 1.25,
            color: 'var(--mui-palette-text-primary)',
            wordBreak: 'break-word'
          }}
        >
          Bútorlap
        </Typography>
        {!comingSoon ? <FrontTypeLineCountBadge ariaLabelPrefix="Bútorlap" count={lineCount} /> : null}
      </Box>
      {comingSoon ? (
        <Typography
          variant="caption"
          sx={{
            mt: 0.5,
            display: 'block',
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
            color: 'warning.main'
          }}
        >
          Hamarosan
        </Typography>
      ) : null}
    </Box>
  )
}
