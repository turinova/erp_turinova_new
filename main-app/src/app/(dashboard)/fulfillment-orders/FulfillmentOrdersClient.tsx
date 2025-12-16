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
  Button,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material'
import NextLink from 'next/link'
import { Search as SearchIcon, Home as HomeIcon, Delete as DeleteIcon, Sms as SmsIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material'
import { usePagePermission } from '@/hooks/usePagePermission'
import { toast } from 'react-toastify'
import FulfillmentSmsModal from './FulfillmentSmsModal'

interface CustomerOrder {
  id: string
  order_number: string
  customer_name: string
  total_gross: number
  status: string
  payment_status: 'paid' | 'partial' | 'unpaid'
  created_at: string
  sms_sent_at: string | null
  worker_nickname: string
  worker_color: string
  last_invoice_type?: string | null
}

interface FulfillmentOrdersClientProps {
  initialOrders: CustomerOrder[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearchTerm: string
  initialStatusFilter: string
  initialPageSize?: number
}

export default function FulfillmentOrdersClient({
  initialOrders,
  totalCount,
  totalPages,
  currentPage,
  initialSearchTerm,
  initialStatusFilter,
  initialPageSize = 50
}: FulfillmentOrdersClientProps) {
  const router = useRouter()
  const { hasAccess, loading: permissionLoading } = usePagePermission('/fulfillment-orders')
  
  const [orders, setOrders] = useState<CustomerOrder[]>(initialOrders)
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '')
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || '')
  const [mounted, setMounted] = useState(false)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [clientPage, setClientPage] = useState(currentPage)
  const [loading, setLoading] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [isHandingOver, setIsHandingOver] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [handoverModalOpen, setHandoverModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [smsModalOpen, setSmsModalOpen] = useState(false)
  const [smsEligibleOrders, setSmsEligibleOrders] = useState<any[]>([])
  const [isSendingSms, setIsSendingSms] = useState(false)
  const [ordersWithBalance, setOrdersWithBalance] = useState<Array<{id: string, order_number: string, remaining_balance: number}>>([])
  const [loadingBalance, setLoadingBalance] = useState(false)

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
      if (statusFilter) {
        params.set('status', statusFilter)
      }
      router.push(`/fulfillment-orders?${params.toString()}`)
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchTerm, statusFilter, mounted, router])

  // Update orders when initialOrders prop changes (from server-side search)
  useEffect(() => {
    setOrders(initialOrders)
    setClientPage(currentPage)
    setSelectedOrders([]) // Clear selection when data changes
  }, [initialOrders, currentPage])

  // Count items by status
  const statusCounts = {
    all: orders.length,
    open: orders.filter(o => o.status === 'open').length,
    ordered: orders.filter(o => o.status === 'ordered').length,
    arrived: orders.filter(o => o.status === 'arrived').length,
    handed_over: orders.filter(o => o.status === 'handed_over').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length
  }

  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    const params = new URLSearchParams()
    params.set('page', value.toString())
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    }
    if (statusFilter) {
      params.set('status', statusFilter)
    }
    router.push(`/fulfillment-orders?${params.toString()}`)
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
    if (statusFilter) {
      params.set('status', statusFilter)
    }
    router.push(`/fulfillment-orders?${params.toString()}`)
  }

  // Handle row click (navigate to detail page)
  const handleRowClick = (orderId: string) => {
    router.push(`/fulfillment-orders/${orderId}`)
  }

  // Handle checkbox selection
  const handleSelectAll = () => {
    if (selectedOrders.length === orders.length && orders.length > 0) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(orders.map(o => o.id))
    }
  }

  const handleSelectOrder = (orderId: string) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId))
    } else {
      setSelectedOrders([...selectedOrders, orderId])
    }
  }

  // Check if selected orders can be handed over
  const canHandOver = React.useMemo(() => {
    if (selectedOrders.length === 0) return false
    const selectedOrdersData = orders.filter(o => selectedOrders.includes(o.id))
    return selectedOrdersData.every(o => o.status === 'finished' || o.status === 'arrived')
  }, [selectedOrders, orders])

  // Check if selected orders can be deleted (now allowed in any status)
  const canDelete = React.useMemo(() => {
    if (selectedOrders.length === 0) return false
    return true // Allow deletion in any status
  }, [selectedOrders])

  // Check if selected orders can receive SMS (all must have status 'arrived')
  const canSendSms = React.useMemo(() => {
    if (selectedOrders.length === 0) return false
    const selectedOrdersData = orders.filter(o => selectedOrders.includes(o.id))
    return selectedOrdersData.every(o => o.status === 'arrived')
  }, [selectedOrders, orders])

  // Handle handover - fetch balance info when opening modal
  const handleHandOverClick = async () => {
    if (selectedOrders.length === 0 || !canHandOver) return
    
    // Fetch payment totals to calculate remaining balances
    setLoadingBalance(true)
    try {
      const selectedOrdersData = orders.filter(o => selectedOrders.includes(o.id))
      
      // Fetch payment totals
      const res = await fetch('/api/customer-orders/payment-totals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: selectedOrders })
      })

      if (!res.ok) {
        console.error('Error fetching payment totals')
        // Continue anyway, just won't show balance info
        setOrdersWithBalance([])
      } else {
        const data = await res.json()
        // Calculate remaining balances
        const ordersWithBal = selectedOrdersData.map(order => {
          const totalPaid = data.payment_totals?.[order.id] || 0
          const remainingBalance = order.total_gross - totalPaid
          return {
            id: order.id,
            order_number: order.order_number,
            remaining_balance: remainingBalance
          }
        }).filter(o => o.remaining_balance > 0) // Only show orders with remaining balance
        
        setOrdersWithBalance(ordersWithBal)
      }
    } catch (error) {
      console.error('Error calculating balances:', error)
      setOrdersWithBalance([])
    } finally {
      setLoadingBalance(false)
      setHandoverModalOpen(true)
    }
  }

  // Handover without payment
  const handleHandOverWithoutPayment = async () => {
    setHandoverModalOpen(false)
    setIsHandingOver(true)
    try {
      const res = await fetch('/api/customer-orders/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: selectedOrders })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Hiba az átadás során')
      }

      toast.success(`${selectedOrders.length} rendelés átadva`)
      router.refresh()
      setSelectedOrders([])
      setOrdersWithBalance([])
    } catch (error: any) {
      console.error('Error handing over orders:', error)
      toast.error(error.message || 'Hiba történt az átadás során')
    } finally {
      setIsHandingOver(false)
    }
  }

  // Handover with payment
  const handleHandOverWithPayment = async () => {
    setHandoverModalOpen(false)
    setIsHandingOver(true)
    try {
      const res = await fetch('/api/customer-orders/handover-with-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: selectedOrders })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Hiba az átadás során')
      }

      const paymentCount = data.payment_created_count || 0
      if (paymentCount > 0) {
        toast.success(`${data.handed_over_count} rendelés átadva, ${paymentCount} fizetés létrehozva`)
      } else {
        toast.success(`${data.handed_over_count} rendelés átadva`)
      }
      
      router.refresh()
      setSelectedOrders([])
      setOrdersWithBalance([])
    } catch (error: any) {
      console.error('Error handing over orders with payment:', error)
      toast.error(error.message || 'Hiba történt az átadás során')
    } finally {
      setIsHandingOver(false)
    }
  }

  // Handle SMS eligibility check
  const handleCheckSms = async () => {
    if (selectedOrders.length === 0 || !canSendSms) return

    try {
      const response = await fetch('/api/customer-orders/sms-eligible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: selectedOrders })
      })

      if (!response.ok) {
        throw new Error('Failed to check SMS eligibility')
      }

      const result = await response.json()
      const eligibleOrders = result.sms_eligible_orders || []

      if (eligibleOrders.length > 0) {
        // Show SMS modal
        setSmsEligibleOrders(eligibleOrders)
        setSmsModalOpen(true)
      } else {
        toast.info('Nincs SMS-re jogosult rendelés a kiválasztottak között')
      }
    } catch (error) {
      console.error('Error checking SMS eligibility:', error)
      toast.error('Hiba történt az SMS jogosultság ellenőrzésekor')
    }
  }

  // Handle SMS confirmation
  const handleSmsConfirmation = async (selectedOrderIds: string[]) => {
    setIsSendingSms(true)
    try {
      const response = await fetch('/api/customer-orders/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: selectedOrderIds })
      })

      if (!response.ok) {
        throw new Error('Failed to send SMS')
      }

      const result = await response.json()
      toast.success(`${result.sms_sent_count} SMS elküldve`)
      
      router.refresh()
      setSelectedOrders([])
      setSmsModalOpen(false)
    } catch (error) {
      console.error('Error sending SMS:', error)
      toast.error('Hiba történt az SMS küldése során')
    } finally {
      setIsSendingSms(false)
    }
  }

  // Handle delete
  const handleDeleteClick = () => {
    if (selectedOrders.length === 0 || !canDelete) return
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleteModalOpen(false)
    setIsDeleting(true)
    try {
      const res = await fetch('/api/customer-orders/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: selectedOrders })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Hiba a törlés során')
      }

      toast.success(`${selectedOrders.length} rendelés törölve`)
      router.refresh()
      setSelectedOrders([])
    } catch (error: any) {
      console.error('Error deleting orders:', error)
      toast.error(error.message || 'Hiba történt a törlés során')
    } finally {
      setIsDeleting(false)
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
      case 'open':
        return { label: 'Nyitott', color: 'warning' as const }
      case 'ordered':
        return { label: 'Rendelve', color: 'info' as const }
      case 'arrived':
        return { label: 'Megérkezett', color: 'success' as const }
      case 'finished':
        return { label: 'Befejezve', color: 'success' as const }
      case 'handed_over':
        return { label: 'Átadva', color: 'primary' as const }
      case 'cancelled':
        return { label: 'Törölve', color: 'error' as const }
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
        <Typography color="text.primary">Ügyfél rendelések</Typography>
      </Breadcrumbs>

      <Typography variant="h4" sx={{ mb: 3 }}>
        Ügyfél rendelések
      </Typography>

      {/* Status Filter Buttons */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ mr: 1, fontWeight: 500 }}>
          Szűrés:
        </Typography>
        <Chip
          label={`Összes (${statusCounts.all})`}
          onClick={() => {
            setStatusFilter('')
            const params = new URLSearchParams()
            params.set('page', '1')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/fulfillment-orders?${params.toString()}`)
          }}
          color={statusFilter === '' ? 'primary' : 'default'}
          variant={statusFilter === '' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Nyitott (${statusCounts.open})`}
          onClick={() => {
            setStatusFilter('open')
            const params = new URLSearchParams()
            params.set('page', '1')
            params.set('status', 'open')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/fulfillment-orders?${params.toString()}`)
          }}
          color={statusFilter === 'open' ? 'warning' : 'default'}
          variant={statusFilter === 'open' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Rendelve (${statusCounts.ordered})`}
          onClick={() => {
            setStatusFilter('ordered')
            const params = new URLSearchParams()
            params.set('page', '1')
            params.set('status', 'ordered')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/fulfillment-orders?${params.toString()}`)
          }}
          color={statusFilter === 'ordered' ? 'info' : 'default'}
          variant={statusFilter === 'ordered' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Megérkezett (${statusCounts.arrived})`}
          onClick={() => {
            setStatusFilter('arrived')
            const params = new URLSearchParams()
            params.set('page', '1')
            params.set('status', 'arrived')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/fulfillment-orders?${params.toString()}`)
          }}
          color={statusFilter === 'arrived' ? 'success' : 'default'}
          variant={statusFilter === 'arrived' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Átadva (${statusCounts.handed_over})`}
          onClick={() => {
            setStatusFilter('handed_over')
            const params = new URLSearchParams()
            params.set('page', '1')
            params.set('status', 'handed_over')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/fulfillment-orders?${params.toString()}`)
          }}
          color={statusFilter === 'handed_over' ? 'primary' : 'default'}
          variant={statusFilter === 'handed_over' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Törölve (${statusCounts.cancelled})`}
          onClick={() => {
            setStatusFilter('cancelled')
            const params = new URLSearchParams()
            params.set('page', '1')
            params.set('status', 'cancelled')
            if (searchTerm.trim()) {
              params.set('search', searchTerm.trim())
            }
            router.push(`/fulfillment-orders?${params.toString()}`)
          }}
          color={statusFilter === 'cancelled' ? 'error' : 'default'}
          variant={statusFilter === 'cancelled' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
      </Box>

      {/* Search */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
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

      {/* Bulk Actions */}
      {selectedOrders.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', p: 2, bgcolor: 'primary.lighter', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Tömeges művelet ({selectedOrders.length} kijelölve):
          </Typography>
          {canSendSms && (
            <Button
              variant="contained"
              color="info"
              startIcon={<SmsIcon />}
              onClick={handleCheckSms}
              disabled={isSendingSms}
              size="small"
            >
              SMS értesítés ({selectedOrders.length})
            </Button>
          )}
          {canHandOver && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleHandOverClick}
              disabled={isHandingOver}
              size="small"
            >
              Átadás ({selectedOrders.length})
            </Button>
          )}
          {canDelete && (
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteClick}
              disabled={isDeleting}
              size="small"
            >
              Törlés ({selectedOrders.length})
            </Button>
          )}
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
                    checked={selectedOrders.length === orders.length && orders.length > 0}
                    indeterminate={selectedOrders.length > 0 && selectedOrders.length < orders.length}
                    onChange={handleSelectAll}
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
                <TableCell>SMS értesítés</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    Nincs megjeleníthető rendelés.
                  </TableCell>
                </TableRow>
              ) : orders.map(order => {
                const statusInfo = getStatusInfo(order.status)
                const paymentStatusInfo = getPaymentStatusInfo(order.payment_status)
                const invoiceTypeInfo = getInvoiceTypeChip(order.last_invoice_type)
                const isSelected = selectedOrders.includes(order.id)
                return (
                  <TableRow
                    key={order.id}
                    hover
                    selected={isSelected}
                    onClick={() => handleRowClick(order.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleSelectOrder(order.id)}
                      />
                    </TableCell>
                    <TableCell><strong>{order.order_number}</strong></TableCell>
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
                    <TableCell>
                      {order.sms_sent_at ? (
                        <Tooltip title={formatDateTime(order.sms_sent_at)} arrow>
                          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                        </Tooltip>
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
          {searchTerm || statusFilter
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

      {/* Handover Confirmation Modal */}
      <Dialog
        open={handoverModalOpen}
        onClose={() => {
          setHandoverModalOpen(false)
          setOrdersWithBalance([])
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rendelések átadása</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Biztosan átadod a kiválasztott <strong>{selectedOrders.length} rendelést</strong>?
          </Typography>
          
          {loadingBalance ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : ordersWithBalance.length > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                Fizetés létrehozása ({ordersWithBalance.length} rendelés):
              </Typography>
              <Stack spacing={0.5}>
                {ordersWithBalance.map(order => (
                  <Typography key={order.id} variant="body2" sx={{ pl: 1 }}>
                    • {order.order_number}: {formatCurrency(order.remaining_balance)}
                  </Typography>
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                A "Fizetett átadása" gomb automatikusan létrehozza a készpénzes fizetést a fennmaradó egyenlegre.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            onClick={() => {
              setHandoverModalOpen(false)
              setOrdersWithBalance([])
            }}
            variant="outlined"
            size="large"
            disabled={isHandingOver}
          >
            Mégse
          </Button>
          <Button
            onClick={handleHandOverWithoutPayment}
            variant="contained"
            color="primary"
            size="large"
            disabled={isHandingOver || loadingBalance}
          >
            Fizetés nélküli átadás
          </Button>
          <Button
            onClick={handleHandOverWithPayment}
            variant="contained"
            color="success"
            size="large"
            disabled={isHandingOver || loadingBalance}
          >
            Fizetett átadása
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rendelések törlése</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Ez a művelet visszavonhatatlan!
          </Alert>
          <Typography variant="body1" gutterBottom>
            Biztosan törölni szeretnéd a kiválasztott <strong>{selectedOrders.length} rendelést</strong>?
          </Typography>
          {(() => {
            const selectedOrdersData = orders.filter(o => selectedOrders.includes(o.id))
            const handedOverCount = selectedOrdersData.filter(o => o.status === 'handed_over').length
            const arrivedCount = selectedOrdersData.filter(o => o.status === 'arrived').length
            
            if (handedOverCount > 0 || arrivedCount > 0) {
              return (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {handedOverCount > 0 && (
                      <>
                        <strong>{handedOverCount} rendelés</strong> átadva státuszú - a készlet visszakerül a raktárba.
                        {arrivedCount > 0 && <br />}
                      </>
                    )}
                    {arrivedCount > 0 && (
                      <>
                        <strong>{arrivedCount} rendelés</strong> megérkezett státuszú - a foglalások törlődnek.
                      </>
                    )}
                  </Typography>
                </Box>
              )
            }
            return null
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setDeleteModalOpen(false)}
            variant="outlined"
            size="large"
          >
            Mégse
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            size="large"
            startIcon={<DeleteIcon />}
            disabled={isDeleting}
          >
            Törlés
          </Button>
        </DialogActions>
      </Dialog>

      {/* SMS Modal */}
      <FulfillmentSmsModal
        open={smsModalOpen}
        onClose={() => !isSendingSms && setSmsModalOpen(false)}
        onConfirm={handleSmsConfirmation}
        orders={smsEligibleOrders}
        isProcessing={isSendingSms}
      />
    </Box>
  )
}

