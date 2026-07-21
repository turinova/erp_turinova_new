'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Chip from '@mui/material/Chip'
import InputAdornment from '@mui/material/InputAdornment'
import Link from '@mui/material/Link'
import Pagination from '@mui/material/Pagination'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Home as HomeIcon, Search as SearchIcon } from '@mui/icons-material'

import { PortalTypeChip } from '@/components/portal-list/PortalTypeChip'
import { QuoteCommentIcon } from '@/components/portal-list/QuoteCommentIcon'
import {
  formatPortalCurrency,
  formatPortalDateTime,
  getOrderStatusDisplay,
  getPaymentStatusDisplay,
  type PortalQuoteType,
  type StatusTimestamps
} from '@/lib/portal-list-labels'

interface PortalOrder {
  id: string
  quote_number: string
  comment?: string | null
  submitted_to_company_quote_id: string
  company_quote_number: string
  company_quote_status: string
  company_payment_status: string | null
  company_payment_method: string | null
  final_total_after_discount: number
  submitted_at: string
  last_status_change_at?: string | null
  status_timestamps?: StatusTimestamps
  type?: PortalQuoteType
  companies?: {
    id: string
    name: string
  }
}

interface OrdersClientProps {
  initialOrders: PortalOrder[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearchTerm: string
}

export default function OrdersClient({
  initialOrders,
  totalCount,
  totalPages,
  currentPage,
  initialSearchTerm
}: OrdersClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [orders, setOrders] = useState<PortalOrder[]>(initialOrders)
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    } else {
      params.delete('search')
    }
    params.set('page', '1')
    router.push(`/orders?${params.toString()}`)
  }

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/orders?${params.toString()}`)
  }

  const handleRowClick = (order: PortalOrder) => {
    if (order.type === 'nettfront') {
      router.push(`/saved/nettfront/${order.id}`)
    } else {
      router.push(`/saved/${order.id}`)
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          underline="hover"
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          color="inherit"
          onClick={() => router.push('/home')}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Kezdőlap
        </Link>
        <Typography color="text.primary">Megrendelések</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 1 }}>
        <Typography variant="h4" component="h1">
          Megrendeléseim
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Elküldött lapszabászat és front ajánlatok — státusz és fizetés egy helyen.
        </Typography>
      </Box>

      <Box component="form" onSubmit={handleSearch} sx={{ mb: 3, mt: 2, maxWidth: 520 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Keresés ajánlatszám alapján..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
      </Box>

      {orders.length === 0 ? (
        <Alert severity="info">
          {searchTerm
            ? 'Nincs találat a keresési feltételeknek megfelelően.'
            : 'Még nincs elküldött megrendelésed.'}
        </Alert>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Típus</TableCell>
                  <TableCell>Ajánlatszám</TableCell>
                  <TableCell align="center" sx={{ width: 56 }}>
                    Mj.
                  </TableCell>
                  <TableCell align="right">Végösszeg</TableCell>
                  <TableCell>Fizetési mód</TableCell>
                  <TableCell>Fizetési állapot</TableCell>
                  <TableCell>Státusz</TableCell>
                  <TableCell>Utolsó státuszváltás</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map(order => {
                  const statusDisplay = getOrderStatusDisplay(order.company_quote_status)
                  const paymentDisplay = getPaymentStatusDisplay(order.company_payment_status)

                  return (
                    <TableRow
                      key={`${order.type || 'opti'}-${order.id}`}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(order)}
                    >
                      <TableCell>
                        <PortalTypeChip type={order.type} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {order.company_quote_number}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {order.quote_number}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" onClick={e => e.stopPropagation()}>
                        <QuoteCommentIcon comment={order.comment} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>
                          {formatPortalCurrency(order.final_total_after_discount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {order.company_payment_method ? (
                          <Chip
                            label={order.company_payment_method}
                            size="small"
                            variant="outlined"
                            color="default"
                          />
                        ) : (
                          <Typography variant="body2" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {mounted && (
                          <Chip
                            label={paymentDisplay.label}
                            color={paymentDisplay.color}
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {mounted && (
                          <Chip
                            label={statusDisplay.label}
                            color={statusDisplay.color}
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatPortalDateTime(order.last_status_change_at || order.submitted_at)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
              showFirstButton
              showLastButton
            />
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Összesen {totalCount} megrendelés
          </Typography>
        </>
      )}
    </Box>
  )
}
