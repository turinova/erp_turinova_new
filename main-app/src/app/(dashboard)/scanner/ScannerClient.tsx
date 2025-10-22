'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Box, 
  Typography, 
  TextField,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Checkbox,
  Chip,
  IconButton,
  Breadcrumbs,
  Link,
  CircularProgress,
  Tooltip
} from '@mui/material'
import { 
  Home as HomeIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import PaymentConfirmationModal from './PaymentConfirmationModal'

interface ScannedOrder {
  id: string
  order_number: string
  customer_name: string
  final_total: number
  status: string
  payment_status: string
  barcode: string
  updated_at: string
  total_paid: number
  remaining_balance: number
}

export default function ScannerClient() {
  const [barcodeInput, setBarcodeInput] = useState('')
  const [scannedOrders, setScannedOrders] = useState<ScannedOrder[]>([])
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-focus input on mount and after operations
  useEffect(() => {
    inputRef.current?.focus()
  }, [scannedOrders])

  // Detect barcode scan (wait for input to stop changing)
  const handleInputChange = (value: string) => {
    console.log('Input changed:', value, 'Length:', value.length)
    setBarcodeInput(value)

    // Clear previous timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }

    // Set new timeout - trigger scan when input stops changing for 300ms
    scanTimeoutRef.current = setTimeout(() => {
      console.log('Input stable, triggering scan for:', value)
      if (value.trim().length > 0) {
        handleBarcodeScan(value)
      }
    }, 300) // Wait 300ms after last character
  }

  // Handle barcode scan
  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode.trim()) return
    
    // Prevent multiple scans while one is in progress
    if (isLoading) {
      console.log('Scan already in progress, skipping')
      return
    }

    // Clear any pending timeouts
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }

    console.log('Scanning barcode:', barcode)
    setIsLoading(true)

    try {
      // Search for order by barcode
      const url = `/api/orders/search-by-barcode?barcode=${encodeURIComponent(barcode.trim())}`
      console.log('Fetching:', url)
      const response = await fetch(url)
      console.log('Response status:', response.status)

      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Vonalkód nem található')
        } else {
          toast.error('Hiba történt a keresés során')
        }
        setBarcodeInput('')
        setIsLoading(false)
        return
      }

      const order = await response.json()

      // Check if already finished
      if (order.status === 'finished') {
        toast.warning('Ez a megrendelés már lezárva')
        setBarcodeInput('')
        setIsLoading(false)
        return
      }

      // Check if already in list
      if (scannedOrders.some(o => o.id === order.id)) {
        toast.warning('Ez a megrendelés már a listában van')
        setBarcodeInput('')
        setIsLoading(false)
        return
      }

      // Add to list and auto-select
      setScannedOrders(prev => [...prev, order])
      setSelectedOrders(prev => [...prev, order.id])
      
      // Clear input for next scan
      setBarcodeInput('')
      toast.success(`Hozzáadva: ${order.order_number}`)

    } catch (error) {
      console.error('Error scanning barcode:', error)
      toast.error('Hiba történt')
      setBarcodeInput('')
    } finally {
      setIsLoading(false)
    }
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'
  }

  // Format date with time
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
      case 'ordered':
        return { label: 'Megrendelve', color: 'success' as const }
      case 'in_production':
        return { label: 'Gyártásban', color: 'warning' as const }
      case 'ready':
        return { label: 'Gyártás kész', color: 'info' as const }
      case 'finished':
        return { label: 'Megrendelőnek átadva', color: 'default' as const }
      default:
        return { label: status, color: 'default' as const }
    }
  }

  // Get payment status info
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

  // Handle select all
  const handleSelectAll = () => {
    if (selectedOrders.length === scannedOrders.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(scannedOrders.map(o => o.id))
    }
  }

  // Handle select one
  const handleSelectOne = (orderId: string) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId))
    } else {
      setSelectedOrders([...selectedOrders, orderId])
    }
  }

  // Remove from list
  const handleRemove = (orderId: string) => {
    setScannedOrders(scannedOrders.filter(o => o.id !== orderId))
    setSelectedOrders(selectedOrders.filter(id => id !== orderId))
  }

  // Clear all
  const handleClearAll = () => {
    setScannedOrders([])
    setSelectedOrders([])
    setBarcodeInput('')
  }

  // Handle finished button click (with payment confirmation)
  const handleFinishedClick = () => {
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }

    // Check if any selected orders have unpaid balance
    const ordersWithBalance = scannedOrders
      .filter(order => selectedOrders.includes(order.id))
      .filter(order => order.payment_status !== 'paid' && order.remaining_balance > 0)

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

  // Bulk update status (with optional payment creation)
  const handleBulkStatusUpdate = async (newStatus: 'ready' | 'finished', createPayments: boolean = false) => {
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }

    setIsUpdating(true)

    try {
      const response = await fetch('/api/orders/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ids: selectedOrders,
          new_status: newStatus,
          create_payments: createPayments
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update orders')
      }

      const result = await response.json()
      
      const statusLabel = newStatus === 'ready' ? 'Gyártás kész' : 'Megrendelőnek átadva'
      
      // Show summary with payment info if applicable
      if (createPayments && result.payments_created > 0) {
        toast.success(
          `${result.updated_count} megrendelés lezárva, ${result.payments_created} fizetés rögzítve`
        )
      } else {
        toast.success(`${result.updated_count} megrendelés frissítve: ${statusLabel}`)
      }

      // Clear list after successful update
      setScannedOrders([])
      setSelectedOrders([])
      setBarcodeInput('')

    } catch (error) {
      console.error('Error updating orders:', error)
      toast.error(error instanceof Error ? error.message : 'Hiba történt a frissítés során')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
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
        <Typography color="text.primary">
          Scanner
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Scanner
        </Typography>
        {scannedOrders.length > 0 && (
          <Button
            variant="outlined"
            color="error"
            onClick={handleClearAll}
            startIcon={<DeleteIcon />}
          >
            Lista törlése
          </Button>
        )}
      </Box>

      {/* Barcode Input */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Vonalkód beolvasás
        </Typography>
        <TextField
          fullWidth
          inputRef={inputRef}
          value={barcodeInput}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Olvass be egy vonalkódot a fizikai olvasóval..."
          disabled={isLoading || isUpdating}
          autoFocus
          InputProps={{
            endAdornment: isLoading && <CircularProgress size={20} />
          }}
          sx={{ 
            '& .MuiOutlinedInput-root': {
              fontSize: '1.2rem',
              fontWeight: 500
            }
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Használd a fizikai vonalkód olvasót. A megrendelés automatikusan hozzáadódik a listához.
        </Typography>
      </Paper>

      {/* Scanned Orders List */}
      {scannedOrders.length > 0 && (
        <>
          <Paper sx={{ mb: 3 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Beolvasott megrendelések: ({scannedOrders.length})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  onClick={handleSelectAll}
                  variant="outlined"
                >
                  {selectedOrders.length === scannedOrders.length ? 'Kijelölés törlése' : 'Összes kijelölése'}
                </Button>
              </Box>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedOrders.length === scannedOrders.length && scannedOrders.length > 0}
                        indeterminate={selectedOrders.length > 0 && selectedOrders.length < scannedOrders.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell><strong>Megrendelés száma</strong></TableCell>
                    <TableCell><strong>Ügyfél neve</strong></TableCell>
                    <TableCell align="right"><strong>Végösszeg</strong></TableCell>
                    <TableCell><strong>Státusz</strong></TableCell>
                    <TableCell><strong>Fizetés</strong></TableCell>
                    <TableCell><strong>Módosítva</strong></TableCell>
                    <TableCell align="center"><strong>Művelet</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {scannedOrders.map((order) => {
                    const isSelected = selectedOrders.includes(order.id)
                    const statusInfo = getStatusInfo(order.status)
                    const paymentInfo = getPaymentStatusInfo(order.payment_status)

                    return (
                      <TableRow key={order.id} selected={isSelected}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleSelectOne(order.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/orders/${order.id}`}
                            underline="hover"
                            color="primary"
                            sx={{ cursor: 'pointer', fontWeight: 500 }}
                          >
                            {order.order_number}
                          </Link>
                        </TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell align="right">{formatCurrency(order.final_total)}</TableCell>
                        <TableCell>
                          <Chip 
                            label={statusInfo.label} 
                            color={statusInfo.color}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {order.payment_status === 'paid' ? (
                            <Chip 
                              label={paymentInfo.label} 
                              color={paymentInfo.color}
                              size="small"
                            />
                          ) : (
                            <Tooltip
                              title={
                                <>
                                  Végösszeg: {formatCurrency(order.final_total)}
                                  <br />
                                  Eddig fizetve: {formatCurrency(order.total_paid)}
                                  <br />
                                  Hátralék: {formatCurrency(order.remaining_balance)}
                                </>
                              }
                              arrow
                              placement="top"
                            >
                              <Box component="span" sx={{ display: 'inline-block' }}>
                                <Chip 
                                  label={paymentInfo.label} 
                                  color={paymentInfo.color}
                                  size="small"
                                />
                              </Box>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>{formatDateTime(order.updated_at)}</TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => handleRemove(order.id)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Bulk Actions */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Tömeges művelet ({selectedOrders.length} kijelölve)
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                color="info"
                startIcon={<CheckIcon />}
                onClick={() => handleBulkStatusUpdate('ready')}
                disabled={selectedOrders.length === 0 || isUpdating}
                size="large"
              >
                {isUpdating ? 'Frissítés...' : 'Gyártás kész'}
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<DoneAllIcon />}
                onClick={handleFinishedClick}
                disabled={selectedOrders.length === 0 || isUpdating}
                size="large"
              >
                {isUpdating ? 'Frissítés...' : 'Megrendelőnek átadva'}
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              A kijelölt megrendelések státusza frissül, majd a lista automatikusan törlődik.
            </Typography>
          </Paper>
        </>
      )}

      {/* Empty State */}
      {scannedOrders.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Nincs beolvasott megrendelés
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Használd a fizikai vonalkód olvasót a megrendelések beolvasásához.
          </Typography>
        </Paper>
      )}

      {/* Payment Confirmation Modal */}
      <PaymentConfirmationModal
        open={paymentModalOpen}
        orders={scannedOrders
          .filter(order => selectedOrders.includes(order.id))
          .filter(order => order.payment_status !== 'paid' && order.remaining_balance > 0)
          .map(order => ({
            id: order.id,
            order_number: order.order_number,
            customer_name: order.customer_name,
            remaining_balance: order.remaining_balance
          }))}
        onConfirm={handlePaymentConfirmation}
        onClose={() => setPaymentModalOpen(false)}
      />
    </Box>
  )
}

