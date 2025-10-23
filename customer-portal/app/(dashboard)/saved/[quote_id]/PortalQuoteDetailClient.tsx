'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

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
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress
} from '@mui/material'
import { 
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Print as PrintIcon,
  ShoppingCart as OrderIcon
} from '@mui/icons-material'
import LocationSearchingSharpIcon from '@mui/icons-material/LocationSearchingSharp'
import Filter2Icon from '@mui/icons-material/Filter2'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import { toast } from 'react-toastify'
import CommentModal from './CommentModal'

interface PortalQuoteData {
  id: string
  quote_number: string
  status: string
  comment?: string | null
  discount_percent: number
  total_net: number
  total_vat: number
  total_gross: number
  final_total_after_discount: number
  created_at: string
  updated_at: string
  portal_customers: {
    id: string
    name: string
    email: string
    mobile: string
    billing_name: string
    billing_country: string
    billing_city: string
    billing_postal_code: string
    billing_street: string
    billing_house_number: string
    billing_tax_number: string
    billing_company_reg_number: string
    discount_percent: number
  }
  companies: {
    id: string
    name: string
    supabase_url: string
    supabase_anon_key: string
  }
  panels: Array<{
    id: string
    material_id: string
    width_mm: number
    height_mm: number
    quantity: number
    label: string
    edge_material_a_id: string | null
    edge_material_b_id: string | null
    edge_material_c_id: string | null
    edge_material_d_id: string | null
    edge_a_name: string | null
    edge_b_name: string | null
    edge_c_name: string | null
    edge_d_name: string | null
    panthelyfuras_quantity: number
    panthelyfuras_oldal: string | null
    duplungolas: boolean
    szogvagas: boolean
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
    portal_quote_edge_materials_breakdown: Array<{
      id: string
      edge_material_id: string
      edge_material_name: string
      total_length_m: number
      price_per_m: number
      net_price: number
      vat_amount: number
      gross_price: number
    }>
    portal_quote_services_breakdown: Array<{
      id: string
      service_type: string
      quantity: number
      unit_price: number
      net_price: number
      vat_amount: number
      gross_price: number
    }>
  }>
}

interface CompanyInfo {
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
}

interface PortalQuoteDetailClientProps {
  initialQuoteData: PortalQuoteData
  companyInfo: CompanyInfo | null
}

export default function PortalQuoteDetailClient({ 
  initialQuoteData,
  companyInfo
}: PortalQuoteDetailClientProps) {
  const router = useRouter()
  const [quoteData, setQuoteData] = useState<PortalQuoteData>(initialQuoteData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [commentModalOpen, setCommentModalOpen] = useState(false)

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
    router.push('/saved')
  }

  // Handle edit optimization
  const handleEditOptimization = () => {
    router.push(`/opti?quote_id=${quoteData.id}`)
  }

  // Handle comment edit
  const handleEditComment = () => {
    setCommentModalOpen(true)
  }

  const handleSaveComment = async (comment: string) => {
    try {
      console.log('[PORTAL CLIENT] Saving comment for quote:', quoteData.id)
      console.log('[PORTAL CLIENT] Comment value:', comment)
      
      const response = await fetch(`/api/portal-quotes/${quoteData.id}/comment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment: comment || null }),
      })

      console.log('[PORTAL CLIENT] Response status:', response.status)
      console.log('[PORTAL CLIENT] Response ok:', response.ok)

      if (!response.ok) {
        const error = await response.json()
        console.error('[PORTAL CLIENT] API error response:', error)
        throw new Error(error.error || 'Failed to save comment')
      }

      const result = await response.json()
      console.log('[PORTAL CLIENT] API success response:', result)

      toast.success('Megjegyzés sikeresen mentve')
      
      // Refresh quote data
      window.location.reload()
    } catch (error) {
      console.error('[PORTAL CLIENT] Error saving comment:', error)
      toast.error(error instanceof Error ? error.message : 'Hiba történt a megjegyzés mentésekor')
      throw error
    }
  }

  // Handle print
  const handlePrint = () => {
    window.print()
  }

  // Handle submit quote
  const handleSubmitQuote = () => {
    setSubmitDialogOpen(true)
  }

  // Handle submit confirmation
  const handleSubmitConfirm = async () => {
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/portal-quotes/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteId: quoteData.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit quote')
      }

      const result = await response.json()

      toast.success(`Árajánlat sikeresen elküldve! Céges árajánlat szám: ${result.companyQuoteNumber}`)
      
      setSubmitDialogOpen(false)
      
      // Update local quote status
      setQuoteData(prev => ({
        ...prev,
        status: 'submitted'
      }))
      
      // Redirect to orders page after 2 seconds
      setTimeout(() => {
        router.push('/orders')
      }, 2000)

    } catch (err) {
      console.error('[Customer Portal] Error submitting quote:', err)
      toast.error(`Hiba az árajánlat elküldése során: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setSubmitDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle submit cancel
  const handleSubmitCancel = () => {
    setSubmitDialogOpen(false)
  }

  // Calculate totals
  const subtotalGross = quoteData.total_gross
  const discountAmount = subtotalGross * (quoteData.discount_percent / 100)
  const finalTotal = quoteData.final_total_after_discount

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
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

          .no-print,
          button,
          .MuiIconButton-root,
          .MuiButton-root,
          .print-hide-actions {
            display: none !important;
            visibility: hidden !important;
          }

          .MuiPaper-root,
          .MuiCard-root {
            border: none !important;
            box-shadow: none !important;
          }

          @page {
            size: portrait;
            margin: 0 1cm;
          }

          .printable-content {
            transform: scale(0.95);
            transform-origin: top left;
          }

          .MuiGrid-item[class*="md-6"] {
            flex: 0 0 50% !important;
            max-width: 50% !important;
          }

          .print-full-width {
            flex: 0 0 100% !important;
            max-width: 100% !important;
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
          Árajánlat: {quoteData.quote_number}
        </Typography>
        <Chip 
          label={quoteData.status === 'draft' ? 'Piszkozat' : quoteData.status === 'submitted' ? 'Elküldve' : quoteData.status}
          color={quoteData.status === 'draft' ? 'warning' : quoteData.status === 'submitted' ? 'success' : 'default'}
          sx={{ ml: 2 }}
        />
        </Box>

        <Grid container spacing={3}>
          {/* Left Column - Quote Details */}
          <Grid item xs={12} md={9} className="print-full-width">
            <Paper sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0' }}>
              {/* Company Info */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12}>
                  <Box sx={{ 
                    p: 3, 
                    backgroundColor: '#f5f5f5', 
                    borderRadius: 2
                  }}>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      {companyInfo ? (
                        <>
                          <strong>{companyInfo.name}</strong><br />
                          {companyInfo.postal_code} {companyInfo.city}, {companyInfo.address}<br />
                          {companyInfo.tax_number && `Adószám: ${companyInfo.tax_number}`}<br />
                          {companyInfo.company_registration_number && `Cégjegyzékszám: ${companyInfo.company_registration_number}`}<br />
                          {companyInfo.email && `Email: ${companyInfo.email}`}<br />
                          {companyInfo.phone_number && `Tel: ${companyInfo.phone_number}`}
                        </>
                      ) : (
                        <>
                          <strong>{quoteData.companies.name}</strong><br />
                          Vállalat információ betöltése...
                        </>
                      )}
                    </Typography>
                  </Box>
                </Grid>
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
                      <strong>{quoteData.portal_customers.name}</strong><br />
                      {quoteData.portal_customers.email}<br />
                      {quoteData.portal_customers.mobile}
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
                    {quoteData.portal_customers.billing_name ? (
                      <>
                        <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                          Számlázási adatok
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          <strong>{quoteData.portal_customers.billing_name}</strong><br />
                          {quoteData.portal_customers.billing_postal_code} {quoteData.portal_customers.billing_city}<br />
                          {quoteData.portal_customers.billing_street} {quoteData.portal_customers.billing_house_number}<br />
                          {quoteData.portal_customers.billing_country}
                          {quoteData.portal_customers.billing_tax_number && (
                            <>
                              <br />Adószám: {quoteData.portal_customers.billing_tax_number}
                            </>
                          )}
                          {quoteData.portal_customers.billing_company_reg_number && (
                            <>
                              <br />Cégjegyzékszám: {quoteData.portal_customers.billing_company_reg_number}
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
              
              {/* Materials Breakdown Table (EXACT main app structure) */}
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
                            <TableCell>{pricing.material_name}</TableCell>
                            <TableCell align="right">
                              {(() => {
                                const chargedSqm = pricing.charged_sqm || 0
                                const boardsSold = pricing.boards_used || 0
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
                              Nincs árazási adat elérhető.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Services Breakdown Table (EXACT main app structure) */}
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
                          if (pricing.portal_quote_edge_materials_breakdown) {
                            pricing.portal_quote_edge_materials_breakdown.forEach(edge => {
                              totalEdgeLength += edge.total_length_m
                              totalEdgeNet += edge.net_price
                              totalEdgeGross += edge.gross_price
                            })
                          }
                        })
                        
                        // Collect all services from breakdown data
                        const allServices: Array<{type: string, quantity: number, net_price: number, gross_price: number}> = []
                        
                        quoteData.pricing.forEach(pricing => {
                          if (pricing.portal_quote_services_breakdown) {
                            pricing.portal_quote_services_breakdown.forEach(service => {
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
                        
                        // Add aggregated services
                        allServices.forEach(service => {
                          const serviceLabel = service.type === 'panthelyfuras' ? 'Pánthelyfúrás' :
                                             service.type === 'duplungolas' ? 'Duplungolás' :
                                             service.type === 'szogvagas' ? 'Szögvágás' : service.type
                          servicesRows.push(
                            <TableRow key={service.type}>
                              <TableCell>{serviceLabel}</TableCell>
                              <TableCell align="right">{service.quantity} db</TableCell>
                              <TableCell align="right">{formatCurrency(service.net_price)}</TableCell>
                              <TableCell align="right">{formatCurrency(service.gross_price)}</TableCell>
                            </TableRow>
                          )
                        })
                        
                        if (servicesRows.length === 0) {
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
                        
                        return servicesRows
                      })()}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Totals Summary (EXACT main app structure) */}
              <Box>
                {/* Calculate components */}
                {(() => {
                  const materialsGross = quoteData.total_gross
                  
                  // Subtotal is just materials (no fees/accessories in portal)
                  const subtotal = materialsGross
                  const discountAmount = subtotal * (quoteData.discount_percent / 100)
                  const finalTotal = quoteData.final_total_after_discount
                  
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

            {/* Comment Card - Only shown if comment exists */}
            {quoteData.comment && (
              <Card sx={{ mb: 3 }}>
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

            {/* Cutting List Section (EXACT main app structure - separate Card) */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Szabásjegyzék
                </Typography>

                <TableContainer sx={{ border: '1px solid rgba(224, 224, 224, 1)' }}>
                  <Table 
                    size="small"
                    sx={{
                      '& .MuiTableCell-root': {
                        borderRight: '1px solid rgba(224, 224, 224, 1)',
                        padding: '6px 8px',
                        fontSize: '0.875rem',
                        '&:last-child': {
                          borderRight: 'none'
                        }
                      },
                      '& .MuiTableHead-root .MuiTableCell-root': {
                        padding: '8px',
                        fontSize: '0.875rem'
                      }
                    }}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Anyag</strong></TableCell>
                        <TableCell align="right"><strong>Hosszúság</strong></TableCell>
                        <TableCell align="right"><strong>Szélesség</strong></TableCell>
                        <TableCell align="right"><strong>Darab</strong></TableCell>
                        <TableCell><strong>Jelölés</strong></TableCell>
                        <TableCell><strong>Hosszú alsó</strong></TableCell>
                        <TableCell><strong>Hosszú felső</strong></TableCell>
                        <TableCell><strong>Széles bal</strong></TableCell>
                        <TableCell><strong>Széles jobb</strong></TableCell>
                        <TableCell align="center"><strong>Egyéb</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {quoteData.panels && quoteData.panels.length > 0 ? (
                        quoteData.panels.map((panel) => {
                          // Find material name from pricing
                          const materialPricing = quoteData.pricing.find(p => p.material_id === panel.material_id)
                          const materialName = materialPricing?.material_name || 'Ismeretlen anyag'

                          return (
                            <TableRow key={panel.id}>
                              <TableCell>{materialName}</TableCell>
                              <TableCell align="right">{panel.width_mm}</TableCell>
                              <TableCell align="right">{panel.height_mm}</TableCell>
                              <TableCell align="right">{panel.quantity}</TableCell>
                              <TableCell>{panel.label || '-'}</TableCell>
                              <TableCell>{panel.edge_a_name || ''}</TableCell>
                              <TableCell>{panel.edge_c_name || ''}</TableCell>
                              <TableCell>{panel.edge_b_name || ''}</TableCell>
                              <TableCell>{panel.edge_d_name || ''}</TableCell>
                              <TableCell align="center">
                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', alignItems: 'center' }}>
                                  {panel.panthelyfuras_quantity > 0 && (
                                    <Tooltip title={`Pánthelyfúrás (${panel.panthelyfuras_quantity} db)`} arrow>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                        <LocationSearchingSharpIcon fontSize="small" />
                                        <Typography variant="caption">{panel.panthelyfuras_quantity}</Typography>
                                      </Box>
                                    </Tooltip>
                                  )}
                                  {panel.duplungolas && (
                                    <Tooltip title="Duplungolás" arrow>
                                      <Filter2Icon fontSize="small" />
                                    </Tooltip>
                                  )}
                                  {panel.szogvagas && (
                                    <Tooltip title="Szögvágás" arrow>
                                      <ContentCutIcon fontSize="small" />
                                    </Tooltip>
                                  )}
                                  {!panel.panthelyfuras_quantity && !panel.duplungolas && !panel.szogvagas && '-'}
                                </Box>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={10} align="center">
                            <Typography variant="body2" color="text.secondary">
                              Nincs panel adat
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Right Column - Actions */}
          <Grid item xs={12} md={3} className="print-hide-actions">
            <Paper sx={{ p: 2, position: 'sticky', top: 20 }}>
              <Typography variant="h6" gutterBottom>
                Műveletek
              </Typography>

              {/* Edit Button - Disabled for submitted quotes */}
              <Tooltip 
                title={quoteData.status === 'submitted' ? 'Elküldött árajánlat nem szerkeszthető' : ''}
                arrow
              >
                <span style={{ width: '100%' }}>
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={handleEditOptimization}
                    disabled={quoteData.status !== 'draft'}
                    fullWidth
                    sx={{ mb: 1 }}
                  >
                    Opti szerkesztés {quoteData.status === 'submitted' && '🔒'}
                  </Button>
                </span>
              </Tooltip>

              {/* Megjegyzés Button */}
              <Tooltip 
                title={quoteData.status !== 'draft' ? 'A megjegyzés csak piszkozat státuszban szerkeszthető' : ''}
                arrow
              >
                <span>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<EditIcon />}
                    onClick={handleEditComment}
                    disabled={quoteData.status !== 'draft'}
                    fullWidth
                    sx={{ mb: 1 }}
                  >
                    Megjegyzés {quoteData.status === 'submitted' && '🔒'}
                  </Button>
                </span>
              </Tooltip>

              <Divider sx={{ my: 2 }} />

              {/* Print Button */}
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                fullWidth
                sx={{ mb: 1 }}
              >
                Nyomtatás
              </Button>

              {/* Submit Quote Button - Enabled for draft quotes */}
              <Button
                variant="contained"
                color="primary"
                startIcon={<OrderIcon />}
                onClick={handleSubmitQuote}
                disabled={quoteData.status !== 'draft' || isSubmitting}
                fullWidth
                sx={{ mb: 2 }}
              >
                {quoteData.status === 'submitted' ? 'Elküldve' : 'Megrendelés'}
              </Button>

              <Divider sx={{ my: 2 }} />

              {/* Quote Info */}
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Létrehozva:</strong> {formatDate(quoteData.created_at)}
              </Typography>
              <Typography variant="body2">
                <strong>Frissítve:</strong> {formatDate(quoteData.updated_at)}
              </Typography>
              {quoteData.discount_percent > 0 && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Kedvezmény:</strong> {quoteData.discount_percent}%
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Submit Confirmation Dialog */}
      <Dialog
        open={submitDialogOpen}
        onClose={() => !isSubmitting && handleSubmitCancel()}
      >
        <DialogTitle>Árajánlat elküldése</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Biztosan el szeretné küldeni ezt az árajánlatot a cégnek?
            <br /><br />
            Az árajánlat száma: <strong>{quoteData.quote_number}</strong>
            <br />
            Végösszeg: <strong>{formatCurrency(quoteData.final_total_after_discount)}</strong>
            <br /><br />
            Az elküldés után az árajánlat nem szerkeszthető, és a cég munkatársai feldolgozzák.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSubmitCancel} disabled={isSubmitting}>
            Mégse
          </Button>
          <Button 
            onClick={handleSubmitConfirm} 
            color="primary" 
            variant="contained"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
          >
            {isSubmitting ? 'Küldés...' : 'Elküldöm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Comment Modal */}
      <CommentModal
        open={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        onSave={handleSaveComment}
        initialComment={quoteData.comment || null}
        quoteNumber={quoteData.quote_number}
      />
    </>
  )
}

