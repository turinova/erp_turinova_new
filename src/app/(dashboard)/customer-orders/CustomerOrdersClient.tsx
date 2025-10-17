'use client'

import React, { useState, useEffect } from 'react'
import { Box, Typography, Breadcrumbs, Link, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Pagination, TextField, InputAdornment, Checkbox } from '@mui/material'
import { Home as HomeIcon, Search as SearchIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'

// Types
interface ShopOrderItem {
  id: string
  product_name: string
  sku: string
  type: string
  quantity: number
  status: string
  unit_name: string
  unit_shortform: string
  partner_name: string
  base_price: number
  multiplier: number
  vat_id: string
  currency_id: string
}

interface ShopOrder {
  id: string
  order_number: string
  worker_id: string
  worker_name: string
  worker_nickname: string
  customer_name: string
  customer_email: string
  customer_mobile: string
  customer_discount: number
  billing_name: string
  billing_country: string
  billing_city: string
  billing_postal_code: string
  billing_street: string
  billing_house_number: string
  billing_tax_number: string
  billing_company_reg_number: string
  status: string
  created_at: string
  updated_at: string
  items_count: number
  items: ShopOrderItem[]
}

interface CustomerOrdersClientProps {
  orders: ShopOrder[]
}

export default function CustomerOrdersClient({ orders }: CustomerOrdersClientProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [statusFilter, setStatusFilter] = useState('open')
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  // Ensure client-side only rendering to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render until mounted (avoid hydration errors)
  if (!mounted) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography>Betöltés...</Typography>
      </Box>
    )
  }

  // Filter orders based on search term and status
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.worker_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // Calculate status counts
  const statusCounts = {
    all: orders.length,
    open: orders.filter(o => o.status === 'open').length,
    ordered: orders.filter(o => o.status === 'ordered').length,
    finished: orders.filter(o => o.status === 'finished').length,
    deleted: orders.filter(o => o.status === 'deleted').length
  }

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + pageSize)

  // Status color mapping
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'warning'
      case 'ordered': return 'info'
      case 'finished': return 'success'
      case 'deleted': return 'error'
      default: return 'default'
    }
  }

  // Status text mapping
  const getStatusText = (status: string) => {
    switch (status) {
      case 'open': return 'Nyitott'
      case 'ordered': return 'Rendelve'
      case 'finished': return 'Befejezve'
      case 'deleted': return 'Törölve'
      default: return status
    }
  }

  // Calculate total sum for an order
  const calculateOrderTotal = (order: ShopOrder) => {
    return order.items.reduce((total, item) => {
      const netPrice = item.base_price * item.multiplier
      const grossPrice = netPrice * 1.27 // Assuming 27% VAT
      const itemTotal = grossPrice * item.quantity
      const discountAmount = itemTotal * (order.customer_discount / 100)
      return total + (itemTotal - discountAmount)
    }, 0)
  }

  // Select all functionality
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const allOrderIds = paginatedOrders.map(order => order.id)
      setSelectedOrders(allOrderIds)
    } else {
      setSelectedOrders([])
    }
  }

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  const isAllSelected = paginatedOrders.length > 0 && selectedOrders.length === paginatedOrders.length
  const isIndeterminate = selectedOrders.length > 0 && selectedOrders.length < paginatedOrders.length

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          component={NextLink}
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Ügyfél rendelések
        </Typography>
      </Breadcrumbs>
      
      {/* Status Filter Buttons */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ mr: 1, fontWeight: 500 }}>
          Szűrés:
        </Typography>
        <Chip
          label={`Összes (${statusCounts.all})`}
          onClick={() => setStatusFilter('all')}
          color={statusFilter === 'all' ? 'primary' : 'default'}
          variant={statusFilter === 'all' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Nyitott (${statusCounts.open})`}
          onClick={() => setStatusFilter('open')}
          color={statusFilter === 'open' ? 'primary' : 'default'}
          variant={statusFilter === 'open' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Rendelve (${statusCounts.ordered})`}
          onClick={() => setStatusFilter('ordered')}
          color={statusFilter === 'ordered' ? 'primary' : 'default'}
          variant={statusFilter === 'ordered' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Befejezve (${statusCounts.finished})`}
          onClick={() => setStatusFilter('finished')}
          color={statusFilter === 'finished' ? 'primary' : 'default'}
          variant={statusFilter === 'finished' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Törölve (${statusCounts.deleted})`}
          onClick={() => setStatusFilter('deleted')}
          color={statusFilter === 'deleted' ? 'primary' : 'default'}
          variant={statusFilter === 'deleted' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
      </Box>

      {/* Search Bar */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Keresés rendelésszám, ügyfél vagy dolgozó szerint..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Orders Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Rendelésszám</TableCell>
              <TableCell>Ügyfél</TableCell>
              <TableCell>Dolgozó</TableCell>
              <TableCell>Státusz</TableCell>
              <TableCell>Termékek</TableCell>
              <TableCell align="right">Összesen</TableCell>
              <TableCell>Létrehozva</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedOrders.map((order) => (
              <TableRow 
                key={order.id} 
                hover
                onClick={() => router.push(`/customer-orders/${order.id}`)}
                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#f5f5f5' } }}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedOrders.includes(order.id)}
                    onChange={(e) => {
                      e.stopPropagation()
                      handleSelectOrder(order.id)
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">
                    {order.order_number}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {order.customer_name}
                    </Typography>
                    {order.customer_email && (
                      <Typography variant="caption" color="text.secondary">
                        {order.customer_email}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {order.worker_name}
                    {order.worker_nickname && (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        ({order.worker_nickname})
                      </Typography>
                    )}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={getStatusText(order.status)}
                    color={getStatusColor(order.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {order.items_count} termék
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="bold">
                    {Math.round(calculateOrderTotal(order)).toLocaleString('hu-HU')} Ft
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {new Date(order.created_at).toLocaleDateString('hu-HU')}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(event, value) => setPage(value)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  )
}
