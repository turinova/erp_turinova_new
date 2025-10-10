'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Checkbox, 
  TextField, 
  InputAdornment, 
  Breadcrumbs, 
  Link, 
  Chip,
  Pagination,
  CircularProgress
} from '@mui/material'
import { 
  Search as SearchIcon, 
  Home as HomeIcon
} from '@mui/icons-material'

interface Order {
  id: string
  order_number: string
  status: string
  payment_status: string
  customer_name: string
  final_total: number
  updated_at: string
}

interface OrdersListClientProps {
  initialOrders: Order[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearchTerm: string
}

export default function OrdersListClient({ 
  initialOrders, 
  totalCount, 
  totalPages, 
  currentPage, 
  initialSearchTerm 
}: OrdersListClientProps) {
  const router = useRouter()
  
  const [orders] = useState<Order[]>(initialOrders)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [mounted, setMounted] = useState(false)
  
  // Ensure client-side only rendering
  useEffect(() => {
    setMounted(true)
  }, [])

  // Format currency with thousands separator
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
      day: '2-digit'
    })
  }

  // Get status display info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'ordered':
        return { label: 'Megrendelve', color: 'primary' as const }
      case 'in_production':
        return { label: 'Gyártásban', color: 'warning' as const }
      case 'ready':
        return { label: 'Leadva', color: 'info' as const }
      case 'finished':
        return { label: 'Átadva', color: 'success' as const }
      default:
        return { label: status, color: 'default' as const }
    }
  }

  // Get payment status display info
  const getPaymentStatusInfo = (status: string) => {
    switch (status) {
      case 'not_paid':
        return { label: 'Nincs fizetve', color: 'error' as const }
      case 'partial':
        return { label: 'Részben fizetve', color: 'warning' as const }
      case 'paid':
        return { label: 'Kifizetve', color: 'success' as const }
      default:
        return { label: status, color: 'default' as const }
    }
  }

  // Handle search
  const handleSearch = (value: string) => {
    const params = new URLSearchParams()
    if (value) params.set('search', value)
    params.set('page', '1') // Reset to page 1 on search
    router.push(`/orders?${params.toString()}`)
  }

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== initialSearchTerm) {
        handleSearch(searchTerm)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    const params = new URLSearchParams()
    params.set('page', value.toString())
    if (searchTerm) params.set('search', searchTerm)
    router.push(`/orders?${params.toString()}`)
  }

  // Handle row click
  const handleRowClick = (orderId: string) => {
    router.push(`/orders/${orderId}`)
  }

  // Handle select all
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedOrders(orders.map(o => o.id))
    } else {
      setSelectedOrders([])
    }
  }

  // Handle select one
  const handleSelectOne = (orderId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId))
    } else {
      setSelectedOrders([...selectedOrders, orderId])
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="#"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Eszközök
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Megrendelések
        </Typography>
      </Breadcrumbs>
      
      <TextField
        fullWidth
        placeholder="Keresés megrendelés szám vagy ügyfél nevében..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
      
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedOrders.length === orders.length && orders.length > 0}
                  indeterminate={selectedOrders.length > 0 && selectedOrders.length < orders.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell><strong>Megrendelés száma</strong></TableCell>
              <TableCell><strong>Ügyfél neve</strong></TableCell>
              <TableCell align="right"><strong>Végösszeg</strong></TableCell>
              <TableCell><strong>Fizetési állapot</strong></TableCell>
              <TableCell><strong>Rendelés állapot</strong></TableCell>
              <TableCell><strong>Módosítva</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    {searchTerm ? 'Nincs találat' : 'Még nincs megrendelés'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const isSelected = selectedOrders.includes(order.id)
                const statusInfo = getStatusInfo(order.status)
                const paymentInfo = getPaymentStatusInfo(order.payment_status)
                
                return (
                  <TableRow
                    key={order.id}
                    hover
                    onClick={() => handleRowClick(order.id)}
                    selected={isSelected}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onClick={(e) => handleSelectOne(order.id, e)}
                      />
                    </TableCell>
                    <TableCell>{order.order_number}</TableCell>
                    <TableCell>{order.customer_name}</TableCell>
                    <TableCell align="right">{formatCurrency(order.final_total)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={paymentInfo.label} 
                        color={paymentInfo.color}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={statusInfo.label} 
                        color={statusInfo.color}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(order.updated_at)}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
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
      )}
    </Box>
  )
}

