'use client'

import React, { useState, useEffect } from 'react'
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
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material'
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

import { usePermissions } from '@/permissions/PermissionProvider'
import QuoteFeesSection from './QuoteFeesSection'
import QuoteAccessoriesSection from './QuoteAccessoriesSection'
import AddFeeModal from './AddFeeModal'
import AddAccessoryModal from './AddAccessoryModal'

interface QuoteData {
  id: string
  quote_number: string
  status: string
  customer_id: string
  discount_percent: number
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
    unit_price_net: number
    vat_rate: number
    vat_amount: number
    gross_price: number
    currency_id: string
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
}

export default function QuoteDetailClient({ 
  initialQuoteData,
  feeTypes,
  accessories,
  vatRates,
  currencies,
  units,
  partners
}: QuoteDetailClientProps) {
  const router = useRouter()
  const { canAccess } = usePermissions()
  const hasAccess = canAccess('/quotes')
  
  const [quoteData, setQuoteData] = useState<QuoteData>(initialQuoteData)
  const [isLoading, setIsLoading] = useState(false)
  const [addFeeModalOpen, setAddFeeModalOpen] = useState(false)
  const [addAccessoryModalOpen, setAddAccessoryModalOpen] = useState(false)

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
    router.push('/quotes')
  }

  // Handle edit optimization
  const handleEditOptimization = () => {
    router.push(`/opti?quote_id=${quoteData.id}`)
  }

  // Handle print
  const handlePrint = () => {
    window.print()
  }

  // Handle export Excel
  const handleExportExcel = () => {
    toast.info('Excel export funkció hamarosan elérhető')
  }

  // Handle add payment
  const handleAddPayment = () => {
    toast.info('Fizetés hozzáadása hamarosan elérhető')
  }

  // Handle create order
  const handleCreateOrder = () => {
    toast.info('Megrendelés létrehozása hamarosan elérhető')
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
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={handleBack} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          Árajánlat: {quoteData.quote_number}
        </Typography>
        <Chip 
          label={quoteData.status} 
          color={quoteData.status === 'draft' ? 'default' : 'success'}
          sx={{ ml: 2 }}
        />
      </Box>

      <Grid container spacing={3}>
        {/* Left Column - Quote Details */}
        <Grid item xs={12} md={9}>
          {/* All Quote Information in One Card */}
          <Paper sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0' }}>
            {/* Company Info */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                Cégadatok
              </Typography>
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

            {/* Customer & Billing Info */}
            <Grid container spacing={4} sx={{ mb: 4 }}>
              {/* Customer Info */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                  Ügyfél adatok
                </Typography>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                  <strong>{quoteData.customer.name}</strong><br />
                  {quoteData.customer.email}<br />
                  {quoteData.customer.mobile}
                </Typography>
              </Grid>

              {/* Billing Details */}
              <Grid item xs={12} md={6}>
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
              </Grid>
            </Grid>

            {/* Quote Summary */}
            <Divider sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
              Árajánlat összesítése
            </Typography>
            
            {/* Materials Breakdown */}
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

            <Divider sx={{ my: 2 }} />

            {/* Services Breakdown */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Szolgáltatások
              </Typography>
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
                            <TableCell align="right">{service.quantity} db</TableCell>
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
              {/* Materials with discount */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">
                  Anyagok összesen:
                </Typography>
                <Typography variant="body2">
                  {formatCurrency(quoteData.totals.total_gross)}
                </Typography>
              </Box>
              
              {quoteData.discount_percent > 0 && (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="error">
                      Kedvezmény ({quoteData.discount_percent}%):
                    </Typography>
                    <Typography variant="body2" color="error">
                      -{formatCurrency(quoteData.totals.total_gross * (quoteData.discount_percent / 100))}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      Anyagok kedvezménnyel:
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency(quoteData.totals.total_gross * (1 - quoteData.discount_percent / 100))}
                    </Typography>
                  </Box>
                </>
              )}

              <Divider sx={{ my: 1 }} />

              {/* Fees total */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">
                  Díjak összesen:
                </Typography>
                <Typography variant="body2">
                  {formatCurrency(quoteData.totals.fees_total_gross || 0)}
                </Typography>
              </Box>

              {/* Accessories total */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">
                  Termékek összesen:
                </Typography>
                <Typography variant="body2">
                  {formatCurrency(quoteData.totals.accessories_total_gross || 0)}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Final total */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  Végösszeg:
                </Typography>
                <Typography variant="h6" color="primary">
                  {formatCurrency(quoteData.totals.final_total_after_discount)}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Fees Section */}
          <QuoteFeesSection
            quoteId={quoteData.id}
            fees={quoteData.fees}
            onFeesChange={handleFeeAdded}
            onAddFeeClick={handleAddFee}
          />

          {/* Accessories Section */}
          <QuoteAccessoriesSection
            quoteId={quoteData.id}
            accessories={quoteData.accessories}
            onAccessoriesChange={handleAccessoryAdded}
            onAddAccessoryClick={handleAddAccessory}
          />
        </Grid>

        {/* Right Column - Actions */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Műveletek
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={handleEditOptimization}
                  fullWidth
                >
                  Opti szerkesztés
                </Button>

                <Divider />

                <Button
                  variant="outlined"
                  startIcon={<ExportIcon />}
                  onClick={handleExportExcel}
                  fullWidth
                >
                  Export Excel
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={handlePrint}
                  fullWidth
                >
                  Nyomtatás
                </Button>

                <Divider />

                <Button
                  variant="outlined"
                  startIcon={<PaymentIcon />}
                  onClick={handleAddPayment}
                  fullWidth
                >
                  Fizetés hozzáadás
                </Button>

                <Button
                  variant="contained"
                  startIcon={<OrderIcon />}
                  onClick={handleCreateOrder}
                  fullWidth
                  color="success"
                >
                  Megrendelés
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Quote Info */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Árajánlat információk
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  <strong>Árajánlat szám:</strong> {quoteData.quote_number}
                </Typography>
                <Typography variant="body2">
                  <strong>Létrehozva:</strong> {formatDate(quoteData.created_at)}
                </Typography>
                <Typography variant="body2">
                  <strong>Frissítve:</strong> {formatDate(quoteData.updated_at)}
                </Typography>
                <Typography variant="body2">
                  <strong>Kedvezmény:</strong> {quoteData.discount_percent}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
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
    </Box>
  )
}
