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
import SmsConfirmationModal from './SmsConfirmationModal'
import { printOrderReceipt } from '@/lib/print-receipt'

// WebUSB API type (available in browsers that support WebUSB)
declare global {
  interface USBDevice {
    vendorId: number
    productId: number
    productName?: string
    manufacturerName?: string
    opened: boolean
    configuration: USBConfiguration | null
    open(): Promise<void>
    close(): Promise<void>
    selectConfiguration(configurationValue: number): Promise<void>
    claimInterface(interfaceNumber: number): Promise<void>
    releaseInterface(interfaceNumber: number): Promise<void>
    transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>
  }
  interface USBConfiguration {
    interfaces: USBInterface[]
  }
  interface USBInterface {
    interfaceNumber: number
    alternates: USBAlternateInterface[]
  }
  interface USBAlternateInterface {
    endpoints: USBEndpoint[]
  }
  interface USBEndpoint {
    endpointNumber: number
    direction: 'in' | 'out'
    type: 'bulk' | 'interrupt' | 'isochronous' | 'control'
    packetSize?: number
  }
  interface USBOutTransferResult {
    status: 'ok' | 'stall' | 'babble'
  }
  interface Navigator {
    usb?: {
      getDevices(): Promise<USBDevice[]>
      requestDevice(options: { filters: Array<{ vendorId?: number; productId?: number }> }): Promise<USBDevice>
    }
  }
}

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

interface SmsEligibleOrder {
  id: string
  order_number: string
  customer_name: string
  customer_mobile: string
}

export default function ScannerClient() {
  const [barcodeInput, setBarcodeInput] = useState('')
  const [scannedOrders, setScannedOrders] = useState<ScannedOrder[]>([])
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [smsModalOpen, setSmsModalOpen] = useState(false)
  const [smsEligibleOrders, setSmsEligibleOrders] = useState<SmsEligibleOrder[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-focus input on mount and after operations
  useEffect(() => {
    inputRef.current?.focus()
  }, [scannedOrders])

  // Normalize barcode input (fix keyboard layout issues from scanner)
  // Some scanners send US key codes but the OS layout maps '-' -> 'ü', '0' -> 'ö', 'Z' -> 'Y'
  const normalizeBarcode = (input: string): string => {
    const charMap: Record<string, string> = {
      'ü': '-',
      'ö': '0',
      'Y': 'Z'  // Hungarian keyboard: scanner sends Z but OS shows Y
    }
    return input
      .split('')
      .map(char => charMap[char] || char)
      .join('')
  }

  // Detect barcode scan (wait for input to stop changing)
  const handleInputChange = (value: string) => {
    const normalizedValue = normalizeBarcode(value)
    console.log('Input changed:', value, 'Normalized:', normalizedValue, 'Length:', normalizedValue.length)
    setBarcodeInput(normalizedValue)

    // Clear previous timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }

    // Set new timeout - trigger scan when input stops changing for 300ms
    scanTimeoutRef.current = setTimeout(() => {
      console.log('Input stable, triggering scan for:', normalizedValue)
      if (normalizedValue.trim().length > 0) {
        handleBarcodeScan(normalizedValue)
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

  // Extract printing logic to separate function for reuse (same as orders page)
  const printReceiptForOrder = async (orderId: string, order: ScannedOrder, preRequestedUsbDevice?: USBDevice | null) => {
    console.log('[Receipt Print] Attempting to print receipt for order:', order.order_number)
    try {
      // Fetch order quote data and tenant company data
      console.log('[Receipt Print] Fetching data...')
      const [quoteDataResponse, tenantCompanyResponse] = await Promise.all([
        fetch(`/api/orders/${orderId}/quote-data`),
        fetch('/api/tenant-company')
      ])

      console.log('[Receipt Print] Fetch responses:', {
        quoteDataOk: quoteDataResponse.ok,
        quoteDataStatus: quoteDataResponse.status,
        tenantCompanyOk: tenantCompanyResponse.ok,
        tenantCompanyStatus: tenantCompanyResponse.status
      })

      if (!quoteDataResponse.ok || !tenantCompanyResponse.ok) {
        // Try to get error details from responses
        let errorDetails = {
          quoteDataStatus: quoteDataResponse.status,
          tenantCompanyStatus: tenantCompanyResponse.status
        }
        
        try {
          if (!quoteDataResponse.ok) {
            const quoteError = await quoteDataResponse.text()
            errorDetails = { ...errorDetails, quoteDataError: quoteError }
          }
          if (!tenantCompanyResponse.ok) {
            const tenantError = await tenantCompanyResponse.text()
            errorDetails = { ...errorDetails, tenantCompanyError: tenantError }
          }
        } catch (e) {
          console.warn('[Receipt Print] Could not parse error responses:', e)
        }
        
        console.error('[Receipt Print] Failed to fetch data for printing:', errorDetails)
        toast.error('Nem sikerült betölteni az adatokat a nyomtatáshoz')
        return
      }

      const quoteData = await quoteDataResponse.json()
      const tenantCompany = await tenantCompanyResponse.json()

      console.log('[Receipt Print] Data fetched successfully:', {
        pricingCount: quoteData.pricing?.length || 0,
        tenantCompanyName: tenantCompany.name
      })

      // Print receipt (pass pre-requested USB device if available)
      console.log('[Receipt Print] Calling printOrderReceipt...')
      await printOrderReceipt({
        tenantCompany: {
          name: tenantCompany.name,
          logo_url: tenantCompany.logo_url,
          postal_code: tenantCompany.postal_code,
          city: tenantCompany.city,
          address: tenantCompany.address,
          phone_number: tenantCompany.phone_number,
          email: tenantCompany.email,
          tax_number: tenantCompany.tax_number
        },
        orderNumber: order.order_number,
        customerName: order.customer_name,
        barcode: quoteData.barcode || null,
        pricing: quoteData.pricing || []
      }, preRequestedUsbDevice)
      console.log('[Receipt Print] printOrderReceipt completed')
    } catch (error: any) {
      console.error('[Receipt Print] Error printing receipt:', error)
      // Show user-friendly error message
      const errorMessage = error?.message || 'Hiba történt a nyomtatás során'
      if (errorMessage.includes('not supported')) {
        toast.warning('A böngésző nem támogatja a közvetlen USB nyomtatást. Kérjük, használja a Chrome vagy Edge böngészőt.')
      } else if (errorMessage.includes('cancelled') || errorMessage.includes('Nincs nyomtató')) {
        toast.info('Nyomtatás megszakítva vagy nincs nyomtató kiválasztva. A böngésző nyomtatási párbeszédablaka megnyílik.')
      } else {
        toast.error(errorMessage)
      }
    }
  }

  // Handle finished button click (with payment confirmation)
  const handleFinishedClick = async () => {
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }

    // IMPORTANT: Request WebUSB access IMMEDIATELY while we still have user gesture
    // This must happen before any async operations to preserve the user gesture chain
    let usbDevice: USBDevice | null = null
    const orderIdToPrint = selectedOrders.length === 1 ? selectedOrders[0] : null
    
    if (orderIdToPrint) {
      try {
        const { getPairedPrinter, requestPrinterAccess } = await import('@/lib/webusb-printer')
        const pairedDevices = await getPairedPrinter()
        if (pairedDevices.length === 0) {
          // Request access now while we have user gesture
          console.log('[Receipt Print] Requesting WebUSB access immediately (user gesture)...')
          try {
            usbDevice = await requestPrinterAccess()
            console.log('[Receipt Print] WebUSB device requested successfully:', usbDevice?.productName)
          } catch (usbError: any) {
            // WebUSB failed, but continue - will use browser print fallback
            console.warn('[Receipt Print] WebUSB access failed, will use browser print fallback:', usbError.message)
          }
        } else {
          usbDevice = pairedDevices[0]
          console.log('[Receipt Print] Using already paired WebUSB device:', usbDevice.productName)
        }
      } catch (usbError: any) {
        console.warn('[Receipt Print] WebUSB setup failed, will use browser print fallback:', usbError.message)
      }
    }

    // IMPORTANT: Store order info BEFORE any async operations
    const orderToPrint = orderIdToPrint ? scannedOrders.find(o => o.id === orderIdToPrint) : null

    // Check if any selected orders have unpaid balance
    const ordersWithBalance = scannedOrders
      .filter(order => selectedOrders.includes(order.id))
      .filter(order => order.payment_status !== 'paid' && order.remaining_balance > 0)

    // If no orders with balance, just update status directly
    if (ordersWithBalance.length === 0) {
      console.log('[Receipt Print] No balance - direct update:', {
        selectedOrdersCount: selectedOrders.length,
        orderIdToPrint,
        orderToPrint: orderToPrint ? { id: orderToPrint.id, order_number: orderToPrint.order_number } : null
      })
      
      // Store order info and USB device before status update (state will be cleared)
      const storedOrderId = orderIdToPrint
      const storedOrder = orderToPrint ? { ...orderToPrint } : null
      const storedUsbDevice = usbDevice
      
      await handleBulkStatusUpdate('finished', false)
      
      // Print receipt if exactly 1 order was selected (ALWAYS print when 1 order)
      // Use stored order info (state was cleared by handleBulkStatusUpdate)
      if (storedOrderId && storedOrder) {
        await printReceiptForOrder(storedOrderId, storedOrder, storedUsbDevice)
      } else {
        console.log('[Receipt Print] Skipping print - not exactly 1 order selected')
      }
      return
    }

    // Store USB device in a ref or state so we can use it after modal confirmation
    // Store it in window object for access after modal
    ;(window as any).__pendingUsbDevice = usbDevice
    ;(window as any).__pendingOrderToPrint = orderToPrint
    ;(window as any).__pendingOrderIdToPrint = orderIdToPrint

    // Show payment confirmation modal (for orders with balance)
    setPaymentModalOpen(true)
  }

  // Handle payment confirmation response
  const handlePaymentConfirmation = async (createPayments: boolean) => {
    setPaymentModalOpen(false)
    
    // IMPORTANT: Store order info BEFORE status update (state will be cleared)
    const orderIdToPrint = selectedOrders.length === 1 ? selectedOrders[0] : null
    const orderToPrint = orderIdToPrint ? scannedOrders.find(o => o.id === orderIdToPrint) : null
    
    // Retrieve the USB device that was requested during the button click
    const usbDevice = (window as any).__pendingUsbDevice || null
    if (usbDevice) {
      console.log('[Receipt Print] Using pre-requested USB device from button click')
    }
    // Clean up window storage
    delete (window as any).__pendingUsbDevice
    delete (window as any).__pendingOrderToPrint
    delete (window as any).__pendingOrderIdToPrint
    
    // Store order info in local variables (state will be cleared by handleBulkStatusUpdate)
    const storedOrderId = orderIdToPrint
    const storedOrder = orderToPrint ? { ...orderToPrint } : null
    const storedUsbDevice = usbDevice
    
    console.log('[Receipt Print] Starting payment confirmation:', {
      selectedOrdersCount: selectedOrders.length,
      orderIdToPrint: storedOrderId,
      orderToPrint: storedOrder ? { id: storedOrder.id, order_number: storedOrder.order_number } : null,
      hasUsbDevice: !!storedUsbDevice
    })
    
    await handleBulkStatusUpdate('finished', createPayments)
    
    // Print receipt if exactly 1 order was selected (ALWAYS print when 1 order)
    // Use stored order info (state was cleared by handleBulkStatusUpdate)
    if (storedOrderId && storedOrder) {
      await printReceiptForOrder(storedOrderId, storedOrder, storedUsbDevice)
    } else {
      console.log('[Receipt Print] Skipping print - not exactly 1 order selected')
    }
  }

  // Handle "Gyártás kész" button click - check for SMS-eligible orders first
  const handleReadyClick = async () => {
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }

    try {
      // Fetch full order details to check for SMS eligibility
      const response = await fetch('/api/orders/sms-eligible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: selectedOrders })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch SMS-eligible orders')
      }

      const { sms_eligible_orders } = await response.json()

      // If there are SMS-eligible orders, show confirmation modal
      if (sms_eligible_orders && sms_eligible_orders.length > 0) {
        setSmsEligibleOrders(sms_eligible_orders)
        setSmsModalOpen(true)
      } else {
        // No SMS-eligible orders, just update status directly
        await handleBulkStatusUpdate('ready', false, [])
      }
    } catch (error) {
      console.error('Error checking SMS eligibility:', error)
      // On error, proceed without SMS
      await handleBulkStatusUpdate('ready', false, [])
    }
  }

  // Handle SMS confirmation response
  const handleSmsConfirmation = async (selectedSmsOrderIds: string[]) => {
    setSmsModalOpen(false)
    await handleBulkStatusUpdate('ready', false, selectedSmsOrderIds)
  }

  // Bulk update status (with optional payment creation and SMS sending)
  const handleBulkStatusUpdate = async (
    newStatus: 'ready' | 'finished',
    createPayments: boolean = false,
    smsOrderIds: string[] = []
  ) => {
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
          create_payments: createPayments,
          sms_order_ids: smsOrderIds,  // Send only selected order IDs for SMS
          require_in_production: true  // Scanner page requires in_production status
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

      // Show SMS notification results
      if (result.sms_notifications) {
        const { sent, failed, errors } = result.sms_notifications
        
        if (sent > 0) {
          toast.success(`📱 ${sent} SMS értesítés elküldve`, { autoClose: 5000 })
        }
        
        if (failed > 0) {
          toast.warning(
            `⚠️ ${failed} SMS küldése sikertelen${errors.length > 0 ? `: ${errors[0]}` : ''}`,
            { autoClose: 7000 }
          )
        }
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
                onClick={handleReadyClick}
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

      {/* SMS Confirmation Modal */}
      <SmsConfirmationModal
        open={smsModalOpen}
        orders={smsEligibleOrders}
        onConfirm={handleSmsConfirmation}
        onClose={() => setSmsModalOpen(false)}
        isProcessing={isUpdating}
      />
    </Box>
  )
}

