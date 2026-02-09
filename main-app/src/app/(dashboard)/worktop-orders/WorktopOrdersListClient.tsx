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
import { toast } from 'react-toastify'
import PaymentConfirmationModal from '../scanner/PaymentConfirmationModal'
import DeleteConfirmationModal from '../orders/DeleteConfirmationModal'
import SmsConfirmationModal from '../scanner/SmsConfirmationModal'
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
  ready_at: string | null
  barcode: string
}

interface WorktopOrdersListClientProps {
  initialOrders: Order[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearchTerm: string
  initialStatusFilter: string
  initialPageSize: number
  machines: Machine[]
}

export default function WorktopOrdersListClient({ 
  initialOrders, 
  totalCount,
  totalPages,
  currentPage, 
  initialSearchTerm,
  initialStatusFilter,
  initialPageSize,
  machines
}: WorktopOrdersListClientProps) {
  const router = useRouter()
  
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '')
  const [mounted, setMounted] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || 'ordered')
  const [pageSize, setPageSize] = useState(initialPageSize || 50)
  const [clientPage, setClientPage] = useState(currentPage)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [smsModalOpen, setSmsModalOpen] = useState(false)
  const [smsEligibleOrders, setSmsEligibleOrders] = useState<any[]>([])
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Ensure client-side only rendering
  useEffect(() => {
    setMounted(true)
  }, [])

  // Debounced search effect - triggers server-side search
  useEffect(() => {
    if (!mounted) return

    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams()
      params.set('page', '1') // Reset to first page when searching
      params.set('limit', pageSize.toString())
      // Always add status param to preserve filter state
      params.set('status', statusFilter)
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim())
      }
      router.push(`/worktop-orders?${params.toString()}`)
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchTerm, statusFilter, pageSize, mounted, router])

  // Update orders when initialOrders prop changes (from server-side search/filter)
  useEffect(() => {
    setOrders(initialOrders)
    setClientPage(currentPage)
  }, [initialOrders, currentPage])

  // Handle status filter change - triggers server-side re-fetch
  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus)
    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('limit', pageSize.toString())
    // Always add status param, even for 'all', so we can distinguish from initial load
    params.set('status', newStatus)
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    }
    router.push(`/worktop-orders?${params.toString()}`)
  }

  // Use server-side filtered and paginated orders (no client-side filtering needed)
  const paginatedOrders = orders



  // Don't render until mounted (avoid hydration errors)
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

  // Handle page change - triggers server-side re-fetch
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    const params = new URLSearchParams()
    params.set('page', value.toString())
    params.set('limit', pageSize.toString())
    // Always add status param to preserve filter state
    params.set('status', statusFilter)
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    }
    router.push(`/worktop-orders?${params.toString()}`)
  }

  // Handle page size change - triggers server-side re-fetch
  const handleLimitChange = (event: any) => {
    const newPageSize = event.target.value
    const params = new URLSearchParams()
    params.set('page', '1') // Reset to first page when changing page size
    params.set('limit', newPageSize.toString())
    // Always add status param to preserve filter state
    params.set('status', statusFilter)
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim())
    }
    router.push(`/worktop-orders?${params.toString()}`)
  }

  // Handle row click (navigate to detail page)
  const handleRowClick = (orderId: string) => {
    router.push(`/worktop-orders/${orderId}`)
  }

  // Handle select all (only filtered orders)
  const handleSelectAll = () => {
    const paginatedIds = paginatedOrders.map(order => order.id)
    if (selectedOrders.length === paginatedIds.length && paginatedIds.length > 0) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(paginatedIds)
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
      // Example: "1106PE-600-38-M (Levágás, #1)" -> "1106PE-600-38-M"
      // Example: "1106PE-600-38-M (Levágás, #1) (Levágás)" -> "1106PE-600-38-M"
      let cleanMaterialName = pricing.material_name
      // Extract base material name (everything before the first parenthesis)
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
      waste_multi: 1
    }))

    // Build services breakdown
    const servicesMap = new Map<string, { quantity: number; net: number; gross: number }>()

    quoteData.pricing?.forEach((p: any) => {
      // Összemarás
      if (p.osszemaras_gross > 0) {
        const existing = servicesMap.get('osszemaras')
        if (existing) {
          existing.quantity += 1
          existing.net += p.osszemaras_net || 0
          existing.gross += p.osszemaras_gross || 0
        } else {
          servicesMap.set('osszemaras', { quantity: 1, net: p.osszemaras_net || 0, gross: p.osszemaras_gross || 0 })
        }
      }

      // Kereszt vágás
      if (p.kereszt_vagas_gross && Number(p.kereszt_vagas_gross) > 0) {
        const existing = servicesMap.get('kereszt_vagas')
        if (existing) {
          existing.quantity += 1
          existing.net += Number(p.kereszt_vagas_net || 0)
          existing.gross += Number(p.kereszt_vagas_gross || 0)
        } else {
          servicesMap.set('kereszt_vagas', { quantity: 1, net: Number(p.kereszt_vagas_net || 0), gross: Number(p.kereszt_vagas_gross || 0) })
        }
        console.log(`[Worktop Receipt] Found Kereszt vágás: gross=${p.kereszt_vagas_gross}, net=${p.kereszt_vagas_net}`)
      }

      // Hosszanti vágás (sum meters)
      if (p.hosszanti_vagas_gross > 0) {
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
          existing.net += p.hosszanti_vagas_net || 0
          existing.gross += p.hosszanti_vagas_gross || 0
        } else {
          servicesMap.set('hosszanti_vagas', { quantity: meters, net: p.hosszanti_vagas_net || 0, gross: p.hosszanti_vagas_gross || 0 })
        }
      }

      // Íves vágás (count R1-R4)
      if (p.ives_vagas_gross > 0) {
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
          existing.net += p.ives_vagas_net || 0
          existing.gross += p.ives_vagas_gross || 0
        } else {
          servicesMap.set('ives_vagas', { quantity: count, net: p.ives_vagas_net || 0, gross: p.ives_vagas_gross || 0 })
        }
      }

      // Szögvágás (count L groups)
      if (p.szogvagas_gross > 0) {
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
          existing.net += p.szogvagas_net || 0
          existing.gross += p.szogvagas_gross || 0
        } else {
          servicesMap.set('szogvagas', { quantity: count, net: p.szogvagas_net || 0, gross: p.szogvagas_gross || 0 })
        }
      }

      // Kivágás (count cutouts)
      if (p.kivagas_gross > 0) {
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
          existing.net += p.kivagas_net || 0
          existing.gross += p.kivagas_gross || 0
        } else {
          servicesMap.set('kivagas', { quantity: count, net: p.kivagas_net || 0, gross: p.kivagas_gross || 0 })
        }
      }

      // Élzáró (sum meters from details)
      if (p.elzaro_gross > 0) {
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
          existing.net += p.elzaro_net || 0
          existing.gross += p.elzaro_gross || 0
        } else {
          servicesMap.set('elzaro', { quantity: meters, net: p.elzaro_net || 0, gross: p.elzaro_gross || 0 })
        }
      }
    })

    // Build services breakdown array
    const servicesBreakdown = Array.from(servicesMap.entries())
      .filter(([serviceType, data]) => data.quantity > 0 || data.gross > 0) // Only include services with quantity or gross > 0
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

        console.log(`[Worktop Receipt] Service: ${serviceType}, quantity: ${data.quantity}, gross: ${data.gross}`)

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
    
    console.log(`[Worktop Receipt] Total services breakdown: ${servicesBreakdown.length}`, servicesBreakdown.map(s => `${s.service_type}: ${s.quantity}`))

    // Attach services to materials (first material gets all services)
    if (materials.length > 0 && servicesBreakdown.length > 0) {
      materials[0].quote_services_breakdown = servicesBreakdown
    }

    return materials
  }

  // Extract printing logic to separate function for reuse
  const printReceiptForOrder = async (orderId: string, order: Order) => {
    console.log('[Worktop Receipt Print] Attempting to print receipt for order:', order.order_number)
    try {
      // Fetch order quote data and tenant company data
      console.log('[Worktop Receipt Print] Fetching data...')
      const [quoteDataResponse, tenantCompanyResponse] = await Promise.all([
        fetch(`/api/worktop-orders/${orderId}/quote-data`),
        fetch('/api/tenant-company')
      ])

      console.log('[Worktop Receipt Print] Fetch responses:', {
        quoteDataOk: quoteDataResponse.ok,
        quoteDataStatus: quoteDataResponse.status,
        tenantCompanyOk: tenantCompanyResponse.ok,
        tenantCompanyStatus: tenantCompanyResponse.status
      })

      if (!quoteDataResponse.ok || !tenantCompanyResponse.ok) {
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
            errorDetails = { ...errorDetails, tenantError: tenantError }
          }
        } catch (e) {
          console.warn('[Worktop Receipt Print] Could not parse error responses:', e)
        }
        
        console.error('[Worktop Receipt Print] Failed to fetch data for printing:', errorDetails)
        toast.error('Nem sikerült betölteni az adatokat a nyomtatáshoz')
        return
      }

      const quoteData = await quoteDataResponse.json()
      const tenantCompany = await tenantCompanyResponse.json()

      console.log('[Worktop Receipt Print] Data fetched successfully:', {
        configsCount: quoteData.configs?.length || 0,
        pricingCount: quoteData.pricing?.length || 0,
        tenantCompanyName: tenantCompany.name
      })

      // Transform worktop data to receipt format
      const pricing = transformWorktopDataToReceiptFormat(quoteData)
      
      console.log('[Worktop Receipt Print] Transformed pricing:', JSON.stringify(pricing, null, 2))

      // Print receipt
      console.log('[Worktop Receipt Print] Calling printOrderReceipt...')
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
        customerName: quoteData.customer?.name || order.customer_name,
        barcode: quoteData.barcode || null,
        pricing: pricing
      })
      console.log('[Worktop Receipt Print] printOrderReceipt completed')
    } catch (error: any) {
      console.error('[Worktop Receipt Print] Error printing receipt:', error)
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
      console.log('[Worktop Orders Bulk Update] Sending request:', {
        order_ids: selectedOrders,
        new_status: newStatus,
        create_payments: createPayments,
        sms_order_ids: smsOrderIds
      })

      const response = await fetch('/api/worktop-orders/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ids: selectedOrders,
          new_status: newStatus,
          create_payments: createPayments,
          sms_order_ids: smsOrderIds
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update orders')
      }

      const result = await response.json()
      console.log('[Worktop Orders Bulk Update] Response:', result)
      
      const statusLabel = newStatus === 'ready' ? 'Gyártás kész' : 
                          newStatus === 'finished' ? 'Megrendelőnek átadva' : 
                          'Törölve'
      
      if (createPayments && result.payments_created > 0) {
        toast.success(
          `${result.updated_count} megrendelés lezárva, ${result.payments_created} fizetés rögzítve`
        )
      } else {
        toast.success(`${result.updated_count} megrendelés frissítve: ${statusLabel}`)
      }

      if (result.sms_notifications) {
        const { sent, failed, errors } = result.sms_notifications
        if (sent > 0) {
          toast.success(`📱 ${sent} SMS értesítés elküldve`, { autoClose: 5000 })
        }
        if (failed > 0) {
          toast.warning(
            `⚠️ ${failed} SMS küldése sikertelen${errors?.length > 0 ? `: ${errors[0]}` : ''}`,
            { autoClose: 7000 }
          )
        }
      }

      // Refresh the page to show updated data
      router.refresh()
      setSelectedOrders([])
    } catch (error) {
      console.error('[Worktop Orders Bulk Update] Error:', error)
      toast.error(error instanceof Error ? error.message : 'Hiba történt a frissítés során')
    } finally {
      setIsUpdating(false)
    }
  }

  // Check SMS eligibility when marking as ready
  const handleMarkAsReady = async () => {
    console.log('[Worktop Orders SMS] handleMarkAsReady called with selected orders:', selectedOrders)
    if (selectedOrders.length === 0) {
      toast.warning('Válassz legalább egy megrendelést')
      return
    }

    try {
      const response = await fetch('/api/worktop-orders/sms-eligible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: selectedOrders })
      })

      if (!response.ok) {
        throw new Error('Failed to check SMS eligibility')
      }

      const result = await response.json()
      const eligibleOrders = result.sms_eligible_orders || []
      console.log('[Worktop Orders SMS] Eligible orders:', eligibleOrders)

      if (eligibleOrders.length > 0) {
        setSmsEligibleOrders(eligibleOrders)
        setSmsModalOpen(true)
      } else {
        await handleBulkStatusUpdate('ready', false, [])
      }
    } catch (error) {
      console.error('[Worktop Orders SMS] Error checking SMS eligibility:', error)
      toast.error('Hiba történt az SMS jogosultság ellenőrzésekor')
    }
  }

  // Handle SMS confirmation
  const handleSmsConfirmation = async (selectedSmsOrderIds: string[]) => {
    console.log('[Worktop Orders SMS] Confirmation received, selected IDs:', selectedSmsOrderIds)
    setSmsModalOpen(false)
    await handleBulkStatusUpdate('ready', false, selectedSmsOrderIds)
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
    const orderToPrint = orderIdToPrint ? orders.find(o => o.id === orderIdToPrint) : null

    // Get full order objects for selected IDs
    const selectedOrderObjects = orders.filter(order => selectedOrders.includes(order.id))

    // Check if any selected orders have unpaid balance (based on payment_status)
    const ordersWithBalance = selectedOrderObjects.filter(
      order => order.payment_status !== 'paid'
    )

    // If no orders with balance, just update status directly
    if (ordersWithBalance.length === 0) {
      console.log('[Receipt Print] No balance - direct update:', {
        selectedOrdersCount: selectedOrders.length,
        orderIdToPrint,
        orderToPrint: orderToPrint ? { id: orderToPrint.id, order_number: orderToPrint.order_number } : null
      })
      
      await handleBulkStatusUpdate('finished', false)
      
      // Print receipt if exactly 1 order was selected (ALWAYS print when 1 order)
      if (orderIdToPrint && orderToPrint) {
        await printReceiptForOrder(orderIdToPrint, orderToPrint)
      } else {
        console.log('[Receipt Print] Skipping print - not exactly 1 order selected')
      }
      return
    }

    // Store USB device in a ref or state so we can use it after modal confirmation
    (window as any).__pendingUsbDevice = usbDevice

    // Show payment confirmation modal (for orders with balance)
    setPaymentModalOpen(true)
  }

  // Handle payment confirmation response
  const handlePaymentConfirmation = async (createPayments: boolean) => {
    setPaymentModalOpen(false)
    
    // IMPORTANT: Store order info BEFORE status update
    const orderIdToPrint = selectedOrders.length === 1 ? selectedOrders[0] : null
    const orderToPrint = orderIdToPrint ? orders.find(o => o.id === orderIdToPrint) : null
    
    // Retrieve the USB device that was requested during the button click
    const usbDevice = (window as any).__pendingUsbDevice || null
    if (usbDevice) {
      console.log('[Receipt Print] Using pre-requested USB device from button click')
    }
    // Clean up
    delete (window as any).__pendingUsbDevice
    
    console.log('[Receipt Print] Starting payment confirmation:', {
      selectedOrdersCount: selectedOrders.length,
      orderIdToPrint,
      orderToPrint: orderToPrint ? { id: orderToPrint.id, order_number: orderToPrint.order_number } : null,
      hasUsbDevice: !!usbDevice
    })
    
    await handleBulkStatusUpdate('finished', createPayments)
    
    // Print receipt if exactly 1 order was selected (ALWAYS print when 1 order)
    if (orderIdToPrint && orderToPrint) {
      await printReceiptForOrder(orderIdToPrint, orderToPrint)
    } else {
      console.log('[Receipt Print] Skipping print - not exactly 1 order selected')
    }
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
          Munkalap
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Munkalap megrendelések
        </Typography>
      </Breadcrumbs>

      {/* Title and Page Size Selector */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Munkalap megrendelések
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
      </Box>
      
      {/* Status Filter Buttons */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ mr: 1, fontWeight: 500 }}>
          Szűrés:
        </Typography>
        <Chip
          label="Összes"
          onClick={() => handleStatusFilterChange('all')}
          color={statusFilter === 'all' ? 'primary' : 'default'}
          variant={statusFilter === 'all' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label="Megrendelve"
          onClick={() => handleStatusFilterChange('ordered')}
          color={statusFilter === 'ordered' ? 'success' : 'default'}
          variant={statusFilter === 'ordered' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label="Gyártásban"
          onClick={() => handleStatusFilterChange('in_production')}
          color={statusFilter === 'in_production' ? 'warning' : 'default'}
          variant={statusFilter === 'in_production' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label="Kész"
          onClick={() => handleStatusFilterChange('ready')}
          color={statusFilter === 'ready' ? 'info' : 'default'}
          variant={statusFilter === 'ready' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label="Lezárva"
          onClick={() => handleStatusFilterChange('finished')}
          color={statusFilter === 'finished' ? 'default' : 'default'}
          variant={statusFilter === 'finished' ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label="Törölve"
          onClick={() => handleStatusFilterChange('cancelled')}
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
        </Box>
      )}

      <TextField
        fullWidth
        placeholder="Keresés ügyfél neve vagy megrendelés száma szerint..."
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
                  checked={selectedOrders.length === paginatedOrders.length && paginatedOrders.length > 0}
                  indeterminate={selectedOrders.length > 0 && selectedOrders.length < paginatedOrders.length}
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
              <TableCell><strong>Gyártás dátuma</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    {searchTerm ? 'Nincs találat' : statusFilter !== 'all' ? 'Nincs ilyen státuszú megrendelés' : 'Még nincs megrendelés'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((order) => {
                const isSelected = selectedOrders.includes(order.id)
                const statusInfo = getStatusInfo(order.status)
                const paymentInfo = getPaymentStatusInfo(order.payment_status)
                
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
                        // Use ready_at if available (most accurate), otherwise fall back to production_date or updated_at
                        const referenceDate = order.ready_at || order.production_date || order.updated_at
                        const today = new Date()
                        today.setHours(0, 0, 0, 0) // Start of today
                        const readyDate = new Date(referenceDate)
                        readyDate.setHours(0, 0, 0, 0) // Start of ready day
                        
                        // Calculate full days difference (0 = same day, 1 = next day)
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
                    
                    {/* Barcode - Display Only */}
                    <TableCell onClick={() => handleRowClick(order.id)}>
                      {order.barcode ? (
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                          {order.barcode}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    
                    {/* Production Date - Display Only */}
                    <TableCell onClick={() => handleRowClick(order.id)}>
                      {order.production_date ? (
                        formatDate(order.production_date)
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {searchTerm || statusFilter !== 'all' 
            ? `Keresési eredmény: ${totalCount} megrendelés` 
            : `Összesen ${totalCount} megrendelés`
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

    </Box>
  )
}
