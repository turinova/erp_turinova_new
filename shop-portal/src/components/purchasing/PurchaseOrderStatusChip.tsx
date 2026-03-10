'use client'

import { Chip } from '@mui/material'

interface PurchaseOrderStatusChipProps {
  status: string
  size?: 'small' | 'medium'
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: {
    label: 'Vázlat',
    color: '#ffffff',
    bgColor: '#757575'
  },
  pending_approval: {
    label: 'Jóváhagyásra vár',
    color: '#ffffff',
    bgColor: '#ff9800'
  },
  approved: {
    label: 'Jóváhagyva',
    color: '#ffffff',
    bgColor: '#4caf50'
  },
  partially_received: {
    label: 'Részben bevételezve',
    color: '#ffffff',
    bgColor: '#2196f3'
  },
  received: {
    label: 'Bevételezve',
    color: '#ffffff',
    bgColor: '#2e7d32'
  },
  cancelled: {
    label: 'Törölve',
    color: '#ffffff',
    bgColor: '#f44336'
  }
}

export default function PurchaseOrderStatusChip({ status, size = 'small' }: PurchaseOrderStatusChipProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    color: '#ffffff',
    bgColor: '#757575'
  }

  return (
    <Chip
      label={config.label}
      size={size}
      sx={{
        bgcolor: config.bgColor,
        color: config.color,
        fontWeight: 600,
        fontSize: size === 'small' ? '0.75rem' : '0.875rem',
        height: size === 'small' ? '24px' : '32px'
      }}
    />
  )
}
