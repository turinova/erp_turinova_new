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
  order_type?: 'regular' | 'worktop' // Type indicator for worktop orders
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

  // Transform worktop quote data to receipt format
  const transformWorktopDataToReceiptFormat = (quoteData: any) => {
    // Group materials by material_id + assembly_type
    const materialMap = new Map<string, {
      material_name: string
      assembly_type: string
      totalMeters: number
      totalNet: number
      totalGross: number
    }>()

    quoteData.configs?.forEach((config: any) => {
      const pricing = quoteData.pricing?.find((p: any) => p.config_order === config.config_order)
      if (!pricing) return

      const key = `${pricing.material_id}_${config.assembly_type}`
      const existing = materialMap.get(key)

      let meters = 0
      if (config.assembly_type === 'Levágás') {
        meters = config.dimension_a / 1000
      } else if (config.assembly_type === 'Összemarás Balos') {
        meters = (config.dimension_a / 1000) + ((config.dimension_c - (config.dimension_d || 0)) / 1000)
      } else if (config.assembly_type === 'Összemarás jobbos') {
        meters = ((config.dimension_a - (config.dimension_d || 0)) / 1000) + (config.dimension_c / 1000)
      }

      // Clean material name - remove any existing assembly type or config order info
      let cleanMaterialName = pricing.material_name
      const firstParenIndex = cleanMaterialName.indexOf('(')
      if (firstParenIndex > 0) {
        cleanMaterialName = cleanMaterialName.substring(0, firstParenIndex).trim()
      }
      
      if (existing) {
        existing.totalMeters += meters
        existing.totalNet += pricing.anyag_koltseg_net || 0
        existing.totalGross += pricing.anyag_koltseg_gross || 0
      } else {
        materialMap.set(key, {
          material_name: `${cleanMaterialName} (${config.assembly_type})`,
          assembly_type: config.assembly_type,
          totalMeters: meters,
          totalNet: pricing.anyag_koltseg_net || 0,
          totalGross: pricing.anyag_koltseg_gross || 0
        })
      }
    })

    // Build materials array
    const materials = Array.from(materialMap.values()).map((material, index) => ({
      id: `material-${index}`,
      material_name: material.material_name,
      charged_sqm: material.totalMeters, // Using meters as quantity
      boards_used: 0,
      waste_multi: 1,
      quote_services_breakdown: [] // Will be populated below
    }))

    // Build services breakdown
    const servicesMap = new Map<string, { quantity: number; net: number; gross: number }>()

    quoteData.pricing?.forEach((p: any) => {
      // Összemarás
      if (Number(p.osszemaras_gross) > 0) {
        const existing = servicesMap.get('osszemaras')
        if (existing) {
          existing.quantity += 1
          existing.net += Number(p.osszemaras_net) || 0
          existing.gross += Number(p.osszemaras_gross) || 0
        } else {
          servicesMap.set('osszemaras', { quantity: 1, net: Number(p.osszemaras_net) || 0, gross: Number(p.osszemaras_gross) || 0 })
        }
      }

      // Kereszt vágás
      if (Number(p.kereszt_vagas_gross) > 0) {
        const existing = servicesMap.get('kereszt_vagas')
        if (existing) {
          existing.quantity += 1
          existing.net += Number(p.kereszt_vagas_net) || 0
          existing.gross += Number(p.kereszt_vagas_gross) || 0
        } else {
          servicesMap.set('kereszt_vagas', { quantity: 1, net: Number(p.kereszt_vagas_net) || 0, gross: Number(p.kereszt_vagas_gross) || 0 })
        }
      }

      // Hosszanti vágás (sum meters)
      if (Number(p.hosszanti_vagas_gross) > 0) {
        const config = quoteData.configs?.find((c: any) => c.config_order === p.config_order)
        let meters = 0
        if (config) {
          if (config.assembly_type === 'Levágás') {
            meters = config.dimension_a / 1000
          } else if (config.assembly_type === 'Összemarás Balos') {
            meters = (config.dimension_a / 1000) + ((config.dimension_c - (config.dimension_d || 0)) / 1000)
          } else if (config.assembly_type === 'Összemarás jobbos') {
            meters = ((config.dimension_a - (config.dimension_d || 0)) / 1000) + (config.dimension_c / 1000)
          }
        }
        const existing = servicesMap.get('hosszanti_vagas')
        if (existing) {
          existing.quantity += meters
          existing.net += Number(p.hosszanti_vagas_net) || 0
          existing.gross += Number(p.hosszanti_vagas_gross) || 0
        } else {
          servicesMap.set('hosszanti_vagas', { quantity: meters, net: Number(p.hosszanti_vagas_net) || 0, gross: Number(p.hosszanti_vagas_gross) || 0 })
        }
      }

      // Íves vágás (count R1-R4)
      if (Number(p.ives_vagas_gross) > 0) {
        const config = quoteData.configs?.find((c: any) => c.config_order === p.config_order)
        let count = 0
        if (config) {
          if (config.rounding_r1 && config.rounding_r1 > 0) count++
          if (config.rounding_r2 && config.rounding_r2 > 0) count++
          if (config.rounding_r3 && config.rounding_r3 > 0) count++
          if (config.rounding_r4 && config.rounding_r4 > 0) count++
        }
        const existing = servicesMap.get('ives_vagas')
        if (existing) {
          existing.quantity += count
          existing.net += Number(p.ives_vagas_net) || 0
          existing.gross += Number(p.ives_vagas_gross) || 0
        } else {
          servicesMap.set('ives_vagas', { quantity: count, net: Number(p.ives_vagas_net) || 0, gross: Number(p.ives_vagas_gross) || 0 })
        }
      }

      // Szögvágás (count L groups)
      if (Number(p.szogvagas_gross) > 0) {
        const config = quoteData.configs?.find((c: any) => c.config_order === p.config_order)
        let count = 0
        if (config) {
          if (config.cut_l1 && config.cut_l1 > 0 && config.cut_l2 && config.cut_l2 > 0) count++
          if (config.cut_l3 && config.cut_l3 > 0 && config.cut_l4 && config.cut_l4 > 0) count++
          if (config.cut_l5 && config.cut_l5 > 0 && config.cut_l6 && config.cut_l6 > 0) count++
          if (config.cut_l7 && config.cut_l7 > 0 && config.cut_l8 && config.cut_l8 > 0) count++
        }
        const existing = servicesMap.get('szogvagas')
        if (existing) {
          existing.quantity += count
          existing.net += Number(p.szogvagas_net) || 0
          existing.gross += Number(p.szogvagas_gross) || 0
        } else {
          servicesMap.set('szogvagas', { quantity: count, net: Number(p.szogvagas_net) || 0, gross: Number(p.szogvagas_gross) || 0 })
        }
      }

      // Kivágás (count cutouts)
      if (Number(p.kivagas_gross) > 0) {
        const config = quoteData.configs?.find((c: any) => c.config_order === p.config_order)
        let count = 1
        if (config && config.cutouts) {
          try {
            const cutouts = JSON.parse(config.cutouts)
            count = Array.isArray(cutouts) ? cutouts.length : 1
          } catch {
            count = 1
          }
        }
        const existing = servicesMap.get('kivagas')
        if (existing) {
          existing.quantity += count
          existing.net += Number(p.kivagas_net) || 0
          existing.gross += Number(p.kivagas_gross) || 0
        } else {
          servicesMap.set('kivagas', { quantity: count, net: Number(p.kivagas_net) || 0, gross: Number(p.kivagas_gross) || 0 })
        }
      }

      // Élzáró (sum meters from details)
      if (Number(p.elzaro_gross) > 0) {
        const details = p.elzaro_details || ''
        const meterMatches = details.match(/(\d+\.?\d*)m/g)
        let meters = 0
        if (meterMatches) {
          meterMatches.forEach((match: string) => {
            meters += parseFloat(match.replace('m', ''))
          })
        }
        const existing = servicesMap.get('elzaro')
        if (existing) {
          existing.quantity += meters
          existing.net += Number(p.elzaro_net) || 0
          existing.gross += Number(p.elzaro_gross) || 0
        } else {
          servicesMap.set('elzaro', { quantity: meters, net: Number(p.elzaro_net) || 0, gross: Number(p.elzaro_gross) || 0 })
        }
      }
    })

    const servicesBreakdown = Array.from(servicesMap.entries())
      .filter(([serviceType, data]) => data.quantity > 0 || data.gross > 0)
      .map(([serviceType, data], index) => {
        const serviceNames: Record<string, string> = {
          'osszemaras': 'Összemarás',
          'kereszt_vagas': 'Kereszt vágás',
          'hosszanti_vagas': 'Hosszanti vágás',
          'ives_vagas': 'Íves vágás',
          'szogvagas': 'Szögvágás',
          'kivagas': 'Kivágás',
          'elzaro': 'Élzáró'
        }

        const units: Record<string, string> = {
          'osszemaras': 'db',
          'kereszt_vagas': 'db',
          'hosszanti_vagas': 'm',
          'ives_vagas': 'db',
          'szogvagas': 'db',
          'kivagas': 'db',
          'elzaro': 'm'
        }

        return {
          id: `service-${index}`,
          service_type: serviceType,
          quantity: data.quantity,
          unit_price: data.quantity > 0 ? data.gross / data.quantity : 0,
          net_price: data.net,
          vat_amount: data.gross - data.net,
          gross_price: data.gross
        }
      })
   
    // Attach services to materials (first material gets all services)
    if (materials.length > 0 && servicesBreakdown.length > 0) {
      materials[0].quote_services_breakdown = servicesBreakdown
    }

    return materials
  }

  // Extract printing logic to separate function for reuse (same as orders page)
  const printReceiptForOrder = async (orderId: string, order: ScannedOrder, preRequestedUsbDevice?: USBDevice | null) => {
    console.log('[Receipt Print] Attempting to print receipt for order:', order.order_number)
    try {
      // Fetch order quote data and tenant company data
      // Use appropriate endpoint based on order type
      const isWorktop = order.order_type === 'worktop'
      const quoteDataEndpoint = isWorktop 
        ? `/api/worktop-orders/${orderId}/quote-data`
        : `/api/orders/${orderId}/quote-data`
      
      console.log('[Receipt Print] Fetching data...', { isWorktop, endpoint: quoteDataEndpoint })
      const [quoteDataResponse, tenantCompanyResponse] = await Promise.all([
        fetch(quoteDataEndpoint),
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
        isWorktop,
        pricingCount: quoteData.pricing?.length || 0,
        configsCount: quoteData.configs?.length || 0,
        tenantCompanyName: tenantCompany.name
      })

      // Transform worktop data to receipt format if needed
      let pricing = quoteData.pricing || []
      if (isWorktop) {
        pricing = transformWorktopDataToReceiptFormat(quoteData)
        console.log('[Receipt Print] Transformed worktop pricing:', JSON.stringify(pricing, null, 2))
      }

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
        customerName: isWorktop ? (quoteData.customer?.name || order.customer_name) : order.customer_name,
        barcode: quoteData.barcode || null,
        pricing: pricing
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

  const ORDERS_PRINT_GAP_MS = 1000

  const getSelectedOrdersSnapshot = (): ScannedOrder[] =>
    scannedOrders.filter(o => selectedOrders.includes(o.id)).map(o => ({ ...o }))

  const requestUsbPrinterAccess = async (): Promise<USBDevice | null> => {
    try {
      const { getPairedPrinter, requestPrinterAccess } = await import('@/lib/webusb-printer')
      const pairedDevices = await getPairedPrinter()
      if (pairedDevices.length > 0) {
        console.log('[Receipt Print] Using already paired WebUSB device:', pairedDevices[0].productName)
        return pairedDevices[0]
      }
      console.log('[Receipt Print] Requesting WebUSB access immediately (user gesture)...')
      const device = await requestPrinterAccess()
      console.log('[Receipt Print] WebUSB device requested successfully:', device?.productName)
      return device
    } catch (usbError: any) {
      console.warn('[Receipt Print] WebUSB access failed, will use browser print fallback:', usbError.message)
      return null
    }
  }

  const printReceiptsForOrders = async (orders: ScannedOrder[], usbDevice: USBDevice | null) => {
    if (orders.length === 0) return

    console.log(
      '[Receipt Print] Printing receipts for orders:',
      orders.map(o => o.order_number)
    )

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i]
      if (orders.length > 1) {
        toast.info(`Nyomtatás ${i + 1}/${orders.length}: ${order.order_number}`, { autoClose: 4000 })
      }
      await printReceiptForOrder(order.id, order, usbDevice)
      if (i < orders.length - 1) {
        await new Promise(resolve => setTimeout(resolve, ORDERS_PRINT_GAP_MS))
      }
    }
  }

  // Handle finished button click (with payment confirmation)
  const handleFinishedClick = async () => {
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }

    const ordersToPrint = getSelectedOrdersSnapshot()

    // Request WebUSB while user gesture is active (before modals / async API calls)
    const usbDevice = ordersToPrint.length > 0 ? await requestUsbPrinterAccess() : null

    // Check if any selected orders have unpaid balance
    const ordersWithBalance = scannedOrders
      .filter(order => selectedOrders.includes(order.id))
      .filter(order => order.payment_status !== 'paid' && order.remaining_balance > 0)

    // If no orders with balance, just update status directly
    if (ordersWithBalance.length === 0) {
      console.log('[Receipt Print] No balance - direct update:', {
        selectedOrdersCount: selectedOrders.length,
        ordersToPrint: ordersToPrint.map(o => o.order_number)
      })

      const storedOrders = ordersToPrint
      const storedUsbDevice = usbDevice

      await handleBulkStatusUpdate('finished', false)
      await printReceiptsForOrders(storedOrders, storedUsbDevice)
      return
    }

    ;(window as any).__pendingUsbDevice = usbDevice

    // Show payment confirmation modal (for orders with balance)
    setPaymentModalOpen(true)
  }

  // Handle payment confirmation response
  const handlePaymentConfirmation = async (createPayments: boolean) => {
    setPaymentModalOpen(false)

    const ordersToPrint = getSelectedOrdersSnapshot()
    const usbDevice = (window as any).__pendingUsbDevice || null
    if (usbDevice) {
      console.log('[Receipt Print] Using pre-requested USB device from button click')
    }
    delete (window as any).__pendingUsbDevice

    const storedOrders = ordersToPrint
    const storedUsbDevice = usbDevice

    console.log('[Receipt Print] Starting payment confirmation:', {
      selectedOrdersCount: selectedOrders.length,
      ordersToPrint: storedOrders.map(o => o.order_number),
      hasUsbDevice: !!storedUsbDevice
    })

    await handleBulkStatusUpdate('finished', createPayments)
    await printReceiptsForOrders(storedOrders, storedUsbDevice)
  }

  // Handle "Gyártás kész" button click - check for SMS-eligible orders first
  const handleReadyClick = async () => {
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }

    try {
      // Separate regular and worktop orders
      const selectedOrderData = scannedOrders.filter(o => selectedOrders.includes(o.id))
      const regularOrderIds = selectedOrderData.filter(o => o.order_type !== 'worktop').map(o => o.id)
      const worktopOrderIds = selectedOrderData.filter(o => o.order_type === 'worktop').map(o => o.id)

      // Check SMS eligibility for both types
      const smsChecks = []
      if (regularOrderIds.length > 0) {
        smsChecks.push(
          fetch('/api/orders/sms-eligible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_ids: regularOrderIds })
          }).then(r => r.json())
        )
      }
      if (worktopOrderIds.length > 0) {
        smsChecks.push(
          fetch('/api/worktop-orders/sms-eligible', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_ids: worktopOrderIds })
          }).then(r => r.json())
        )
      }

      const smsResults = await Promise.all(smsChecks)
      const allSmsEligibleOrders = smsResults.flatMap(r => r.sms_eligible_orders || [])

      // If there are SMS-eligible orders, show confirmation modal
      if (allSmsEligibleOrders && allSmsEligibleOrders.length > 0) {
        setSmsEligibleOrders(allSmsEligibleOrders)
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
      // Separate regular and worktop orders
      const selectedOrderData = scannedOrders.filter(o => selectedOrders.includes(o.id))
      const regularOrderIds = selectedOrderData.filter(o => o.order_type !== 'worktop').map(o => o.id)
      const worktopOrderIds = selectedOrderData.filter(o => o.order_type === 'worktop').map(o => o.id)

      // Separate SMS order IDs by type
      const regularSmsIds = smsOrderIds.filter(id => regularOrderIds.includes(id))
      const worktopSmsIds = smsOrderIds.filter(id => worktopOrderIds.includes(id))

      // Process regular and worktop orders separately
      const updatePromises = []
      
      if (regularOrderIds.length > 0) {
        updatePromises.push(
          fetch('/api/orders/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
              order_ids: regularOrderIds,
          new_status: newStatus,
          create_payments: createPayments,
              sms_order_ids: regularSmsIds,
              require_in_production: true
            })
          }).then(r => r.json())
        )
      }

      if (worktopOrderIds.length > 0) {
        updatePromises.push(
          fetch('/api/worktop-orders/bulk-status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              order_ids: worktopOrderIds,
              new_status: newStatus,
              create_payments: createPayments,
              sms_order_ids: worktopSmsIds
        })
          }).then(r => r.json())
        )
      }

      const results = await Promise.all(updatePromises)
      
      // Aggregate results
      const totalUpdated = results.reduce((sum, r) => sum + (r.updated_count || 0), 0)
      const totalPaymentsCreated = results.reduce((sum, r) => sum + (r.payments_created || 0), 0)
      const allSmsResults = {
        sent: results.reduce((sum, r) => sum + ((r.sms_notifications?.sent || 0)), 0),
        failed: results.reduce((sum, r) => sum + ((r.sms_notifications?.failed || 0)), 0),
        errors: results.flatMap(r => r.sms_notifications?.errors || [])
      }
      
      const statusLabel = newStatus === 'ready' ? 'Gyártás kész' : 'Megrendelőnek átadva'
      
      // Show summary with payment info if applicable
      if (createPayments && totalPaymentsCreated > 0) {
        toast.success(
          `${totalUpdated} megrendelés lezárva, ${totalPaymentsCreated} fizetés rögzítve`
        )
      } else {
        toast.success(`${totalUpdated} megrendelés frissítve: ${statusLabel}`)
      }

      // Show SMS notification results
      if (allSmsResults.sent > 0 || allSmsResults.failed > 0) {
        if (allSmsResults.sent > 0) {
          toast.success(`📱 ${allSmsResults.sent} SMS értesítés elküldve`, { autoClose: 5000 })
        }
        
        if (allSmsResults.failed > 0) {
          toast.warning(
            `⚠️ ${allSmsResults.failed} SMS küldése sikertelen${allSmsResults.errors.length > 0 ? `: ${allSmsResults.errors[0]}` : ''}`,
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
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Link
                              href={order.order_type === 'worktop' ? `/worktop-orders/${order.id}` : `/orders/${order.id}`}
                            underline="hover"
                            color="primary"
                            sx={{ cursor: 'pointer', fontWeight: 500 }}
                          >
                            {order.order_number}
                          </Link>
                            {order.order_type === 'worktop' && (
                              <Chip 
                                label="Munkalap" 
                                size="small" 
                                color="secondary"
                                sx={{ fontSize: '0.7rem', height: '20px' }}
                              />
                            )}
                          </Box>
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
              {selectedOrders.length > 0 && (
                <>
                  {' '}
                  Átadáskor minden kijelölt megrendelésre nyomtatás (eredeti + vevői példány
                  {selectedOrders.length > 1 ? `, összesen ${selectedOrders.length * 2} blokk` : ''}).
                </>
              )}
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

