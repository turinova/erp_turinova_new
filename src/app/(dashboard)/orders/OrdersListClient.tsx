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
  FormControl
} from '@mui/material'
import { 
  Search as SearchIcon, 
  Home as HomeIcon
} from '@mui/icons-material'
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { hu } from 'date-fns/locale'
import { toast } from 'react-toastify'

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
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [mounted, setMounted] = useState(false)
  const [savingOrders, setSavingOrders] = useState<Set<string>>(new Set())
  const [defaultBusinessDay, setDefaultBusinessDay] = useState<Date | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ordered')
  
  // Ensure client-side only rendering and calculate default date
  useEffect(() => {
    setMounted(true)
    setDefaultBusinessDay(getNextBusinessDay())
  }, [])

  // Filter orders by status
  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter(order => order.status === statusFilter)

  // Count orders by status
  const statusCounts = {
    all: orders.length,
    ordered: orders.filter(o => o.status === 'ordered').length,
    in_production: orders.filter(o => o.status === 'in_production').length,
    ready: orders.filter(o => o.status === 'ready').length,
    finished: orders.filter(o => o.status === 'finished').length
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

  // Handle search
  const handleSearch = () => {
    const params = new URLSearchParams()
    params.set('page', '1')
    if (searchTerm) {
      params.set('search', searchTerm)
    }
    router.push(`/orders?${params.toString()}`)
  }

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
      </Box>

      <TextField
        fullWidth
        placeholder="Keresés megrendelés szám vagy ügyfél nevében..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
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
              <TableCell><strong>Módosítva</strong></TableCell>
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
                    <TableCell onClick={() => handleRowClick(order.id)}>
                      {formatDate(order.updated_at)}
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
                                width: '150px',
                                backgroundColor: 'white'
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
    </Box>
  )
}
