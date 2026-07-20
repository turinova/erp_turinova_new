'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material'

interface NettfrontPortalQuote {
  id: string
  quote_number?: string
  customer_name: string
  final_total_after_discount: number
  payment_method_name: string | null
  created_at: string
}

interface Props {
  quotes: NettfrontPortalQuote[]
}

export default function CustomerPortalNettfrontQuotesTable({ quotes }: Props) {
  const router = useRouter()

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Nettfront ügyfél rendelések
      </Typography>

      {quotes.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Nincs beérkezett Nettfront ügyfél rendelés
          </Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ border: '2px solid', borderColor: 'success.main' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'success.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Ajánlatszám</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Ügyfél neve</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>
                  Végösszeg
                </TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Fizetési mód</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Létrehozva</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quotes.map(quote => (
                <TableRow
                  key={quote.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/fronttervezo-quotes/${quote.id}`)}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {quote.quote_number || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {quote.customer_name}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency(quote.final_total_after_discount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {quote.payment_method_name ? (
                      <Chip label={quote.payment_method_name} color="success" size="small" />
                    ) : (
                      <Typography variant="body2">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(quote.created_at)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
