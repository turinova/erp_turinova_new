'use client'

import { Chip, Tooltip } from '@mui/material'

interface OrderSourceCellProps {
  connectionId: string | null
  platformOrderId: string | null
}

export default function OrderSourceCell({ connectionId, platformOrderId }: OrderSourceCellProps) {
  if (connectionId) {
    const tooltipTitle = platformOrderId
      ? `ShopRenter rendelés ID: ${platformOrderId}`
      : 'Webshop rendelés'
    return (
      <Tooltip title={tooltipTitle} placement="top">
        <Chip
          size="small"
          label="Webshop"
          sx={{
            height: 22,
            fontSize: '0.75rem',
            fontWeight: 500,
            bgcolor: 'rgba(25, 118, 210, 0.12)',
            color: '#1565c0',
            border: '1px solid',
            borderColor: 'rgba(25, 118, 210, 0.35)'
          }}
        />
      </Tooltip>
    )
  }
  return (
    <Chip
      size="small"
      label="Helyi"
      variant="outlined"
      sx={{
        height: 22,
        fontSize: '0.75rem',
        fontWeight: 500,
        bgcolor: 'rgba(0, 0, 0, 0.04)',
        color: 'text.secondary',
        borderColor: 'rgba(0, 0, 0, 0.12)'
      }}
    />
  )
}
