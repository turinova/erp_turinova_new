'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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
  TextField, 
  InputAdornment, 
  Breadcrumbs, 
  Link, 
  Pagination,
  Alert,
  Chip
} from '@mui/material'
import { 
  Search as SearchIcon, 
  Home as HomeIcon
} from '@mui/icons-material'

interface PortalOrder {
  id: string
  quote_number: string
  submitted_to_company_quote_id: string
  company_quote_number: string
  company_quote_status: string
  final_total_after_discount: number
  submitted_at: string
  companies: {
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
  
  const [orders] = useState<PortalOrder[]>(initialOrders)
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [mounted, setMounted] = useState(false)
  
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

  // Format date-time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get status label and color
  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }> = {
      draft: { label: 'Piszkozat', color: 'warning' },
      ordered: { label: 'Megrendelve', color: 'success' },
      in_production: { label: 'Gyártásban', color: 'info' },
      ready: { label: 'Kész', color: 'primary' },
      finished: { label: 'Átadva', color: 'success' },
      cancelled: { label: 'Törölve', color: 'error' }
    }
    
    return statusMap[status] || { label: status, color: 'default' }
  }

  // Handle search
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

  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/orders?${params.toString()}`)
  }

  // Handle row click
  const handleRowClick = (orderId: string) => {
    router.push(`/saved/${orderId}`)
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Breadcrumbs */}
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

      {/* Page Title */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Elküldött árajánlataim
        </Typography>
      </Box>

      {/* Search */}
      <Box component="form" onSubmit={handleSearch} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Keresés céges árajánlat szám alapján..."
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
      {orders.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {searchTerm ? 'Nincs találat a keresési feltételeknek megfelelően.' : 'Még nincs elküldött árajánlata.'}
        </Alert>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Portál árajánlat</TableCell>
                  <TableCell>Céges árajánlat</TableCell>
                  <TableCell align="right">Végösszeg</TableCell>
                  <TableCell>Státusz</TableCell>
                  <TableCell>Elküldve</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => {
                  const statusDisplay = getStatusDisplay(order.company_quote_status)
                  
                  return (
                    <TableRow
                      key={order.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(order.id)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {order.quote_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium" color="primary">
                          {order.company_quote_number}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(order.final_total_after_discount)}
                        </Typography>
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
                          {formatDateTime(order.submitted_at)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )
                })}
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

          {/* Results Summary */}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Összesen {totalCount} elküldött árajánlat
          </Typography>
        </>
      )}
    </Box>
  )
}

