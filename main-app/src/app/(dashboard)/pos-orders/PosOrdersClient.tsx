'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Button,
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
  Chip,
  Pagination,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  Stack,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material'
import NextLink from 'next/link'
import { Search as SearchIcon, Home as HomeIcon } from '@mui/icons-material'
import { usePagePermission } from '@/hooks/usePagePermission'
import { toast } from 'react-toastify'

interface PosOrder {
  id: string
  pos_order_number: string
  customer_name: string
  total_gross: number
  status: string
  payment_status: 'paid' | 'partial' | 'unpaid'
  created_at: string
  worker_nickname: string
  worker_color: string
  last_invoice_type?: string | null
}

interface PosOrdersClientProps {
  initialOrders: PosOrder[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearchTerm: string
  initialPageSize?: number
}

export default function PosOrdersClient({
  initialOrders,
  totalCount,
  totalPages,
  currentPage,
  initialSearchTerm,
  initialPageSize = 50
}: PosOrdersClientProps) {
  const router = useRouter()
  const { hasAccess, loading: permissionLoading } = usePagePermission('/pos-orders')
  
  const [orders, setOrders] = useState<PosOrder[]>(initialOrders)
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '')
  const [mounted, setMounted] = useState(false)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [clientPage, setClientPage] = useState(currentPage)
  const [loading, setLoading] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Debounced search effect - triggers server-side search
  useEffect(() => {
    if (!mounted) return

    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams()
      params.set('page', '1') // Reset to first page when searching
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim())
      }
      router.push(`/pos-orders?${params.toString()}`)
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchTerm, mounted, router])

  // Update orders when initialOrders prop changes (from server-side search)
  useEffect(() => {
    setOrders(initialOrders)
    setClientPage(currentPage)
    setSelectedOrderIds(new Set())
  }, [initialOrders, currentPage])

  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    const params = new URLSearchParams()
    params.set('page', value.toString())
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    }
    router.push(`/pos-orders?${params.toString()}`)
  }

  // Handle page size change
  const handleLimitChange = (event: any) => {
    setPageSize(event.target.value)
    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('limit', event.target.value.toString())
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    }
    router.push(`/pos-orders?${params.toString()}`)
  }

  // Handle row click (navigate to detail page)
  const handleRowClick = (orderId: string) => {
    router.push(`/pos-orders/${orderId}`)
  }

  const isAllSelected = orders.length > 0 && orders.every(order => selectedOrderIds.has(order.id))
  const isIndeterminate = selectedOrderIds.size > 0 && !isAllSelected

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrderIds(new Set(orders.map(order => order.id)))
      return
    }
    setSelectedOrderIds(new Set())
  }

  const handleToggleOrderSelection = (orderId: string, checked: boolean) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(orderId)
      else next.delete(orderId)
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (selectedOrderIds.size === 0) return

    setBulkDeleting(true)
    try {
      const response = await fetch('/api/pos-orders/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: Array.from(selectedOrderIds) })
      })
      const data = await response.json()

      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || 'Hiba a torles kozben')
      }

      const deletedCount = Number(data?.deleted_count || 0)
      const blockedCount = Number(data?.blocked_count || 0)
      const alreadyDeletedCount = Number(data?.already_deleted_count || 0)
      const notFoundCount = Number(data?.not_found_count || 0)

      if (deletedCount > 0) {
        toast.success(`${deletedCount} rendelés torolve, keszlet visszairva.`)
      }
      if (blockedCount > 0) {
        toast.warning(`${blockedCount} rendelés nem torolheto (aktiv szamla miatt).`)
      }
      if (alreadyDeletedCount > 0) {
        toast.info(`${alreadyDeletedCount} rendelés mar torolve volt.`)
      }
      if (notFoundCount > 0) {
        toast.info(`${notFoundCount} rendelés nem talalhato.`)
      }

      setDeleteDialogOpen(false)
      setSelectedOrderIds(new Set())
      router.refresh()
    } catch (error: any) {
      toast.error(error?.message || 'Hiba a rendelesek torlese kozben.')
    } finally {
      setBulkDeleting(false)
    }
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'
  }

  // Format date and time
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

  // Get status display info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { label: 'Befejezve', color: 'success' as const }
      case 'cancelled':
        return { label: 'Törölve', color: 'error' as const }
      case 'refunded':
        return { label: 'Visszatérítve', color: 'warning' as const }
      default:
        return { label: status, color: 'default' as const }
    }
  }

  // Get payment status display info
  const getPaymentStatusInfo = (paymentStatus: 'paid' | 'partial' | 'unpaid') => {
    switch (paymentStatus) {
      case 'paid':
        return { label: 'Kifizetve', color: 'success' as const }
      case 'partial':
        return { label: 'Részben fizetve', color: 'warning' as const }
      case 'unpaid':
        return { label: 'Nincs fizetve', color: 'error' as const }
      default:
        return { label: 'Ismeretlen', color: 'default' as const }
    }
  }

  // Get invoice type chip info
  const getInvoiceTypeChip = (invoiceType: string | null | undefined) => {
    if (!invoiceType) return null
    
    switch (invoiceType) {
      case 'szamla':
        return { label: 'Számla', color: 'primary' as const }
      case 'elolegszamla':
        return { label: 'Előleg számla', color: 'warning' as const }
      case 'dijbekero':
        return { label: 'Díjbekérő', color: 'info' as const }
      case 'sztorno':
        return { label: 'Sztornó', color: 'error' as const }
      default:
        return { label: invoiceType, color: 'default' as const }
    }
  }

  if (permissionLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Betöltés...</Typography>
      </Box>
    )
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Nincs jogosultsága az oldal megtekintéséhez.</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={NextLink} href="/home" underline="hover" color="inherit">
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Kezdőlap
        </Link>
        <Typography color="text.primary">Értékesítés</Typography>
        <Typography color="text.primary">Rendelések</Typography>
      </Breadcrumbs>

      <Typography variant="h4" sx={{ mb: 3 }}>
        Rendelések
      </Typography>

      {/* Search */}
      <Stack direction="row" spacing={2} sx={{ mb: 1 }} alignItems="center">
        <TextField
          fullWidth
          size="small"
          placeholder="Keresés ügyfél neve vagy termék neve szerint..."
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
      </Stack>

      {selectedOrderIds.size > 0 && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-start' }}>
          <Button
            variant="contained"
            color="error"
            disabled={bulkDeleting}
            onClick={() => setDeleteDialogOpen(true)}
            sx={{
              whiteSpace: 'nowrap',
              minWidth: 'fit-content',
              flexShrink: 0
            }}
          >
            Torles ({selectedOrderIds.size})
          </Button>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={isIndeterminate}
                    checked={isAllSelected}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell>Rendelés szám</TableCell>
                <TableCell>Ügyfél</TableCell>
                <TableCell align="right">Bruttó összesen</TableCell>
                <TableCell>Státusz</TableCell>
                <TableCell>Fizetési státusz</TableCell>
                <TableCell>Számla</TableCell>
                <TableCell>Dátum</TableCell>
                <TableCell>Dolgozó</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    Nincs megjeleníthető rendelés.
                  </TableCell>
                </TableRow>
              ) : orders.map(order => {
                const statusInfo = getStatusInfo(order.status)
                const paymentStatusInfo = getPaymentStatusInfo(order.payment_status)
                const invoiceTypeInfo = getInvoiceTypeChip(order.last_invoice_type)
                return (
                  <TableRow
                    key={order.id}
                    hover
                    onClick={() => handleRowClick(order.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedOrderIds.has(order.id)}
                        onChange={(e) => handleToggleOrderSelection(order.id, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell><strong>{order.pos_order_number}</strong></TableCell>
                    <TableCell>{order.customer_name}</TableCell>
                    <TableCell align="right">{formatCurrency(order.total_gross)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={statusInfo.label} 
                        size="small"
                        color={statusInfo.color}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={paymentStatusInfo.label} 
                        size="small"
                        color={paymentStatusInfo.color}
                      />
                    </TableCell>
                    <TableCell>
                      {invoiceTypeInfo ? (
                        <Chip 
                          label={invoiceTypeInfo.label} 
                          size="small"
                          color={invoiceTypeInfo.color}
                          variant="outlined"
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(order.created_at)}</TableCell>
                    <TableCell>
                      {order.worker_nickname ? (
                        <Chip 
                          label={order.worker_nickname} 
                          size="small"
                          sx={{
                            backgroundColor: order.worker_color ? `${order.worker_color}20` : undefined,
                            color: order.worker_color || undefined,
                            borderColor: order.worker_color || undefined,
                            borderWidth: order.worker_color ? '1px' : undefined,
                            borderStyle: order.worker_color ? 'solid' : undefined
                          }}
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {searchTerm
            ? `Keresési eredmény: ${totalCount} rendelés` 
            : `Összesen ${totalCount} rendelés`
          }
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 80 }}>
            <Select
              value={pageSize}
              onChange={handleLimitChange}
              displayEmpty
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            Oldal mérete
          </Typography>
        </Box>
        
        <Pagination
          count={totalPages}
          page={clientPage}
          onChange={handlePageChange}
          color="primary"
          showFirstButton
          showLastButton
        />
      </Box>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !bulkDeleting && setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rendelesek torlese</DialogTitle>
        <DialogContent>
          <Typography>
            Biztosan torli a kijelolt rendeleseket? A keszlet mozgasok visszairasra kerulnek.
          </Typography>
          <Typography sx={{ mt: 1, fontWeight: 600 }}>
            Kijelolt rendelesek: {selectedOrderIds.size}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Megjegyzes: amelyik rendeleshez aktiv szamla tartozik, nem torolheto.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={bulkDeleting}>
            Megse
          </Button>
          <Button color="error" variant="contained" onClick={handleBulkDelete} disabled={bulkDeleting}>
            {bulkDeleting ? 'Torles...' : 'Torles'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
