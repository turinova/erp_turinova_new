'use client'

import { Box, Chip, Tooltip, Typography } from '@mui/material'
import type { OrderBillingSummary } from '@/lib/order-billing-summary'

const PRIMARY_STYLES: Record<
  OrderBillingSummary['primaryStatus'],
  { bgcolor: string; color: string; borderColor: string }
> = {
  not_invoiced: { bgcolor: 'rgba(97, 97, 97, 0.10)', color: '#424242', borderColor: 'rgba(97, 97, 97, 0.30)' },
  proforma: { bgcolor: 'rgba(25, 118, 210, 0.12)', color: '#1565c0', borderColor: 'rgba(25, 118, 210, 0.35)' },
  advance: { bgcolor: 'rgba(245, 124, 0, 0.12)', color: '#e65100', borderColor: 'rgba(245, 124, 0, 0.35)' },
  final: { bgcolor: 'rgba(46, 125, 50, 0.12)', color: '#2e7d32', borderColor: 'rgba(46, 125, 50, 0.35)' },
  storno: { bgcolor: 'rgba(211, 47, 47, 0.10)', color: '#c62828', borderColor: 'rgba(211, 47, 47, 0.32)' }
}

const SECONDARY_STYLES: Record<
  NonNullable<OrderBillingSummary['secondaryStatus']>,
  { bgcolor: string; color: string; borderColor: string }
> = {
  pending: { bgcolor: 'rgba(255, 152, 0, 0.12)', color: '#7A5D00', borderColor: 'rgba(255, 152, 0, 0.35)' },
  partial: { bgcolor: 'rgba(25, 118, 210, 0.10)', color: '#0D47A1', borderColor: 'rgba(25, 118, 210, 0.30)' },
  paid: { bgcolor: 'rgba(46, 125, 50, 0.10)', color: '#1B5E20', borderColor: 'rgba(46, 125, 50, 0.30)' },
  not_payable: { bgcolor: 'rgba(97, 97, 97, 0.10)', color: '#4E342E', borderColor: 'rgba(97, 97, 97, 0.25)' }
}

interface OrderBillingStatusCellProps {
  summary: OrderBillingSummary | null
}

export default function OrderBillingStatusCell({ summary }: OrderBillingStatusCellProps) {
  const effectiveSummary: OrderBillingSummary = summary ?? {
    primaryStatus: 'not_invoiced',
    primaryLabel: 'Nincs számlázva',
    secondaryStatus: null,
    secondaryLabel: null,
    primaryInvoiceNumber: null,
    primaryInternalNumber: null,
    tooltipLines: ['Nincs számlázva', 'Ehhez a rendeléshez még nincs rögzített díjbekérő vagy számla.']
  }

  const primaryStyle = PRIMARY_STYLES[effectiveSummary.primaryStatus]
  const secondaryStyle = effectiveSummary.secondaryStatus
    ? SECONDARY_STYLES[effectiveSummary.secondaryStatus]
    : null

  return (
    <Tooltip
      title={<span style={{ whiteSpace: 'pre-line' }}>{effectiveSummary.tooltipLines.join('\n')}</span>}
      placement="top"
      enterDelay={250}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5, py: 0.25 }}>
        <Chip
          size="small"
          label={effectiveSummary.primaryLabel}
          sx={{
            height: 22,
            fontSize: '0.72rem',
            fontWeight: 600,
            border: '1px solid',
            maxWidth: '100%',
            '& .MuiChip-label': {
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              px: 0.75
            },
            ...primaryStyle
          }}
        />
        {effectiveSummary.secondaryLabel ? (
          <Chip
            size="small"
            label={effectiveSummary.secondaryLabel}
            variant="outlined"
            sx={{
              height: 20,
              fontSize: '0.68rem',
              fontWeight: 500,
              border: '1px solid',
              '& .MuiChip-label': { px: 0.75 },
              ...secondaryStyle
            }}
          />
        ) : effectiveSummary.primaryInvoiceNumber ? (
          <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 170, lineHeight: 1.3 }}>
            {effectiveSummary.primaryInvoiceNumber}
          </Typography>
        ) : null}
      </Box>
    </Tooltip>
  )
}
