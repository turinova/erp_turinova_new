'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

import { 
  Box, 
  Typography, 
  Paper,
  Grid,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material'

// Dynamic import for Barcode to avoid SSR issues
const Barcode = dynamic(() => import('react-barcode'), { ssr: false })
import { 
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Print as PrintIcon,
  FileDownload as ExportIcon,
  Payment as PaymentIcon,
  ShoppingCart as OrderIcon,
  Add as AddIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

import { usePermissions } from '@/contexts/PermissionContext'
import QuoteFeesSection from './QuoteFeesSection'
import QuoteAccessoriesSection from './QuoteAccessoriesSection'
import QuoteCuttingListSection from './QuoteCuttingListSection'
import AddFeeModal from './AddFeeModal'
import AddAccessoryModal from './AddAccessoryModal'
import EditDiscountModal from './EditDiscountModal'
import CommentModal from './CommentModal'
import CreateOrderModal from './CreateOrderModal'
import AddPaymentModal from '../../orders/[order_id]/AddPaymentModal'
import AssignProductionModal from '../../orders/[order_id]/AssignProductionModal'

interface Machine {
  id: string
  machine_name: string
  comment: string | null
  usage_limit_per_day: number
}

interface QuoteData {
  id: string
  quote_number: string
  order_number?: string | null
  status: string
  customer_id: string
  discount_percent: number
  comment?: string | null
  payment_status?: string
  production_machine_id?: string | null
  production_date?: string | null
  barcode?: string | null
  production_machine?: {
    id: string
    machine_name: string
  } | null
  customer: {
    id: string
    name: string
    email: string
    mobile: string
    discount_percent: number
    billing_name: string
    billing_country: string
    billing_city: string
    billing_postal_code: string
    billing_street: string
    billing_house_number: string
    billing_tax_number: string
    billing_company_reg_number: string
  }
  tenant_company: {
    id: string
    name: string
    country: string
    postal_code: string
    city: string
    address: string
    phone_number: string
    email: string
    website: string
    tax_number: string
    company_registration_number: string
    vat_id: string
  } | null
  panels: Array<{
    id: string
    material_id: string
    width_mm: number
    height_mm: number
    quantity: number
    label: string
    panthelyfuras_quantity: number
    panthelyfuras_oldal: string
    duplungolas: boolean
    szogvagas: boolean
    material_machine_code?: string
    edge_a_code?: string | null
    edge_b_code?: string | null
    edge_c_code?: string | null
    edge_d_code?: string | null
    materials: {
      id: string
      name: string
      brand_id: string
      length_mm: number
      width_mm: number
      brands: {
        name: string
      }
    }
  }>
  pricing: Array<{
    id: string
    material_id: string
    material_name: string
    board_width_mm: number
    board_length_mm: number
    thickness_mm: number
    grain_direction: boolean
    on_stock: boolean
    boards_used: number
    usage_percentage: number
    pricing_method: string
    charged_sqm: number | null
    price_per_sqm: number
    vat_rate: number
    currency: string
    usage_limit: number
    waste_multi: number
    material_net: number
    material_vat: number
    material_gross: number
    edge_materials_net: number
    edge_materials_vat: number
    edge_materials_gross: number
    cutting_length_m: number
    cutting_net: number
    cutting_vat: number
    cutting_gross: number
    services_net: number
    services_vat: number
    services_gross: number
    total_net: number
    total_vat: number
    total_gross: number
    materials: {
      id: string
      name: string
      brands: {
        name: string
      }
    }
    quote_edge_materials_breakdown: Array<{
      id: string
      edge_material_id: string
      edge_material_name: string
      total_length_m: number
      price_per_m: number
      net_price: number
      vat_amount: number
      gross_price: number
    }>
    quote_services_breakdown: Array<{
      id: string
      service_type: string
      quantity: number
      unit_price: number
      net_price: number
      vat_amount: number
      gross_price: number
    }>
  }>
  fees: Array<{
    id: string
    fee_name: string
    quantity: number
    unit_price_net: number
    vat_rate: number
    vat_amount: number
    gross_price: number
    currency_id: string
    comment: string
  }>
  payments: Array<{
    id: string
    amount: number
    payment_method: string
    comment: string | null
    payment_date: string
    created_by: string
  }>
  accessories: Array<{
    id: string
    accessory_name: string
    sku: string
    quantity: number
    unit_price_net: number
    vat_rate: number
    unit_name: string
    total_net: number
    total_vat: number
    total_gross: number
    currency_id: string
  }>
  totals: {
    total_net: number
    total_vat: number
    total_gross: number
    final_total_after_discount: number
    fees_total_net: number
    fees_total_vat: number
    fees_total_gross: number
    accessories_total_net: number
    accessories_total_vat: number
    accessories_total_gross: number
  }
  created_at: string
  updated_at: string
  ready_notification_sent_at?: string | null
  last_storage_reminder_sent_at?: string | null
}

interface FeeType {
  id: string
  name: string
  net_price: number
  vat_percent: number
  vat_amount: number
  gross_price: number
}

interface Accessory {
  id: string
  name: string
  sku: string
  net_price: number
  vat_id: string
  currency_id: string
  units_id: string
  partners_id: string
  vat_percent: number
  vat_amount: number
  gross_price: number
  unit_name: string
  unit_shortform: string
  currency_name: string
  partner_name: string
}

interface VatRate {
  id: string
  name: string
  kulcs: number
}

interface Currency {
  id: string
  name: string
}

interface Unit {
  id: string
  name: string
  shortform: string
}

interface Partner {
  id: string
  name: string
}

interface QuoteDetailClientProps {
  initialQuoteData: QuoteData
  feeTypes: FeeType[]
  accessories: Accessory[]
  vatRates: VatRate[]
  currencies: Currency[]
  units: Unit[]
  partners: Partner[]
  machines: Machine[]
  isOrderView?: boolean // True when viewing from /orders page
}

export default function QuoteDetailClient({ 
  initialQuoteData,
  feeTypes,
  accessories,
  vatRates,
  currencies,
  units,
  partners,
  machines,
  isOrderView = false
}: QuoteDetailClientProps) {
  const router = useRouter()
  const { canAccess } = usePermissions()
  const hasAccess = canAccess('/quotes')
  
  const [quoteData, setQuoteData] = useState<QuoteData>(initialQuoteData)
  const [isLoading, setIsLoading] = useState(false)
  const [addFeeModalOpen, setAddFeeModalOpen] = useState(false)
  const [addAccessoryModalOpen, setAddAccessoryModalOpen] = useState(false)
  const [discountModalOpen, setDiscountModalOpen] = useState(false)
  const [commentModalOpen, setCommentModalOpen] = useState(false)
  const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false)
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false)
  const [assignProductionModalOpen, setAssignProductionModalOpen] = useState(false)

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
    return date.toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  // Handle back navigation
  const handleBack = () => {
    router.push(isOrderView ? '/orders' : '/quotes')
  }

  // Handle edit optimization
  const handleEditOptimization = () => {
    router.push(`/opti?quote_id=${quoteData.id}`)
  }

  // Handle print - Materialize approach
  const handlePrint = () => {
    // Fix colspan values for totals rows (reduce by 1 since checkbox column is hidden)
    const page2Tables = document.querySelectorAll('.print-page-2 tbody tr:last-child td[colspan]')
    const originalColspans: { element: HTMLElement; value: string | null }[] = []
    
    page2Tables.forEach((cell) => {
      const td = cell as HTMLTableCellElement
      const currentColspan = td.getAttribute('colspan')
      originalColspans.push({ element: td, value: currentColspan })
      
      if (currentColspan) {
        const newColspan = parseInt(currentColspan) - 1
        td.setAttribute('colspan', newColspan.toString())
      }
    })
    
    // Print
    window.print()
    
    // Restore original colspan values after print
    setTimeout(() => {
      originalColspans.forEach(({ element, value }) => {
        if (value) {
          element.setAttribute('colspan', value)
        }
      })
    }, 100)
  }

  // Handle export Excel
  const handleExportExcel = async () => {
    try {
      // Show loading toast
      toast.info('Excel generálása...', {
        position: "top-right",
        autoClose: 2000,
      })

      // Call API to generate Excel
      const response = await fetch(`/api/quotes/${quoteData.id}/export-excel`)
      
      if (!response.ok) {
        throw new Error('Failed to generate Excel')
      }

      // Get the blob from response
      const blob = await response.blob()
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : `quote_${quoteData.quote_number}.xlsx`
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      
      // Cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('Excel sikeresen letöltve!', {
        position: "top-right",
        autoClose: 3000,
      })
    } catch (error) {
      console.error('Error exporting Excel:', error)
      toast.error('Hiba történt az Excel exportálás során!', {
        position: "top-right",
        autoClose: 3000,
      })
    }
  }

  // Handle create order
  const handleCreateOrder = () => {
    setCreateOrderModalOpen(true)
  }

  // Handle order creation success
  const handleOrderCreated = (quoteId: string, orderNumber: string) => {
    // Redirect to order detail page (same ID, different URL)
    router.push(`/orders/${quoteId}`)
  }

  // Handle payment added success
  const handlePaymentAdded = async () => {
    await refreshQuoteData()
  }

  // Handle production assigned success
  const handleProductionAssigned = async () => {
    await refreshQuoteData()
  }

  // Handle refresh quote data
  const refreshQuoteData = async () => {
    try {
      const response = await fetch(`/api/quotes/${quoteData.id}`)
      if (response.ok) {
        const updatedQuote = await response.json()
        setQuoteData(updatedQuote)
      }
    } catch (error) {
      console.error('Error refreshing quote:', error)
    }
  }

  // Handle add fee
  const handleAddFee = () => {
    setAddFeeModalOpen(true)
  }

  // Handle add accessory
  const handleAddAccessory = () => {
    setAddAccessoryModalOpen(true)
  }

  const handleFeeAdded = () => {
    refreshQuoteData()
  }

  const handleAccessoryAdded = () => {
    refreshQuoteData()
  }

  const handleEditDiscount = () => {
    setDiscountModalOpen(true)
  }

  const handleDiscountUpdated = () => {
    refreshQuoteData()
  }

  const handleEditComment = () => {
    setCommentModalOpen(true)
  }

  const handleSaveComment = async (comment: string) => {
    try {
      console.log('[CLIENT] Saving comment for quote:', quoteData.id)
      console.log('[CLIENT] Comment value:', comment)
      console.log('[CLIENT] API URL:', `/api/quotes/${quoteData.id}/comment`)
      
      const response = await fetch(`/api/quotes/${quoteData.id}/comment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment: comment || null }),
      })

      console.log('[CLIENT] Response status:', response.status)
      console.log('[CLIENT] Response ok:', response.ok)

      if (!response.ok) {
        const error = await response.json()
        console.error('[CLIENT] API error response:', error)
        throw new Error(error.error || 'Failed to save comment')
      }

      const result = await response.json()
      console.log('[CLIENT] API success response:', result)

      toast.success('Megjegyzés sikeresen mentve')
      refreshQuoteData()
    } catch (error) {
      console.error('[CLIENT] Error saving comment:', error)
      toast.error(error instanceof Error ? error.message : 'Hiba történt a megjegyzés mentésekor')
      throw error
    }
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography variant="h6" color="error">
          Nincs jogosultsága az Árajánlatok oldal megtekintéséhez!
        </Typography>
      </Box>
    )
  }

  return (
    <>
      {/* Print Styles - Always present in DOM */}
      <style jsx global>{`
        @media print {
          /* Hide everything except print content */
          body * {
            visibility: hidden;
          }
          
          .printable-content,
          .printable-content * {
            visibility: visible;
          }
          
          .printable-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }

          /* Hide non-printable elements */
          .no-print,
          button,
          .MuiIconButton-root,
          .MuiButton-root,
          .MuiCheckbox-root,
          .print-hide-actions {
            display: none !important;
            visibility: hidden !important;
          }

          /* Remove card borders */
          .MuiPaper-root,
          .MuiCard-root {
            border: none !important;
            box-shadow: none !important;
          }

          /* Page breaks */
          .print-page-1 {
            page-break-after: always !important;
            break-after: page !important;
          }

          .print-page-2 {
            page-break-before: always !important;
            break-before: page !important;
          }

          /* Page setup - no top/bottom margins */
          @page {
            size: portrait;
            margin: 0 1cm;
          }

          /* Scale to fit */
          .printable-content {
            transform: scale(0.95);
            transform-origin: top left;
          }

          /* Force customer and billing to stay side-by-side */
          .MuiGrid-item[class*="md-6"] {
            flex: 0 0 50% !important;
            max-width: 50% !important;
          }

          /* Hide titles in fees and accessories cards on page 2 */
          .print-page-2 .MuiCard-root .MuiCardContent-root > div:first-child {
            display: none !important;
          }

          /* Make page 2 cards same width and fit properly */
          .print-page-2 .MuiCard-root {
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
          }

          /* Scale tables uniformly */
          .print-page-2 .MuiTableContainer-root {
            transform: scale(0.8);
            transform-origin: top left;
            width: 125% !important;
          }

          .print-page-2 .MuiTable-root {
            width: 100% !important;
            table-layout: fixed !important;
          }

          .print-page-2 .MuiTableCell-root {
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          /* Hide checkbox columns in tables */
          th:first-child:has(.MuiCheckbox-root),
          td:first-child:has(.MuiCheckbox-root) {
            display: none !important;
          }

          /* Fix totals row to match table width exactly */
          .print-page-2 tbody tr:last-child td:first-child {
            width: auto !important;
          }

          .print-page-2 tbody tr:last-child td:last-child {
            width: auto !important;
          }

          /* Ensure totals row doesn't overflow */
          .print-page-2 tbody tr:last-child {
            display: table-row !important;
          }
        }
      `}</style>

      <Box sx={{ p: 3 }} className="printable-content">
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }} className="no-print">
        <IconButton onClick={handleBack} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          {isOrderView ? `Megrendelés: ${quoteData.order_number || quoteData.quote_number}` : `Árajánlat: ${quoteData.quote_number}`}
        </Typography>
        <Chip 
          label={quoteData.status === 'draft' ? 'Piszkozat' : quoteData.status === 'ordered' ? 'Megrendelve' : quoteData.status === 'in_production' ? 'Gyártásban' : quoteData.status === 'ready' ? 'Leadva' : quoteData.status === 'finished' ? 'Átadva' : quoteData.status} 
          color={quoteData.status === 'draft' ? 'error' : quoteData.status === 'ordered' ? 'success' : quoteData.status === 'in_production' ? 'warning' : quoteData.status === 'finished' ? 'success' : 'info'}
          sx={{ ml: 2 }}
        />
      </Box>

      <Grid container spacing={3}>
        {/* Left Column - Quote Details */}
        <Grid item xs={12} md={9} className="print-full-width">
          {/* Page 1: First Card - All Quote Information */}
          <Paper sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0' }} className="print-page-1">
            {/* Company Info and Barcode */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={quoteData.barcode ? 7 : 12}>
                <Box sx={{ 
                  p: 3, 
                  backgroundColor: '#f5f5f5', 
                  borderRadius: 2,
                  height: '100%'
                }}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {quoteData.tenant_company ? (
                      <>
                        <strong>{quoteData.tenant_company.name}</strong><br />
                        {quoteData.tenant_company.postal_code} {quoteData.tenant_company.city}, {quoteData.tenant_company.address}<br />
                        {quoteData.tenant_company.tax_number && `Adószám: ${quoteData.tenant_company.tax_number}`}<br />
                        {quoteData.tenant_company.company_registration_number && `Cégjegyzékszám: ${quoteData.tenant_company.company_registration_number}`}<br />
                        {quoteData.tenant_company.email && `Email: ${quoteData.tenant_company.email}`}<br />
                        {quoteData.tenant_company.phone_number && `Tel: ${quoteData.tenant_company.phone_number}`}
                      </>
                    ) : (
                      <>
                        Turinova Kft.<br />
                        Budapest, Hungary<br />
                        Adószám: 12345678-1-41
                      </>
                    )}
                  </Typography>
                </Box>
              </Grid>
              
              {/* Barcode Display - Only for orders with barcode */}
              {quoteData.barcode && (
                <Grid item xs={12} md={5}>
                  <Box sx={{ 
                    p: 2, 
                    backgroundColor: '#ffffff', 
                    borderRadius: 2,
                    border: '2px solid #e0e0e0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%'
                  }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                      Vonalkód
                    </Typography>
                    <Barcode 
                      value={quoteData.barcode} 
                      format="CODE128"
                      width={2}
                      height={60}
                      displayValue={true}
                      fontSize={14}
                      margin={5}
                    />
                  </Box>
                </Grid>
              )}
            </Grid>

            {/* Customer & Billing Info */}
            <Grid container spacing={4} sx={{ mb: 4 }}>
              {/* Customer Info */}
              <Grid item xs={12} md={6}>
                <Box sx={{ 
                  p: 2, 
                  border: '1px solid #e0e0e0', 
                  borderRadius: 1,
                  backgroundColor: '#fcfcfc',
                  height: '100%'
                }}>
                  <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                    Ügyfél adatok
                  </Typography>
                  <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                    <strong>{quoteData.customer.name}</strong><br />
                    {quoteData.customer.email}<br />
                    {quoteData.customer.mobile}
                  </Typography>
                </Box>
              </Grid>

              {/* Billing Details */}
              <Grid item xs={12} md={6}>
                <Box sx={{ 
                  p: 2, 
                  border: '1px solid #e0e0e0', 
                  borderRadius: 1,
                  backgroundColor: '#fcfcfc',
                  height: '100%'
                }}>
                  {quoteData.customer.billing_name ? (
                    <>
                      <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                        Számlázási adatok
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        <strong>{quoteData.customer.billing_name}</strong><br />
                        {quoteData.customer.billing_postal_code} {quoteData.customer.billing_city}<br />
                        {quoteData.customer.billing_street} {quoteData.customer.billing_house_number}<br />
                        {quoteData.customer.billing_country}
                        {quoteData.customer.billing_tax_number && (
                          <>
                            <br />Adószám: {quoteData.customer.billing_tax_number}
                          </>
                        )}
                        {quoteData.customer.billing_company_reg_number && (
                          <>
                            <br />Cégjegyzékszám: {quoteData.customer.billing_company_reg_number}
                          </>
                        )}
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                        Számlázási adatok
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        Nincs számlázási adat megadva
                      </Typography>
                    </>
                  )}
                </Box>
              </Grid>
            </Grid>

            {/* Quote Summary */}
            <Divider sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600, textAlign: 'center' }}>
              Árajánlat összesítése
            </Typography>
            
            {/* Materials Breakdown */}
            <Box sx={{ 
              mb: 4, 
              p: 2, 
              border: '1px solid #e0e0e0', 
              borderRadius: 1,
              backgroundColor: '#fcfcfc'
            }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Anyag</strong></TableCell>
                      <TableCell align="right"><strong>Mennyiség</strong></TableCell>
                      <TableCell align="right"><strong>Nettó ár</strong></TableCell>
                      <TableCell align="right"><strong>Bruttó ár</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {quoteData.pricing && quoteData.pricing.length > 0 ? (
                      quoteData.pricing.map((pricing) => (
                        <TableRow key={pricing.id}>
                          <TableCell>{pricing.materials?.name || pricing.material_name}</TableCell>
                          <TableCell align="right">
                            {(() => {
                              const chargedSqm = pricing.charged_sqm || 0
                              const boardsSold = pricing.boards_used || 0
                              
                              // Simple logic: display the stored values
                              return `${chargedSqm.toFixed(2)} m² / ${boardsSold} db`
                            })()}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(pricing.material_net)}</TableCell>
                          <TableCell align="right">{formatCurrency(pricing.material_gross)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Nincs árazási adat elérhető. Ez az árajánlat a régi rendszerben lett mentve.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Services Breakdown */}
            <Box sx={{ 
              mb: 2, 
              p: 2, 
              border: '1px solid #e0e0e0', 
              borderRadius: 1,
              backgroundColor: '#fcfcfc'
            }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Szolgáltatás</strong></TableCell>
                      <TableCell align="right"><strong>Mennyiség</strong></TableCell>
                      <TableCell align="right"><strong>Nettó ár</strong></TableCell>
                      <TableCell align="right"><strong>Bruttó ár</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      if (!quoteData.pricing || quoteData.pricing.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={4} align="center">
                              <Typography variant="body2" color="text.secondary">
                                Nincs szolgáltatási adat elérhető.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )
                      }

                      // Calculate totals from saved breakdown data
                      const totalCuttingCost = quoteData.pricing.reduce((sum, p) => sum + (p.cutting_gross || 0), 0)
                      const totalCuttingNet = quoteData.pricing.reduce((sum, p) => sum + (p.cutting_net || 0), 0)
                      const totalCuttingLength = quoteData.pricing.reduce((sum, p) => sum + (p.cutting_length_m || 0), 0)
                      
                      // Calculate total edge materials from breakdown data
                      let totalEdgeLength = 0
                      let totalEdgeNet = 0
                      let totalEdgeGross = 0
                      
                      quoteData.pricing.forEach(pricing => {
                        if (pricing.quote_edge_materials_breakdown) {
                          pricing.quote_edge_materials_breakdown.forEach(edge => {
                            totalEdgeLength += edge.total_length_m
                            totalEdgeNet += edge.net_price
                            totalEdgeGross += edge.gross_price
                          })
                        }
                      })
                      
                      // Collect all services from breakdown data
                      const allServices: Array<{type: string, quantity: number, net_price: number, gross_price: number}> = []
                      
                      quoteData.pricing.forEach(pricing => {
                        if (pricing.quote_services_breakdown) {
                          pricing.quote_services_breakdown.forEach(service => {
                            const existingService = allServices.find(s => s.type === service.service_type)
                            if (existingService) {
                              existingService.quantity += service.quantity
                              existingService.net_price += service.net_price || 0
                              existingService.gross_price += service.gross_price
                            } else {
                              allServices.push({
                                type: service.service_type,
                                quantity: service.quantity,
                                net_price: service.net_price || 0,
                                gross_price: service.gross_price
                              })
                            }
                          })
                        }
                      })
                      
                      const servicesRows = []
                      
                      // Add cutting cost if exists
                      if (totalCuttingCost > 0) {
                        servicesRows.push(
                          <TableRow key="cutting">
                            <TableCell>Szabás díj</TableCell>
                            <TableCell align="right">{totalCuttingLength.toFixed(2)} m</TableCell>
                            <TableCell align="right">{formatCurrency(totalCuttingNet)}</TableCell>
                            <TableCell align="right">{formatCurrency(totalCuttingCost)}</TableCell>
                          </TableRow>
                        )
                      }
                      
                      // Add total edge materials if exists
                      if (totalEdgeGross > 0) {
                        servicesRows.push(
                          <TableRow key="edge-total">
                            <TableCell>Élzárás</TableCell>
                            <TableCell align="right">{totalEdgeLength.toFixed(2)} m</TableCell>
                            <TableCell align="right">{formatCurrency(totalEdgeNet)}</TableCell>
                            <TableCell align="right">{formatCurrency(totalEdgeGross)}</TableCell>
                          </TableRow>
                        )
                      }
                      
                      // Add individual services
                      allServices.forEach(service => {
                        const serviceName = service.type === 'panthelyfuras' ? 'Pánthely fúrás' :
                                          service.type === 'duplungolas' ? 'Duplung' :
                                          service.type === 'szogvagas' ? 'Szögvágás' : service.type
                        servicesRows.push(
                          <TableRow key={service.type}>
                            <TableCell>{serviceName}</TableCell>
                            <TableCell align="right">{service.quantity} {service.type === 'duplungolas' ? 'm²' : 'db'}</TableCell>
                            <TableCell align="right">{formatCurrency(service.net_price)}</TableCell>
                            <TableCell align="right">{formatCurrency(service.gross_price)}</TableCell>
                          </TableRow>
                        )
                      })
                      
                      return servicesRows.length > 0 ? servicesRows : (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            <Typography variant="body2" color="text.secondary">
                              Nincs szolgáltatási adat elérhető.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )
                    })()}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>


            {/* Totals Summary */}
            <Box>
              {/* Calculate components */}
              {(() => {
                const materialsGross = quoteData.totals.total_gross
                const feesGross = quoteData.totals.fees_total_gross || 0
                const accessoriesGross = quoteData.totals.accessories_total_gross || 0
                
                // Only positive values get discount
                const feesPositive = Math.max(0, feesGross)
                const accessoriesPositive = Math.max(0, accessoriesGross)
                const feesNegative = Math.min(0, feesGross)
                const accessoriesNegative = Math.min(0, accessoriesGross)
                
                const subtotal = materialsGross + feesPositive + accessoriesPositive
                const discountAmount = subtotal * (quoteData.discount_percent / 100)
                const finalTotal = subtotal - discountAmount + feesNegative + accessoriesNegative
                
                return (
                  <>
                    {/* Item Breakdown with Frame */}
                    <Box sx={{ 
                      p: 2, 
                      mb: 2, 
                      border: '1px solid #e0e0e0', 
                      borderRadius: 1,
                      backgroundColor: '#fafafa'
                    }}>
                      {/* Materials */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body1" fontWeight="600">
                          Lapszabászat:
                        </Typography>
                        <Typography variant="body1" fontWeight="600">
                          {formatCurrency(materialsGross)}
                        </Typography>
                      </Box>

                      {/* Fees */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body1" fontWeight="600">
                          Díjak:
                        </Typography>
                        <Typography variant="body1" fontWeight="600">
                          {formatCurrency(feesGross)}
                        </Typography>
                      </Box>

                      {/* Accessories */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0 }}>
                        <Typography variant="body1" fontWeight="600">
                          Termékek:
                        </Typography>
                        <Typography variant="body1" fontWeight="600">
                          {formatCurrency(accessoriesGross)}
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    {/* Subtotal, Discount, Final Total Frame */}
                    <Box sx={{ 
                      p: 2, 
                      border: '1px solid #e0e0e0', 
                      borderRadius: 1,
                      backgroundColor: '#fcfcfc'
                    }}>
                      {/* Subtotal */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body1" fontWeight="700">
                          Részösszeg:
                        </Typography>
                        <Typography variant="body1" fontWeight="700">
                          {formatCurrency(subtotal)}
                        </Typography>
                      </Box>

                      {/* Discount */}
                      {quoteData.discount_percent > 0 && (
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          mb: 2,
                          p: 1,
                          backgroundColor: '#f5f5f5',
                          borderRadius: 1,
                          border: '1px solid #d0d0d0'
                        }}>
                          <Typography variant="body1" fontWeight="700">
                            Kedvezmény ({quoteData.discount_percent}%):
                          </Typography>
                          <Typography variant="body1" fontWeight="700">
                            -{formatCurrency(discountAmount)}
                          </Typography>
                        </Box>
                      )}

                      <Divider sx={{ my: 2 }} />

                      {/* Final total - highlighted */}
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        p: 1.5,
                        backgroundColor: '#e8e8e8',
                        borderRadius: 1,
                        border: '1px solid #c0c0c0'
                      }}>
                        <Typography variant="h6" fontWeight="700">
                          Végösszeg:
                        </Typography>
                        <Typography variant="h6" fontWeight="700">
                          {formatCurrency(finalTotal)}
                        </Typography>
                      </Box>
                    </Box>
                  </>
                )
              })()}
            </Box>
          </Paper>

          {/* Page 2: Second Card (Fees) and Third Card (Accessories) */}
          <Box className="print-page-2">
            {/* Second Card: Fees Section */}
            <QuoteFeesSection
              quoteId={quoteData.id}
              fees={quoteData.fees}
              onFeesChange={handleFeeAdded}
              onAddFeeClick={handleAddFee}
            />

            {/* Third Card: Accessories Section */}
            <QuoteAccessoriesSection
              quoteId={quoteData.id}
              accessories={quoteData.accessories}
              onAccessoriesChange={handleAccessoryAdded}
              onAddAccessoryClick={handleAddAccessory}
            />

            {/* Comment Card - Only shown if comment exists */}
            {quoteData.comment && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Megjegyzés
                  </Typography>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'grey.50',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}
                  >
                    <Typography variant="body2">
                      {quoteData.comment}
                    </Typography>
                  </Paper>
                </CardContent>
              </Card>
            )}

            {/* Fourth Card: Cutting List Section */}
            <QuoteCuttingListSection
              panels={quoteData.panels}
            />
          </Box>
        </Grid>

        {/* Right Column - Actions */}
        <Grid item xs={12} md={3} className="print-hide-actions">
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Műveletek
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Opti szerkesztés - disabled if in_production or later */}
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={handleEditOptimization}
                  fullWidth
                  disabled={isOrderView && ['ready', 'finished'].includes(quoteData.status)}
                >
                  Opti szerkesztés {isOrderView && ['ready', 'finished'].includes(quoteData.status) && '🔒'}
                </Button>

                {/* Kedvezmény - disabled only for ready/finished */}
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<EditIcon />}
                  onClick={handleEditDiscount}
                  fullWidth
                  disabled={isOrderView && ['ready', 'finished'].includes(quoteData.status)}
                >
                  Kedvezmény ({quoteData.discount_percent}%) {isOrderView && ['ready', 'finished'].includes(quoteData.status) && '🔒'}
                </Button>

                {/* Megjegyzés - disabled only for ready/finished */}
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<EditIcon />}
                  onClick={handleEditComment}
                  fullWidth
                  disabled={isOrderView && ['ready', 'finished'].includes(quoteData.status)}
                >
                  Megjegyzés {isOrderView && ['ready', 'finished'].includes(quoteData.status) && '🔒'}
                </Button>

                <Divider />

                <Button
                  variant="outlined"
                  color="info"
                  startIcon={<ExportIcon />}
                  onClick={handleExportExcel}
                  fullWidth
                >
                  Export Excel
                </Button>

                <Button
                  variant="outlined"
                  color="info"
                  startIcon={<PrintIcon />}
                  onClick={handlePrint}
                  fullWidth
                >
                  Nyomtatás
                </Button>

                <Divider />

                {/* Show different buttons based on view type and status */}
                {!isOrderView && quoteData.status === 'draft' && (
                  <Button
                    variant="outlined"
                    startIcon={<OrderIcon />}
                    onClick={handleCreateOrder}
                    fullWidth
                  >
                    Megrendelés
                  </Button>
                )}

                {isOrderView && (
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<AddIcon />}
                    onClick={() => setAssignProductionModalOpen(true)}
                    fullWidth
                  >
                    Gyártásba adás
                  </Button>
                )}

                {isOrderView && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<PaymentIcon />}
                    onClick={() => setAddPaymentModalOpen(true)}
                    fullWidth
                  >
                    Fizetés hozzáadás
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Quote/Order Info */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {isOrderView ? 'Megrendelés információk' : 'Árajánlat információk'}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  <strong>Árajánlat szám:</strong> {quoteData.quote_number}
                </Typography>
                {isOrderView && quoteData.order_number && (
                  <Typography variant="body2">
                    <strong>Megrendelés szám:</strong> {quoteData.order_number}
                  </Typography>
                )}
                <Typography variant="body2">
                  <strong>Létrehozva:</strong> {formatDate(quoteData.created_at)}
                </Typography>
                <Typography variant="body2">
                  <strong>Frissítve:</strong> {formatDate(quoteData.updated_at)}
                </Typography>
                <Typography variant="body2">
                  <strong>Kedvezmény:</strong> {quoteData.discount_percent}%
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">
                    <strong>Forrás:</strong>
                  </Typography>
                  <Chip 
                    label={(quoteData as any).source === 'customer_portal' ? 'Ügyfél' : 'Admin'}
                    color={(quoteData as any).source === 'customer_portal' ? 'info' : 'default'}
                    size="small"
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">
                    <strong>Fizetési mód:</strong>
                  </Typography>
                  {(quoteData as any).payment_methods?.name ? (
                    <Chip 
                      label={(quoteData as any).payment_methods.name}
                      color="error"
                      size="small"
                    />
                  ) : (
                    <Typography variant="body2">-</Typography>
                  )}
                </Box>
                {isOrderView && quoteData.payment_status && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">
                      <strong>Fizetési állapot:</strong>
                    </Typography>
                    <Chip 
                      label={quoteData.payment_status === 'not_paid' ? 'Nincs fizetve' : quoteData.payment_status === 'partial' ? 'Részben fizetve' : 'Kifizetve'} 
                      color={quoteData.payment_status === 'not_paid' ? 'error' : quoteData.payment_status === 'partial' ? 'warning' : 'success'}
                      size="small"
                    />
                  </Box>
                )}
                {isOrderView && quoteData.ready_notification_sent_at && (
                  <Typography variant="body2">
                    <strong>Készre jelentés SMS:</strong> {formatDate(quoteData.ready_notification_sent_at)}
                  </Typography>
                )}
                {isOrderView && quoteData.last_storage_reminder_sent_at && (
                  <Typography variant="body2">
                    <strong>Tárolás emlékeztető SMS:</strong> {formatDate(quoteData.last_storage_reminder_sent_at)}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Production Info - Only show for orders with production assignment */}
          {isOrderView && quoteData.production_machine_id && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Gyártás információk
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2">
                    <strong>Gép:</strong> {quoteData.production_machine?.machine_name || 'N/A'}
                  </Typography>
                  {quoteData.production_date && (
                    <Typography variant="body2">
                      <strong>Gyártás dátuma:</strong> {formatDate(quoteData.production_date)}
                    </Typography>
                  )}
                  {quoteData.barcode && (
                    <Typography variant="body2">
                      <strong>Vonalkód:</strong> {quoteData.barcode}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Payment History - Only show for orders */}
          {isOrderView && quoteData.payments && quoteData.payments.length > 0 && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Fizetési előzmények
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Dátum</strong></TableCell>
                      <TableCell align="right"><strong>Összeg</strong></TableCell>
                      <TableCell align="center" width={50}><strong>Info</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {quoteData.payments.map((payment) => {
                      const paymentMethodLabel = payment.payment_method === 'cash' ? 'Készpénz' : 
                                                 payment.payment_method === 'transfer' ? 'Utalás' : 
                                                 payment.payment_method === 'card' ? 'Bankkártya' : 
                                                 payment.payment_method
                      
                      const tooltipText = `Fizetési mód: ${paymentMethodLabel}${payment.comment ? '\nMegjegyzés: ' + payment.comment : ''}`

                      return (
                        <TableRow key={payment.id}>
                          <TableCell>{formatDate(payment.payment_date)}</TableCell>
                          <TableCell align="right">{formatCurrency(payment.amount)}</TableCell>
                          <TableCell align="center">
                            <Tooltip title={tooltipText} arrow>
                              <IconButton size="small">
                                <i className="ri-information-line" style={{ fontSize: '18px' }} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow>
                      <TableCell><strong>Összesen:</strong></TableCell>
                      <TableCell align="right" colSpan={2}>
                        <strong>{formatCurrency(quoteData.payments.reduce((sum, p) => sum + p.amount, 0))}</strong>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Add Fee Modal */}
      <AddFeeModal
        open={addFeeModalOpen}
        onClose={() => setAddFeeModalOpen(false)}
        quoteId={quoteData.id}
        onSuccess={handleFeeAdded}
        feeTypes={feeTypes}
      />

      {/* Add Accessory Modal */}
      <AddAccessoryModal
        open={addAccessoryModalOpen}
        onClose={() => setAddAccessoryModalOpen(false)}
        quoteId={quoteData.id}
        onSuccess={handleAccessoryAdded}
        accessories={accessories}
        vatRates={vatRates}
        currencies={currencies}
        units={units}
        partners={partners}
      />

      {/* Edit Discount Modal */}
      <EditDiscountModal
        open={discountModalOpen}
        onClose={() => setDiscountModalOpen(false)}
        quoteId={quoteData.id}
        currentDiscountPercent={quoteData.discount_percent}
        onSuccess={handleDiscountUpdated}
      />

      {/* Comment Modal */}
      <CommentModal
        open={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        onSave={handleSaveComment}
        initialComment={quoteData.comment || null}
        quoteNumber={quoteData.quote_number}
      />

      {/* Create Order Modal */}
      <CreateOrderModal
        open={createOrderModalOpen}
        onClose={() => setCreateOrderModalOpen(false)}
        quoteId={quoteData.id}
        quoteNumber={quoteData.quote_number}
        finalTotal={(() => {
          // Calculate final total if not stored in database
          const materialsGross = quoteData.totals?.total_gross || 0
          const feesGross = quoteData.totals?.fees_total_gross || 0
          const accessoriesGross = quoteData.totals?.accessories_total_gross || 0
          
          const feesPositive = Math.max(0, feesGross)
          const accessoriesPositive = Math.max(0, accessoriesGross)
          const feesNegative = Math.min(0, feesGross)
          const accessoriesNegative = Math.min(0, accessoriesGross)
          
          const subtotal = materialsGross + feesPositive + accessoriesPositive
          const discountAmount = subtotal * ((quoteData.discount_percent || 0) / 100)
          const calculatedTotal = subtotal - discountAmount + feesNegative + accessoriesNegative
          
          // Use stored value if available, otherwise use calculated value
          return quoteData.final_total_after_discount || calculatedTotal
        })()}
        onSuccess={handleOrderCreated}
      />

      {/* Add Payment Modal */}
      {isOrderView && (
        <AddPaymentModal
          open={addPaymentModalOpen}
          onClose={() => setAddPaymentModalOpen(false)}
          quoteId={quoteData.id}
          orderNumber={quoteData.order_number || quoteData.quote_number}
          finalTotal={(() => {
            // Calculate final total (same logic as CreateOrderModal)
            const materialsGross = quoteData.totals?.total_gross || 0
            const feesGross = quoteData.totals?.fees_total_gross || 0
            const accessoriesGross = quoteData.totals?.accessories_total_gross || 0
            
            const feesPositive = Math.max(0, feesGross)
            const accessoriesPositive = Math.max(0, accessoriesGross)
            const feesNegative = Math.min(0, feesGross)
            const accessoriesNegative = Math.min(0, accessoriesGross)
            
            const subtotal = materialsGross + feesPositive + accessoriesPositive
            const discountAmount = subtotal * ((quoteData.discount_percent || 0) / 100)
            const calculatedTotal = subtotal - discountAmount + feesNegative + accessoriesNegative
            
            return quoteData.final_total_after_discount || calculatedTotal
          })()}
          totalPaid={quoteData.payments?.reduce((sum, p) => sum + p.amount, 0) || 0}
          onSuccess={handlePaymentAdded}
        />
      )}

      {/* Assign Production Modal */}
      {isOrderView && (
        <AssignProductionModal
          open={assignProductionModalOpen}
          onClose={() => setAssignProductionModalOpen(false)}
          quoteId={quoteData.id}
          orderNumber={quoteData.order_number || quoteData.quote_number}
          machines={machines}
          existingAssignment={{
            production_machine_id: quoteData.production_machine_id,
            production_date: quoteData.production_date,
            barcode: quoteData.barcode
          }}
          onSuccess={handleProductionAssigned}
        />
      )}
      </Box>
    </>
  )
}
