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
    bgColor: '#78909c'
  },
  pending_approval: {
    label: 'Jóváhagyásra vár',
    color: '#ffffff',
    bgColor: '#ef6c00'
  },
  approved: {
    label: 'Jóváhagyva',
    color: '#ffffff',
    bgColor: '#1565c0'
  },
  partially_received: {
    label: 'Részben bevételezve',
    color: '#ffffff',
    bgColor: '#7b1fa2'
  },
  received: {
    label: 'Bevételezve',
    color: '#ffffff',
    bgColor: '#2e7d32'
  },
  cancelled: {
    label: 'Törölve',
    color: '#ffffff',
    bgColor: '#c62828'
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
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        fontWeight: 600,
        fontSize: size === 'small' ? '0.75rem' : '0.875rem',
        height: size === 'small' ? 24 : 32
      }}
    />
  )
}
