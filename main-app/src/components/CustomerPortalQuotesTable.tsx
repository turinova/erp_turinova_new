'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Box
} from '@mui/material'

interface CustomerQuote {
  id: string
  customer_name: string
  final_total_after_discount: number
  payment_method_name: string | null
  created_at: string
}

interface CustomerPortalQuotesTableProps {
  quotes: CustomerQuote[]
}

export default function CustomerPortalQuotesTable({ quotes }: CustomerPortalQuotesTableProps) {
  const router = useRouter()

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'
  }

  // Format date
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

  // Handle row click
  const handleRowClick = (quoteId: string) => {
    router.push(`/quotes/${quoteId}`)
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Ügyfél árajánlatok
      </Typography>
      
      {quotes.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Nincs beérkezett ügyfél árajánlat
          </Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ border: '2px solid', borderColor: 'error.main' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'error.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Ügyfél neve</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Végösszeg</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Fizetési mód</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Létrehozva</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow
                  key={quote.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(quote.id)}
                >
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
                      <Chip 
                        label={quote.payment_method_name}
                        color="error"
                        size="small"
                      />
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

