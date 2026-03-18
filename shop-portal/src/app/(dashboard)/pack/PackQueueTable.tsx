'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Typography,
  Button
} from '@mui/material'
import { OpenInNew as OpenIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { toast } from 'react-toastify'

interface PackOrder {
  id: string
  order_number: string
  status: string
  customer_email: string | null
  shipping_firstname: string | null
  shipping_lastname: string | null
  shipping_company: string | null
  shipping_city: string | null
  shipping_postcode: string | null
  shipping_address1: string | null
  shipping_method_name: string | null
  updated_at: string
}

const STATUS_LABELS: Record<string, string> = {
  picked: 'Kiszedve',
  packing: 'Csomagolás'
}

export default function PackQueueTable() {
  const [orders, setOrders] = useState<PackOrder[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pack/orders')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setOrders(data.orders || [])
    } catch (e) {
      console.error(e)
      toast.error('Hiba a lista betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (orders.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Nincs csomagolásra váró rendelés. A Kiszedve állapotú rendelések itt fognak megjelenni.
        </Typography>
      </Paper>
    )
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="medium">
        <TableHead>
          <TableRow>
            <TableCell>Rendelésszám</TableCell>
            <TableCell>Állapot</TableCell>
            <TableCell>Átvevő / Cím</TableCell>
            <TableCell>Szállítási mód</TableCell>
            <TableCell align="right">Művelet</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} hover>
              <TableCell>
                <Typography fontWeight={600}>{order.order_number}</Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={STATUS_LABELS[order.status] || order.status}
                  color={order.status === 'packing' ? 'primary' : 'default'}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {[order.shipping_firstname, order.shipping_lastname].filter(Boolean).join(' ') || order.shipping_company || '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {[order.shipping_city, order.shipping_postcode, order.shipping_address1].filter(Boolean).join(', ') || '—'}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{order.shipping_method_name || '—'}</Typography>
              </TableCell>
              <TableCell align="right">
                <Button
                  component={NextLink}
                  href={`/pack/orders/${order.id}`}
                  variant="contained"
                  size="small"
                  endIcon={<OpenIcon />}
                >
                  Csomagolás
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
