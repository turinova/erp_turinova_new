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
  CircularProgress,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  Button
} from '@mui/material'
import { 
  Search as SearchIcon, 
  Home as HomeIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon,
  Delete as DeleteIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material'
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { hu } from 'date-fns/locale'
import { toast } from 'react-toastify'
import PaymentConfirmationModal from '../scanner/PaymentConfirmationModal'
import DeleteConfirmationModal from './DeleteConfirmationModal'
import SmsConfirmationModal from '../scanner/SmsConfirmationModal'
import StorageReminderModal from './StorageReminderModal'

interface Machine {
  id: string
  machine_name: string
  comment: string | null
  usage_limit_per_day: number
}

interface Order {
  id: string
  order_number: string
  status: string
  payment_status: string
  customer_name: string
  customer_mobile: string
  customer_email: string
  final_total: number
  total_paid: number
  remaining_balance: number
  updated_at: string
  production_machine_id: string | null
  production_machine_name: string | null
  production_date: string | null
  barcode: string
}

interface OrdersListClientProps {
  initialOrders: Order[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearchTerm: string
  machines: Machine[]
}

export default function OrdersListClient({ 
  initialOrders, 
  totalCount, 
  totalPages, 
  currentPage, 
  initialSearchTerm,
  machines
}: OrdersListClientProps) {
  const router = useRouter()
  
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '') // Initialize with server-side search term
  const [mounted, setMounted] = useState(false)
  const [savingOrders, setSavingOrders] = useState<Set<string>>(new Set())
  const [defaultBusinessDay, setDefaultBusinessDay] = useState<Date | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ordered')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [smsModalOpen, setSmsModalOpen] = useState(false)
  const [smsEligibleOrders, setSmsEligibleOrders] = useState<any[]>([])
  const [reminderModalOpen, setReminderModalOpen] = useState(false)
  const [reminderEligibleOrders, setReminderEligibleOrders] = useState<any[]>([])
  const [isUpdating, setIsUpdating] = useState(false)
  const [isSendingReminder, setIsSendingReminder] = useState(false)
  
  // Ensure client-side only rendering and calculate default date
  useEffect(() => {
    setMounted(true)
    setDefaultBusinessDay(getNextBusinessDay())
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
      router.push(`/orders?${params.toString()}`)
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchTerm, mounted, router])

  // Update orders when initialOrders prop changes (from server-side search)
  useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])

  // Filter orders by status (client-side)
  // Note: Search is now handled server-side for both customer names and material names
  const filteredOrders = orders.filter(order => {
    // Filter by status
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    
    return matchesStatus
  })

  // Count orders by status
  const statusCounts = {
    all: orders.length,
    ordered: orders.filter(o => o.status === 'ordered').length,
    in_production: orders.filter(o => o.status === 'in_production').length,
    ready: orders.filter(o => o.status === 'ready').length,
    finished: orders.filter(o => o.status === 'finished').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length
  }

  // Calculate next business day (skip weekends)
  const getNextBusinessDay = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const dayOfWeek = tomorrow.getDay()
    
    // If Saturday (6), add 2 days to get Monday
    if (dayOfWeek === 6) {
      tomorrow.setDate(tomorrow.getDate() + 2)
    }
    // If Sunday (0), add 1 day to get Monday
    else if (dayOfWeek === 0) {
      tomorrow.setDate(tomorrow.getDate() + 1)
    }
    // If Friday (5), add 3 days to get Monday
    else if (dayOfWeek === 5) {
      tomorrow.setDate(tomorrow.getDate() + 3)
    }
    
    return tomorrow
  }

  // Initialize order with defaults if needed
  const getOrderDefaults = (order: Order) => {
    return {
      machine_id: order.production_machine_id || (machines.length > 0 ? machines[0].id : ''),
      date: order.production_date ? new Date(order.production_date) : (defaultBusinessDay || new Date()),
      barcode: order.barcode || ''
    }
  }

  // Don't render DatePickers until mounted (avoid hydration errors)
  if (!mounted) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

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
        return { label: 'Megrendelve', color: 'success' as const }
      case 'in_production':
        return { label: 'Gyártásban', color: 'warning' as const }
      case 'ready':
        return { label: 'Kész', color: 'info' as const }
      case 'finished':
        return { label: 'Lezárva', color: 'default' as const }
      case 'cancelled':
        return { label: 'Törölve', color: 'error' as const }
      default:
        return { label: status, color: 'default' as const }
    }
  }

  // Get payment status display info
  const getPaymentStatusInfo = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'paid':
        return { label: 'Kifizetve', color: 'success' as const }
      case 'partial':
        return { label: 'Részben fizetve', color: 'warning' as const }
      case 'not_paid':
        return { label: 'Nincs fizetve', color: 'error' as const }
      default:
        return { label: paymentStatus, color: 'default' as const }
    }
  }

  // Search is now client-side, no need for navigation

  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    const params = new URLSearchParams()
    params.set('page', value.toString())
    if (searchTerm) {
      params.set('search', searchTerm)
    }
    router.push(`/orders?${params.toString()}`)
  }

  // Handle row click (navigate to detail page)
  const handleRowClick = (orderId: string) => {
    router.push(`/orders/${orderId}`)
  }

  // Handle select all (only filtered orders)
  const handleSelectAll = () => {
    const filteredIds = filteredOrders.map(order => order.id)
    if (selectedOrders.length === filteredIds.length && filteredIds.length > 0) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(filteredIds)
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

  // Save production data
  const saveProductionData = async (
    orderId: string, 
    barcode: string, 
    machineId: string, 
    productionDate: Date
  ) => {
    setSavingOrders(prev => new Set(prev).add(orderId))
    
    try {
      const response = await fetch(`/api/quotes/${orderId}/production`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_machine_id: machineId,
          production_date: productionDate.toISOString().split('T')[0],
          barcode: barcode
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Hiba történt a mentés során'
        const errorDetails = errorData.details || ''
        
        // Check for duplicate barcode constraint
        if (errorDetails.includes('duplicate key') && errorDetails.includes('barcode')) {
          toast.error('Ez a vonalkód már használatban van!')
        } else if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
          toast.error('Ez a vonalkód már használatban van!')
        } else {
          toast.error(`Hiba: ${errorMessage}`)
        }
        return // Don't throw, just return to avoid console errors
      }

      // Update local state
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId
            ? {
                ...order,
                barcode,
                production_machine_id: machineId,
                production_machine_name: machines.find(m => m.id === machineId)?.machine_name || null,
                production_date: productionDate.toISOString().split('T')[0],
                status: 'in_production'
              }
            : order
        )
      )

      toast.success('Gyártás adatok mentve!')
    } catch (error) {
      // Error toast already shown above, no need to log
    } finally {
      setSavingOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(orderId)
        return newSet
      })
    }
  }

  // Handle barcode change
  const handleBarcodeChange = (orderId: string, value: string) => {
    setOrders(prevOrders =>
      prevOrders.map(order =>
        order.id === orderId ? { ...order, barcode: value } : order
      )
    )
  }

  // Handle barcode blur (auto-save or delete)
  const handleBarcodeBlur = async (order: Order) => {
    // If barcode is empty/deleted, clear production data
    if (!order.barcode.trim()) {
      // Only delete if there was existing production data
      if (order.production_machine_id || order.production_date) {
        await deleteProductionData(order.id)
      }
      return
    }

    const defaults = getOrderDefaults(order)
    await saveProductionData(
      order.id,
      order.barcode,
      defaults.machine_id,
      defaults.date
    )
  }

  // Delete production data (revert to ordered)
  const deleteProductionData = async (orderId: string) => {
    setSavingOrders(prev => new Set(prev).add(orderId))
    
    try {
      const response = await fetch(`/api/quotes/${orderId}/production`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete production data')
      }

      // Update local state - clear production fields and revert to ordered
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId
            ? {
                ...order,
                barcode: '',
                production_machine_id: null,
                production_machine_name: null,
                production_date: null,
                status: 'ordered'
              }
            : order
        )
      )

      toast.success('Gyártás adatok törölve, státusz visszaállítva!')
    } catch (error) {
      console.error('Error deleting production data:', error)
      toast.error('Hiba történt a törlés során!')
    } finally {
      setSavingOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(orderId)
        return newSet
      })
    }
  }

  // Handle machine change
  const handleMachineChange = (orderId: string, machineId: string) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) return

    setOrders(prevOrders =>
      prevOrders.map(o =>
        o.id === orderId
          ? { ...o, production_machine_id: machineId }
          : o
      )
    )

    // Auto-save if barcode exists
    if (order.barcode.trim()) {
      const defaults = getOrderDefaults(order)
      saveProductionData(
        orderId,
        order.barcode,
        machineId,
        defaults.date
      )
    }
  }

  // Handle date change
  const handleDateChange = (orderId: string, date: Date | null) => {
    if (!date) return

    const order = orders.find(o => o.id === orderId)
    if (!order) return

    setOrders(prevOrders =>
      prevOrders.map(o =>
        o.id === orderId
          ? { ...o, production_date: date.toISOString().split('T')[0] }
          : o
      )
    )

    // Auto-save if barcode exists
    if (order.barcode.trim()) {
      const defaults = getOrderDefaults(order)
      saveProductionData(
        orderId,
        order.barcode,
        defaults.machine_id,
        date
      )
    }
  }

  // Handle finished button click (with payment confirmation)
  const handleFinishedClick = () => {
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }

    // Get full order objects for selected IDs
    const selectedOrderObjects = orders.filter(order => selectedOrders.includes(order.id))

    // Check if any selected orders have unpaid balance (based on payment_status)
    const ordersWithBalance = selectedOrderObjects.filter(
      order => order.payment_status !== 'paid'
    )

    // If no orders with balance, just update status directly
    if (ordersWithBalance.length === 0) {
      handleBulkStatusUpdate('finished', false)
      return
    }

    // Show payment confirmation modal
    setPaymentModalOpen(true)
  }

  // Handle payment confirmation response
  const handlePaymentConfirmation = async (createPayments: boolean) => {
    setPaymentModalOpen(false)
    await handleBulkStatusUpdate('finished', createPayments)
  }

  // Handle cancel button click (set to cancelled)
  const handleCancelClick = () => {
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }

    // Show delete confirmation modal
    setDeleteModalOpen(true)
  }

  // Handle delete confirmation
  const handleDeleteConfirmation = async () => {
    setDeleteModalOpen(false)
    await handleBulkStatusUpdate('cancelled', false)
  }

  // Check SMS eligibility when marking as ready
  const handleMarkAsReady = async () => {
    console.log('[Orders SMS] handleMarkAsReady called with selected orders:', selectedOrders)
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }

    try {
      // Check which orders are SMS-eligible
      console.log('[Orders SMS] Checking eligibility for orders:', selectedOrders)
      const response = await fetch('/api/orders/sms-eligible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: selectedOrders })
      })

      if (!response.ok) {
        throw new Error('Failed to check SMS eligibility')
      }

      const result = await response.json()
      const eligibleOrders = result.sms_eligible_orders || []
      console.log('[Orders SMS] Eligible orders:', eligibleOrders)

      if (eligibleOrders.length > 0) {
        // Show SMS confirmation modal
        console.log('[Orders SMS] Opening SMS modal with', eligibleOrders.length, 'eligible orders')
        setSmsEligibleOrders(eligibleOrders)
        setSmsModalOpen(true)
      } else {
        // No SMS-eligible orders, proceed directly
        console.log('[Orders SMS] No eligible orders, proceeding without SMS')
        await handleBulkStatusUpdate('ready', false, [])
      }
    } catch (error) {
      console.error('[Orders SMS] Error checking SMS eligibility:', error)
      toast.error('Hiba történt az SMS jogosultság ellenőrzésekor')
    }
  }

  // Handle SMS confirmation
  const handleSmsConfirmation = async (selectedSmsOrderIds: string[]) => {
    console.log('[Orders SMS] Confirmation received, selected IDs:', selectedSmsOrderIds)
    setSmsModalOpen(false)
    await handleBulkStatusUpdate('ready', false, selectedSmsOrderIds)
  }

  // Handle storage reminder button click
  const handleSendReminder = async () => {
    console.log('[Storage Reminder] Button clicked with selected orders:', selectedOrders)
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }

    // Filter to only "ready" (Kész) orders with mobile numbers
    const readyOrders = orders.filter(order => 
      selectedOrders.includes(order.id) && 
      order.status === 'ready'
    )

    console.log('[Storage Reminder] Found', readyOrders.length, 'ready orders')

    if (readyOrders.length === 0) {
      toast.warning('Nincs "Kész" státuszú megrendelés a kiválasztottak között')
      return
    }

    // Get orders with mobile numbers (we'll let the API filter, but show in modal)
    const eligibleOrders = readyOrders
      .filter(order => order.customer_mobile)
      .map(order => ({
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_mobile: order.customer_mobile
      }))

    console.log('[Storage Reminder] Found', eligibleOrders.length, 'orders with mobile numbers')

    if (eligibleOrders.length > 0) {
      setReminderEligibleOrders(eligibleOrders)
      setReminderModalOpen(true)
    } else {
      toast.warning('A kiválasztott "Kész" megrendelések egyikéhez sincs telefonszám')
    }
  }

  // Handle reminder confirmation
  const handleReminderConfirmation = async (selectedReminderOrderIds: string[]) => {
    console.log('[Storage Reminder] Confirmation received, selected IDs:', selectedReminderOrderIds)
    setReminderModalOpen(false)
    setIsSendingReminder(true)

    try {
      const response = await fetch('/api/orders/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ids: selectedReminderOrderIds
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send reminder SMS')
      }

      const result = await response.json()
      console.log('[Storage Reminder] Response:', result)

      if (result.sms_sent > 0) {
        toast.success(`📱 ${result.sms_sent} emlékeztető SMS elküldve`, { autoClose: 5000 })
      }

      if (result.sms_failed > 0) {
        toast.warning(
          `⚠️ ${result.sms_failed} SMS küldése sikertelen${result.errors?.length > 0 ? `: ${result.errors[0]}` : ''}`,
          { autoClose: 7000 }
        )
      }

      if (result.sms_sent === 0 && result.sms_failed === 0) {
        toast.info(result.message || 'Nincs SMS küldve')
      }

    } catch (error) {
      console.error('[Storage Reminder] Error:', error)
      toast.error(error instanceof Error ? error.message : 'Hiba történt az SMS küldése során')
    } finally {
      setIsSendingReminder(false)
    }
  }

  // Bulk update status (with optional payment creation and SMS sending)
  const handleBulkStatusUpdate = async (
    newStatus: 'ready' | 'finished' | 'cancelled', 
    createPayments: boolean = false,
    smsOrderIds: string[] = []
  ) => {
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }

    setIsUpdating(true)

    try {
      console.log('[Orders Bulk Update] Sending request:', {
        order_ids: selectedOrders,
        new_status: newStatus,
        create_payments: createPayments,
        sms_order_ids: smsOrderIds
      })

      const response = await fetch('/api/orders/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ids: selectedOrders,
          new_status: newStatus,
          create_payments: createPayments,
          sms_order_ids: smsOrderIds  // Send SMS-eligible order IDs
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update orders')
      }

      const result = await response.json()
      console.log('[Orders Bulk Update] Response:', result)
      
      const statusLabel = newStatus === 'ready' ? 'Gyártás kész' : 
                          newStatus === 'finished' ? 'Megrendelőnek átadva' : 
                          'Törölve'
      
      // Show summary with payment info if applicable
      if (createPayments && result.payments_created > 0) {
        toast.success(
          `${result.updated_count} megrendelés lezárva, ${result.payments_created} fizetés rögzítve`
        )
      } else {
        toast.success(`${result.updated_count} megrendelés frissítve: ${statusLabel}`)
      }

      // Show SMS notification results
      console.log('[Orders SMS] Checking result.sms_notifications:', result.sms_notifications)
      if (result.sms_notifications) {
        const { sent, failed, errors } = result.sms_notifications
        console.log('[Orders SMS] SMS Results - Sent:', sent, 'Failed:', failed, 'Errors:', errors)
        
        if (sent > 0) {
          console.log('[Orders SMS] Showing success toast for', sent, 'SMS')
          toast.success(`📱 ${sent} SMS értesítés elküldve`, { autoClose: 5000 })
        }
        
        if (failed > 0) {
          console.log('[Orders SMS] Showing warning toast for', failed, 'failed SMS')
          toast.warning(
            `⚠️ ${failed} SMS küldése sikertelen${errors.length > 0 ? `: ${errors[0]}` : ''}`,
            { autoClose: 7000 }
          )
        }
      } else {
        console.log('[Orders SMS] No sms_notifications in response')
      }

      // Reload the page to get fresh data
      router.refresh()
      setSelectedOrders([])

    } catch (error) {
      console.error('Error updating orders:', error)
      toast.error(error instanceof Error ? error.message : 'Hiba történt a frissítés során')
    } finally {
      setIsUpdating(false)
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
          label={`Megrendelve (${statusCounts.ordered})`}
          onClick={() => setStatusFilter('ordered')}
          color={statusFilter === 'ordered' ? 'success' : 'default'}
          variant={statusFilter === 'ordered' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Gyártásban (${statusCounts.in_production})`}
          onClick={() => setStatusFilter('in_production')}
          color={statusFilter === 'in_production' ? 'warning' : 'default'}
          variant={statusFilter === 'in_production' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Kész (${statusCounts.ready})`}
          onClick={() => setStatusFilter('ready')}
          color={statusFilter === 'ready' ? 'info' : 'default'}
          variant={statusFilter === 'ready' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Lezárva (${statusCounts.finished})`}
          onClick={() => setStatusFilter('finished')}
          color={statusFilter === 'finished' ? 'default' : 'default'}
          variant={statusFilter === 'finished' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label={`Törölve (${statusCounts.cancelled})`}
          onClick={() => setStatusFilter('cancelled')}
          color={statusFilter === 'cancelled' ? 'error' : 'default'}
          variant={statusFilter === 'cancelled' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
      </Box>

      {/* Bulk Actions */}
      {selectedOrders.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', p: 2, bgcolor: 'primary.lighter', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Tömeges művelet ({selectedOrders.length} kijelölve):
          </Typography>
          <Button
            variant="contained"
            color="info"
            startIcon={<CheckIcon />}
            onClick={handleMarkAsReady}
            disabled={isUpdating}
            size="small"
          >
            Gyártás kész
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<DoneAllIcon />}
            onClick={handleFinishedClick}
            disabled={isUpdating}
            size="small"
          >
            Megrendelőnek átadva
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleCancelClick}
            disabled={isUpdating}
            size="small"
          >
            Törlés
          </Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={<NotificationsIcon />}
            onClick={handleSendReminder}
            disabled={isSendingReminder}
            size="small"
          >
            SMS emlékeztető
          </Button>
        </Box>
      )}

      <TextField
        fullWidth
        placeholder="Keresés ügyfél neve vagy anyag neve szerint..."
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
                  checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                  indeterminate={selectedOrders.length > 0 && selectedOrders.length < filteredOrders.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell><strong>Megrendelés száma</strong></TableCell>
              <TableCell><strong>Ügyfél neve</strong></TableCell>
              <TableCell align="right"><strong>Végösszeg</strong></TableCell>
              <TableCell><strong>Fizetési állapot</strong></TableCell>
              <TableCell><strong>Rendelés állapot</strong></TableCell>
              <TableCell><strong>Tárolás</strong></TableCell>
              <TableCell><strong>Vonalkód</strong></TableCell>
              <TableCell><strong>Gép</strong></TableCell>
              <TableCell><strong>Gyártás dátuma</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    {searchTerm ? 'Nincs találat' : statusFilter !== 'all' ? 'Nincs ilyen státuszú megrendelés' : 'Még nincs megrendelés'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = selectedOrders.includes(order.id)
                const statusInfo = getStatusInfo(order.status)
                const paymentInfo = getPaymentStatusInfo(order.payment_status)
                const defaults = getOrderDefaults(order)
                const isSaving = savingOrders.has(order.id)
                
                return (
                  <TableRow
                    key={order.id}
                    hover
                    selected={isSelected}
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover .editable-cell': {
                        backgroundColor: 'rgba(0, 0, 0, 0.01)'
                      }
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onClick={(e) => handleSelectOne(order.id, e)}
                      />
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(order.id)}>
                      {order.order_number}
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(order.id)}>
                      <Tooltip
                        title={
                          <>
                            Mobil: {order.customer_mobile || 'Nincs megadva'}
                            <br />
                            Email: {order.customer_email || 'Nincs megadva'}
                          </>
                        }
                        arrow
                        placement="top"
                      >
                        <Box 
                          component="span" 
                          sx={{ 
                            cursor: 'help', 
                            borderBottom: '1px dotted #666',
                            display: 'inline-block',
                            '&:hover': {
                              borderBottom: '1px solid #333'
                            }
                          }}
                        >
                          {order.customer_name}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right" onClick={() => handleRowClick(order.id)}>
                      {formatCurrency(order.final_total)}
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(order.id)}>
                      <Chip 
                        label={paymentInfo.label} 
                        color={paymentInfo.color}
                        size="small"
                      />
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(order.id)}>
                      <Chip 
                        label={statusInfo.label} 
                        color={statusInfo.color}
                        size="small"
                      />
                    </TableCell>
                    
                    {/* Storage Days - Only for 'ready' status */}
                    <TableCell onClick={() => handleRowClick(order.id)}>
                      {order.status === 'ready' ? (() => {
                        // Use production_date if available, otherwise fall back to updated_at
                        const referenceDate = order.production_date || order.updated_at
                        const today = new Date()
                        const readyDate = new Date(referenceDate)
                        const diffTime = today.getTime() - readyDate.getTime()
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
                        
                        // Color coding based on storage days
                        const color = diffDays <= 3 ? 'success' : 
                                      diffDays <= 7 ? 'warning' : 'error'
                        
                        return (
                          <Chip 
                            label={`${diffDays} nap`}
                            color={color}
                            size="small"
                          />
                        )
                      })() : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    
                    {/* Barcode - Editable */}
                    <TableCell 
                      className="editable-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TextField
                        size="small"
                        value={order.barcode}
                        onChange={(e) => handleBarcodeChange(order.id, e.target.value)}
                        onBlur={() => handleBarcodeBlur(order)}
                        placeholder="Vonalkód"
                        disabled={isSaving}
                        sx={{ 
                          width: '140px',
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: 'white'
                          }
                        }}
                        InputProps={{
                          endAdornment: isSaving && (
                            <InputAdornment position="end">
                              <CircularProgress size={16} />
                            </InputAdornment>
                          )
                        }}
                      />
                    </TableCell>
                    
                    {/* Machine - Editable */}
                    <TableCell 
                      className="editable-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FormControl size="small" sx={{ width: '150px' }}>
                        <Select
                          value={defaults.machine_id}
                          onChange={(e) => handleMachineChange(order.id, e.target.value)}
                          disabled={isSaving}
                          sx={{ backgroundColor: 'white' }}
                        >
                          {machines.map((machine) => (
                            <MenuItem key={machine.id} value={machine.id}>
                              {machine.machine_name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    
                    {/* Production Date - Editable */}
                    <TableCell 
                      className="editable-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={hu}>
                        <DatePicker
                          value={defaults.date}
                          onChange={(newDate) => handleDateChange(order.id, newDate)}
                          disabled={isSaving}
                          slotProps={{
                            textField: {
                              size: 'small',
                              sx: { 
                                width: '160px',
                                backgroundColor: 'white',
                                '& .MuiInputBase-input': {
                                  paddingRight: '8px'
                                }
                              }
                            }
                          }}
                        />
                      </LocalizationProvider>
                    </TableCell>
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

      {/* Payment Confirmation Modal */}
      <PaymentConfirmationModal
        open={paymentModalOpen}
        orders={orders
          .filter(order => selectedOrders.includes(order.id))
          .filter(order => order.payment_status !== 'paid')
          .map(order => ({
            id: order.id,
            order_number: order.order_number,
            customer_name: order.customer_name,
            remaining_balance: order.remaining_balance
          }))}
        onConfirm={handlePaymentConfirmation}
        onClose={() => setPaymentModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={deleteModalOpen}
        orderCount={selectedOrders.length}
        onConfirm={handleDeleteConfirmation}
        onClose={() => setDeleteModalOpen(false)}
      />

      {/* SMS Confirmation Modal */}
      <SmsConfirmationModal
        open={smsModalOpen}
        onClose={() => setSmsModalOpen(false)}
        onConfirm={handleSmsConfirmation}
        orders={smsEligibleOrders}
        isProcessing={isUpdating}
      />

      {/* Storage Reminder Modal */}
      <StorageReminderModal
        open={reminderModalOpen}
        onClose={() => setReminderModalOpen(false)}
        onConfirm={handleReminderConfirmation}
        orders={reminderEligibleOrders}
        isProcessing={isSendingReminder}
      />
    </Box>
  )
}

