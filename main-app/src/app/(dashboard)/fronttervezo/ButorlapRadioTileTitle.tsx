'use client'

import React from 'react'

import { Box, Typography } from '@mui/material'

import FrontTypeLineCountBadge from './FrontTypeLineCountBadge'

type ButorlapRadioTileTitleProps = {
  lineCount: number
}

export default function ButorlapRadioTileTitle({ lineCount }: ButorlapRadioTileTitleProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexWrap: 'wrap' }}>
      <Typography
        component="span"
        variant="body1"
        sx={{
          fontWeight: 600,
          lineHeight: 1.3,
          color: 'var(--mui-palette-text-primary)'
        }}
      >
        Bútorlap
      </Typography>
      <FrontTypeLineCountBadge ariaLabelPrefix="Bútorlap" count={lineCount} />
    </Box>
  )
}
