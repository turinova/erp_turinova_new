'use client'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

import {
  buildOrderStatusTimeline,
  formatPortalDateTime,
  getOrderStatusDisplay,
  getPaymentStatusDisplay,
  type StatusTimestamps
} from '@/lib/portal-list-labels'

export type CompanyQuoteStatusMeta = {
  company_quote_number: string
  company_quote_status: string
  company_payment_status: string | null
  company_payment_method: string | null
  status_timestamps: StatusTimestamps
} | null

type Props = {
  portalQuoteNumber: string
  submittedAt: string | null
  isDraft: boolean
  companyMeta: CompanyQuoteStatusMeta
}

/** Compact status timeline for Nettfront detail sidebar */
export function NettfrontStatusHistoryCard({
  portalQuoteNumber,
  submittedAt,
  isDraft,
  companyMeta
}: Props) {
  if (isDraft || !companyMeta) {
    return (
      <Paper variant="outlined" sx={{ p: 1.5, mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Státusz
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Megrendelés után jelenik meg.
        </Typography>
      </Paper>
    )
  }

  const status = getOrderStatusDisplay(companyMeta.company_quote_status)
  const payment = getPaymentStatusDisplay(companyMeta.company_payment_status)
  const timeline = buildOrderStatusTimeline({
    portalQuoteNumber,
    companyQuoteNumber: companyMeta.company_quote_number,
    timestamps: {
      submitted_at: submittedAt,
      ...companyMeta.status_timestamps
    }
  })

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mt: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Státusz
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
        <Chip label={status.label} color={status.color} size="small" />
        <Chip label={payment.label} color={payment.color} size="small" variant="outlined" />
      </Box>

      {timeline.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          Még nincs státuszváltás.
        </Typography>
      ) : (
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {timeline.map((event, index) => (
            <Box
              component="li"
              key={event.id}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 1,
                py: 0.5,
                borderTop: index === 0 ? 0 : '1px solid',
                borderColor: 'divider'
              }}
            >
              <Typography variant="caption" fontWeight={600} color="text.primary">
                {event.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                {formatPortalDateTime(event.at)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  )
}
