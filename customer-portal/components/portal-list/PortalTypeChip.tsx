'use client'

import Chip from '@mui/material/Chip'

import { portalTypeChipColor, portalTypeLabel, type PortalQuoteType } from '@/lib/portal-list-labels'

type Props = {
  type?: PortalQuoteType | string | null
}

export function PortalTypeChip({ type }: Props) {
  return (
    <Chip
      label={portalTypeLabel(type)}
      size="small"
      color={portalTypeChipColor(type)}
      variant="outlined"
    />
  )
}
