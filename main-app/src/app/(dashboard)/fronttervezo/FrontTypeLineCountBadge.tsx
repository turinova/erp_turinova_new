'use client'

import React from 'react'

import { Chip } from '@mui/material'

type FrontTypeLineCountBadgeProps = {
  count: number

  /** Short label for screen readers, e.g. "Bútorlap" */
  ariaLabelPrefix: string
}

/**
 * Sorok száma a front típus csempén — mindig „danger” (error) háttér, fehér szám.
 */
export default function FrontTypeLineCountBadge({ count, ariaLabelPrefix }: FrontTypeLineCountBadgeProps) {
  if (count <= 0) return null

  return (
    <Chip
      size="small"
      label={count}
      color="error"
      variant="filled"
      sx={{
        height: 22,
        minWidth: 28,
        fontWeight: 700,
        '& .MuiChip-label': {
          px: 0.75,
          color: 'common.white'
        }
      }}
      aria-label={`${ariaLabelPrefix}: ${count} tétel a munkamenetben`}
    />
  )
}
