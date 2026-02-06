'use client'

import React, { useState, useMemo } from 'react'
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
  Card,
  CardContent
} from '@mui/material'

import { 
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  PictureAsPdf as PictureAsPdfIcon,
  ShoppingCart as OrderIcon,
  Payment as PaymentIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import { CircularProgress } from '@mui/material'

import { usePermissions } from '@/contexts/PermissionContext'

interface TenantCompany {
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

interface WorktopQuoteData {
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
  total_net: number
  total_vat: number
  total_gross: number
  final_total_after_discount: number
  created_at: string
  updated_at: string
  customers: {
    id: string
    name: string
    email: string | null
    mobile: string | null
    discount_percent: number
    billing_name: string | null
    billing_country: string | null
    billing_city: string | null
    billing_postal_code: string | null
    billing_street: string | null
    billing_house_number: string | null
    billing_tax_number: string | null
    billing_company_reg_number: string | null
  }
  configs: Array<{
    id: string
    config_order: number
    assembly_type: string
    linear_material_id: string
    linear_material_name: string
    dimension_a: number
    dimension_b: number
    dimension_c: number | null
    dimension_d: number | null
    rounding_r1: number | null
    rounding_r2: number | null
    rounding_r3: number | null
    rounding_r4: number | null
    cut_l1: number | null
    cut_l2: number | null
    cut_l3: number | null
    cut_l4: number | null
    cut_l5: number | null
    cut_l6: number | null
    cut_l7: number | null
    cut_l8: number | null
    cutouts: string | null
    edge_position1: boolean
    edge_position2: boolean
    edge_position3: boolean
    edge_position4: boolean
    edge_position5: boolean | null
    edge_position6: boolean | null
  }>
  pricing: Array<{
    id: string
    config_order: number
    material_id: string
    material_name: string
    anyag_koltseg_net: number
    anyag_koltseg_gross: number
    kereszt_vagas_net: number
    kereszt_vagas_gross: number
    hosszanti_vagas_net: number
    hosszanti_vagas_gross: number
    ives_vagas_net: number
    ives_vagas_gross: number
    szogvagas_net: number
    szogvagas_gross: number
    kivagas_net: number
    kivagas_gross: number
    elzaro_net: number
    elzaro_gross: number
    elzaro_details: string | null
    osszemaras_net: number
    osszemaras_gross: number
    hosszanti_vagas_details: string | null
    ives_vagas_details: string | null
    szogvagas_details: string | null
    kivagas_details: string | null
  }>
}

interface WorktopQuoteDetailClientProps {
  initialQuoteData: WorktopQuoteData
  tenantCompany: TenantCompany | null
}

export default function WorktopQuoteDetailClient({ initialQuoteData, tenantCompany }: WorktopQuoteDetailClientProps) {
  const router = useRouter()
  const { canAccess } = usePermissions()
  const hasAccess = canAccess('/worktop-quotes')
  
  const [quoteData] = useState<WorktopQuoteData>(initialQuoteData)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  // Format currency with thousands separator
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' Ft'
  }

  // Calculate total meters for each material+assembly_type combination (grouped by material_id AND assembly_type)
  const materialsGrouped = useMemo(() => {
    const materialMap = new Map<string, {
      material_id: string
      material_name: string
      assembly_type: string
      totalMeters: number
      totalNet: number
      totalGross: number
    }>()

    // Group pricing by material_id AND assembly_type (from config)
    quoteData.pricing.forEach(pricing => {
      const config = quoteData.configs.find(c => c.config_order === pricing.config_order)
      if (!config) return

      // Create unique key: material_id + assembly_type
      const key = `${pricing.material_id}_${config.assembly_type}`
      const existing = materialMap.get(key)
      
      if (existing) {
        existing.totalNet += pricing.anyag_koltseg_net
        existing.totalGross += pricing.anyag_koltseg_gross
      } else {
        materialMap.set(key, {
          material_id: pricing.material_id,
          material_name: pricing.material_name,
          assembly_type: config.assembly_type,
          totalMeters: 0,
          totalNet: pricing.anyag_koltseg_net,
          totalGross: pricing.anyag_koltseg_gross
        })
      }
    })

    // Calculate meters from configs
    quoteData.configs.forEach(config => {
      const pricing = quoteData.pricing.find(p => p.config_order === config.config_order)
      if (!pricing) return

      let meters = 0
      if (config.assembly_type === 'Levágás') {
        meters = config.dimension_a / 1000 // A in meters
      } else if (config.assembly_type === 'Összemarás Balos') {
        meters = (config.dimension_a / 1000) + ((config.dimension_c - (config.dimension_d || 0)) / 1000)
      } else if (config.assembly_type === 'Összemarás jobbos') {
        meters = ((config.dimension_a - (config.dimension_d || 0)) / 1000) + (config.dimension_c / 1000)
      }

      // Find the material entry using material_id + assembly_type key
      const key = `${pricing.material_id}_${config.assembly_type}`
      const material = materialMap.get(key)
      if (material) {
        material.totalMeters += meters
      }
    })

    return Array.from(materialMap.values())
  }, [quoteData])

  // Calculate individual service totals (sum of all service fees by type)
  const servicesBreakdown = useMemo(() => {
    const acc = {
      osszemaras: { quantity: 0, net: 0, gross: 0 },
      kereszt_vagas: { quantity: 0, net: 0, gross: 0 },
      hosszanti_vagas: { quantity: 0, net: 0, gross: 0 },
      ives_vagas: { quantity: 0, net: 0, gross: 0 },
      szogvagas: { quantity: 0, net: 0, gross: 0 },
      kivagas: { quantity: 0, net: 0, gross: 0 },
      elzaro: { quantity: 0, net: 0, gross: 0 }
    }

    // Process each pricing entry
    quoteData.pricing.forEach(p => {
      // Összemarás: count configs with Balos or jobbos type
      if (p.osszemaras_gross > 0) {
        acc.osszemaras.quantity += 1
        acc.osszemaras.net += (p.osszemaras_net || 0)
        acc.osszemaras.gross += (p.osszemaras_gross || 0)
      }
      
      // Kereszt vágás: count if > 0
      if (p.kereszt_vagas_gross > 0) {
        acc.kereszt_vagas.quantity += 1
        acc.kereszt_vagas.net += (p.kereszt_vagas_net || 0)
        acc.kereszt_vagas.gross += (p.kereszt_vagas_gross || 0)
      }
      
      // Hosszanti vágás: sum meters from details
      if (p.hosszanti_vagas_gross > 0) {
        // Extract meters from details string (e.g., "2.50m × 1500 = 3 750 HUF")
        const details = p.hosszanti_vagas_details || ''
        const meterMatches = details.match(/(\d+\.?\d*)m/g)
        if (meterMatches) {
          meterMatches.forEach(match => {
            const meters = parseFloat(match.replace('m', ''))
            acc.hosszanti_vagas.quantity += meters
          })
        } else {
          // Fallback: calculate from config
          const config = quoteData.configs.find(c => c.config_order === p.config_order)
          if (config) {
            let meters = 0
            if (config.assembly_type === 'Levágás') {
              meters = config.dimension_a / 1000
            } else if (config.assembly_type === 'Összemarás Balos') {
              meters = (config.dimension_a / 1000) + ((config.dimension_c - (config.dimension_d || 0)) / 1000)
            } else if (config.assembly_type === 'Összemarás jobbos') {
              meters = ((config.dimension_a - (config.dimension_d || 0)) / 1000) + (config.dimension_c / 1000)
            }
            acc.hosszanti_vagas.quantity += meters
          }
        }
        acc.hosszanti_vagas.net += (p.hosszanti_vagas_net || 0)
        acc.hosszanti_vagas.gross += (p.hosszanti_vagas_gross || 0)
      }
      
      // Íves vágás: count rounding values (R1, R2, R3, R4) from config
      if (p.ives_vagas_gross > 0) {
        const config = quoteData.configs.find(c => c.config_order === p.config_order)
        if (config) {
          let roundingCount = 0
          if (config.rounding_r1 && config.rounding_r1 > 0) roundingCount++
          if (config.rounding_r2 && config.rounding_r2 > 0) roundingCount++
          if (config.rounding_r3 && config.rounding_r3 > 0) roundingCount++
          if (config.rounding_r4 && config.rounding_r4 > 0) roundingCount++
          acc.ives_vagas.quantity += roundingCount
        } else {
          // Fallback: count from details
          const details = p.ives_vagas_details || ''
          const roundingCount = (details.match(/R\d+/g) || []).length || 1
          acc.ives_vagas.quantity += roundingCount
        }
        acc.ives_vagas.net += (p.ives_vagas_net || 0)
        acc.ives_vagas.gross += (p.ives_vagas_gross || 0)
      }
      
      // Szögvágás: count groups (L1-L2, L3-L4, L5-L6, L7-L8) from config
      if (p.szogvagas_gross > 0) {
        const config = quoteData.configs.find(c => c.config_order === p.config_order)
        if (config) {
          let groupCount = 0
          if (config.cut_l1 && config.cut_l1 > 0 && config.cut_l2 && config.cut_l2 > 0) groupCount++
          if (config.cut_l3 && config.cut_l3 > 0 && config.cut_l4 && config.cut_l4 > 0) groupCount++
          if (config.cut_l5 && config.cut_l5 > 0 && config.cut_l6 && config.cut_l6 > 0) groupCount++
          if (config.cut_l7 && config.cut_l7 > 0 && config.cut_l8 && config.cut_l8 > 0) groupCount++
          acc.szogvagas.quantity += groupCount
        } else {
          // Fallback: count from details
          const details = p.szogvagas_details || ''
          const groupCount = (details.match(/L\d+-L\d+/g) || []).length || 1
          acc.szogvagas.quantity += groupCount
        }
        acc.szogvagas.net += (p.szogvagas_net || 0)
        acc.szogvagas.gross += (p.szogvagas_gross || 0)
      }
      
      // Kivágás: count cutouts from config
      if (p.kivagas_gross > 0) {
        const config = quoteData.configs.find(c => c.config_order === p.config_order)
        if (config && config.cutouts) {
          try {
            const cutouts = JSON.parse(config.cutouts)
            acc.kivagas.quantity += Array.isArray(cutouts) ? cutouts.length : 1
          } catch {
            acc.kivagas.quantity += 1
          }
        } else {
          acc.kivagas.quantity += 1
        }
        acc.kivagas.net += (p.kivagas_net || 0)
        acc.kivagas.gross += (p.kivagas_gross || 0)
      }
      
      // Élzáró: sum meters from details
      if (p.elzaro_gross > 0) {
        // Extract meters from details string (e.g., "5.00m × 1 800 HUF = 27 000 HUF")
        const details = p.elzaro_details || ''
        const meterMatches = details.match(/(\d+\.?\d*)m/g)
        if (meterMatches) {
          meterMatches.forEach(match => {
            const meters = parseFloat(match.replace('m', ''))
            acc.elzaro.quantity += meters
          })
        } else {
          // Fallback: calculate from config edges
          const config = quoteData.configs.find(c => c.config_order === p.config_order)
          if (config) {
            let meters = 0
            if (config.assembly_type === 'Levágás') {
              if (config.edge_position1) meters += config.dimension_b / 1000
              if (config.edge_position2) meters += config.dimension_a / 1000
              if (config.edge_position3) meters += config.dimension_b / 1000
              if (config.edge_position4) meters += config.dimension_a / 1000
            } else if (config.assembly_type === 'Összemarás Balos') {
              if (config.edge_position1) meters += config.dimension_c / 1000
              if (config.edge_position2) meters += config.dimension_a / 1000
              if (config.edge_position3) meters += config.dimension_b / 1000
              if (config.edge_position4) meters += (config.dimension_a - (config.dimension_d || 0)) / 1000
              if (config.edge_position5) meters += (config.dimension_c - (config.dimension_b || 0)) / 1000
              if (config.edge_position6) meters += (config.dimension_d || 0) / 1000
            } else if (config.assembly_type === 'Összemarás jobbos') {
              if (config.edge_position1) meters += config.dimension_c / 1000
              if (config.edge_position2) meters += config.dimension_a / 1000
              if (config.edge_position3) meters += config.dimension_b / 1000
              if (config.edge_position4) meters += (config.dimension_a - (config.dimension_d || 0)) / 1000
              if (config.edge_position5) meters += (config.dimension_c - (config.dimension_b || 0)) / 1000
              if (config.edge_position6) meters += (config.dimension_d || 0) / 1000
            }
            acc.elzaro.quantity += meters
          }
        }
        acc.elzaro.net += (p.elzaro_net || 0)
        acc.elzaro.gross += (p.elzaro_gross || 0)
      }
    })

    return acc
  }, [quoteData])

  // Calculate total services for summary
  const servicesTotals = useMemo(() => {
    return {
      net: servicesBreakdown.osszemaras.net +
           servicesBreakdown.kereszt_vagas.net +
           servicesBreakdown.hosszanti_vagas.net +
           servicesBreakdown.ives_vagas.net +
           servicesBreakdown.szogvagas.net +
           servicesBreakdown.kivagas.net +
           servicesBreakdown.elzaro.net,
      gross: servicesBreakdown.osszemaras.gross +
              servicesBreakdown.kereszt_vagas.gross +
              servicesBreakdown.hosszanti_vagas.gross +
              servicesBreakdown.ives_vagas.gross +
              servicesBreakdown.szogvagas.gross +
              servicesBreakdown.kivagas.gross +
              servicesBreakdown.elzaro.gross
    }
  }, [servicesBreakdown])

  // Calculate materials total
  const materialsTotal = useMemo(() => {
    return materialsGrouped.reduce((sum, m) => sum + m.totalGross, 0)
  }, [materialsGrouped])

  const handleEdit = () => {
    router.push(`/worktop-config?id=${quoteData.id}`)
  }

  // Handle PDF generation via server-side Puppeteer
  const handleGeneratePdf = async () => {
    if (!quoteData || !quoteData.id) {
      toast.error('A munkalap ajánlat szükséges a PDF generálásához')
      return
    }

    setIsGeneratingPdf(true)
    try {
      // Call server-side PDF generation API
      const response = await fetch(`/api/worktop-quotes/${quoteData.id}/pdf`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Ismeretlen hiba' }))
        throw new Error(errorData.error || 'Hiba történt a PDF generálása során')
      }

      // Get PDF blob
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Munkalap-Arajanlat-${quoteData.quote_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('PDF sikeresen generálva és letöltve')
    } catch (error: any) {
      console.error('Error generating PDF:', error)
      toast.error('Hiba történt a PDF generálása során: ' + (error.message || 'Ismeretlen hiba'))
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'default'
      case 'accepted':
        return 'success'
      case 'in_production':
        return 'warning'
      case 'done':
        return 'info'
      case 'rejected':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Vázlat'
      case 'accepted':
        return 'Elfogadva'
      case 'in_production':
        return 'Gyártásban'
      case 'done':
        return 'Kész'
      case 'rejected':
        return 'Elutasítva'
      default:
        return status
    }
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography variant="h6" color="error">
          Nincs jogosultsága a munkalap ajánlat megtekintéséhez!
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => router.push('/worktop-quotes')}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1">
              {quoteData.quote_number}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
              <Chip 
                label={getStatusLabel(quoteData.status)} 
                color={getStatusColor(quoteData.status)}
                size="small"
              />
              {quoteData.order_number && (
                <Chip 
                  label={`Megrendelés: ${quoteData.order_number}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column - Quote Details */}
        <Grid item xs={12} md={9}>
          {/* First Card - All Quote Information */}
          <Paper sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0' }}>
            {/* Company Info */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <Box sx={{ 
                  p: 3, 
                  backgroundColor: '#f5f5f5', 
                  borderRadius: 2,
                  height: '100%'
                }}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {tenantCompany ? (
                      <>
                        <strong>{tenantCompany.name}</strong><br />
                        {tenantCompany.postal_code} {tenantCompany.city}, {tenantCompany.address}<br />
                        {tenantCompany.tax_number && `Adószám: ${tenantCompany.tax_number}`}<br />
                        {tenantCompany.company_registration_number && `Cégjegyzékszám: ${tenantCompany.company_registration_number}`}<br />
                        {tenantCompany.email && `Email: ${tenantCompany.email}`}<br />
                        {tenantCompany.phone_number && `Tel: ${tenantCompany.phone_number}`}
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
                    <strong>{quoteData.customers.name}</strong><br />
                    {quoteData.customers.email && (
                      <>
                        {quoteData.customers.email}<br />
                      </>
                    )}
                    {quoteData.customers.mobile && quoteData.customers.mobile}
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
                  {quoteData.customers.billing_name ? (
                    <>
                      <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                        Számlázási adatok
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        <strong>{quoteData.customers.billing_name}</strong><br />
                        {quoteData.customers.billing_postal_code} {quoteData.customers.billing_city}<br />
                        {quoteData.customers.billing_street} {quoteData.customers.billing_house_number}<br />
                        {quoteData.customers.billing_country}
                        {quoteData.customers.billing_tax_number && (
                          <>
                            <br />Adószám: {quoteData.customers.billing_tax_number}
                          </>
                        )}
                        {quoteData.customers.billing_company_reg_number && (
                          <>
                            <br />Cégjegyzékszám: {quoteData.customers.billing_company_reg_number}
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
                    {materialsGrouped.length > 0 ? (
                      materialsGrouped.map((material, index) => (
                        <TableRow key={`${material.material_id}_${material.assembly_type}_${index}`}>
                          <TableCell>
                            {material.material_name} ({material.assembly_type})
                          </TableCell>
                          <TableCell align="right">
                            {material.totalMeters.toFixed(2)} m
                          </TableCell>
                          <TableCell align="right">{formatCurrency(Math.round(material.totalNet))}</TableCell>
                          <TableCell align="right">{formatCurrency(Math.round(material.totalGross))}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Nincs anyag adat elérhető.
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
                    {servicesBreakdown.osszemaras.gross > 0 && (
                      <TableRow>
                        <TableCell>Összemarás</TableCell>
                        <TableCell align="right">{servicesBreakdown.osszemaras.quantity} db</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.osszemaras.net))}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.osszemaras.gross))}</TableCell>
                      </TableRow>
                    )}
                    {servicesBreakdown.kereszt_vagas.gross > 0 && (
                      <TableRow>
                        <TableCell>Kereszt vágás</TableCell>
                        <TableCell align="right">{servicesBreakdown.kereszt_vagas.quantity} db</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.kereszt_vagas.net))}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.kereszt_vagas.gross))}</TableCell>
                      </TableRow>
                    )}
                    {servicesBreakdown.hosszanti_vagas.gross > 0 && (
                      <TableRow>
                        <TableCell>Hosszanti vágás</TableCell>
                        <TableCell align="right">{servicesBreakdown.hosszanti_vagas.quantity.toFixed(2)} m</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.hosszanti_vagas.net))}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.hosszanti_vagas.gross))}</TableCell>
                      </TableRow>
                    )}
                    {servicesBreakdown.ives_vagas.gross > 0 && (
                      <TableRow>
                        <TableCell>Íves vágás</TableCell>
                        <TableCell align="right">{servicesBreakdown.ives_vagas.quantity} db</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.ives_vagas.net))}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.ives_vagas.gross))}</TableCell>
                      </TableRow>
                    )}
                    {servicesBreakdown.szogvagas.gross > 0 && (
                      <TableRow>
                        <TableCell>Szögvágás</TableCell>
                        <TableCell align="right">{servicesBreakdown.szogvagas.quantity} db</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.szogvagas.net))}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.szogvagas.gross))}</TableCell>
                      </TableRow>
                    )}
                    {servicesBreakdown.kivagas.gross > 0 && (
                      <TableRow>
                        <TableCell>Kivágás</TableCell>
                        <TableCell align="right">{servicesBreakdown.kivagas.quantity} db</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.kivagas.net))}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.kivagas.gross))}</TableCell>
                      </TableRow>
                    )}
                    {servicesBreakdown.elzaro.gross > 0 && (
                      <TableRow>
                        <TableCell>Élzáró</TableCell>
                        <TableCell align="right">{servicesBreakdown.elzaro.quantity.toFixed(2)} m</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.elzaro.net))}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(servicesBreakdown.elzaro.gross))}</TableCell>
                      </TableRow>
                    )}
                    {servicesTotals.gross === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Nincs szolgáltatási adat elérhető.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Totals */}
            <Box sx={{ 
              mb: 2, 
              p: 2, 
              border: '1px solid #e0e0e0', 
              borderRadius: 1,
              backgroundColor: '#fcfcfc'
            }}>
              {(() => {
                const materialsGross = materialsTotal
                const servicesGross = servicesTotals.gross
                const subtotal = materialsGross + servicesGross
                const discountAmount = subtotal * (quoteData.discount_percent / 100)
                const finalTotal = subtotal - discountAmount
                
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
                          {formatCurrency(Math.round(materialsGross))}
                        </Typography>
                      </Box>

                      {/* Services */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0 }}>
                        <Typography variant="body1" fontWeight="600">
                          Szolgáltatások:
                        </Typography>
                        <Typography variant="body1" fontWeight="600">
                          {formatCurrency(Math.round(servicesGross))}
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
                          {formatCurrency(Math.round(subtotal))}
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
                            -{formatCurrency(Math.round(discountAmount))}
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
                          {formatCurrency(Math.round(finalTotal))}
                        </Typography>
                      </Box>
                    </Box>
                  </>
                )
              })()}
            </Box>
          </Paper>
        </Grid>

        {/* Right Column - Actions */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Műveletek
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Munki szerkesztés */}
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={handleEdit}
                  fullWidth
                >
                  Munki szerkesztés
                </Button>

                {/* Kedvezmény */}
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<EditIcon />}
                  fullWidth
                  disabled
                >
                  Kedvezmény ({quoteData.discount_percent}%)
                </Button>

                {/* Megjegyzés */}
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<EditIcon />}
                  fullWidth
                  disabled
                >
                  Megjegyzés
                </Button>

                <Divider />

                {/* PDF generálás */}
                <Button
                  variant="outlined"
                  color="info"
                  startIcon={isGeneratingPdf ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf}
                  fullWidth
                >
                  {isGeneratingPdf ? 'PDF generálása...' : 'PDF generálás'}
                </Button>

                <Divider />

                {/* Gyártásba adás */}
                <Button
                  variant="outlined"
                  color="warning"
                  fullWidth
                  disabled
                >
                  Gyártásba adás
                </Button>

                {/* Fizetés hozzáadás */}
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<PaymentIcon />}
                  fullWidth
                  disabled
                >
                  Fizetés hozzáadás
                </Button>

                {/* Megrendelés */}
                {quoteData.status === 'draft' && (
                  <Button
                    variant="outlined"
                    startIcon={<OrderIcon />}
                    fullWidth
                    disabled
                  >
                    Megrendelés
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
