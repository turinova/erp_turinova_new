'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardHeader,
  CardContent,
  Stack,
  Breadcrumbs,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Pagination,
  IconButton,
  InputAdornment
} from '@mui/material'
import TabPanel from '@mui/lab/TabPanel'
import TabContext from '@mui/lab/TabContext'
import CustomTabList from '@core/components/mui/TabList'
import Tab from '@mui/material/Tab'
import { Home as HomeIcon, Add as AddIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { toast } from 'react-toastify'
import ImageUpload from '@/components/ImageUpload'
import MediaLibraryModal from '@/components/MediaLibraryModal'

interface AccessoryFormData {
  id?: string
  name: string
  sku: string
  barcode?: string | null
  base_price: number
  multiplier: number
  net_price: number
  vat_id: string
  currency_id: string
  units_id: string
  partners_id: string
  image_url?: string | null
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

interface StockMovementRow {
  id: string
  stock_movement_number: string
  warehouse_name: string
  product_type: string
  product_name: string
  sku: string
  quantity: number
  movement_type: string
  source_type: string
  source_id: string | null
  source_reference: string
  created_at: string
  note: string
}

interface PriceHistory {
  id: string
  old_base_price?: number | null
  new_base_price?: number | null
  old_multiplier?: number | null
  new_multiplier?: number | null
  old_net_price?: number | null
  new_net_price?: number | null
  old_currency_id?: string | null
  new_currency_id?: string | null
  old_vat_id?: string | null
  new_vat_id?: string | null
  old_currency?: { name: string } | null
  new_currency?: { name: string } | null
  old_vat?: { kulcs: number } | null
  new_vat?: { kulcs: number } | null
  changed_at: string
  changed_by: string | null
  changed_by_user?: string | null
  source_type?: string | null
  source_reference?: string | null
}

interface AccessoryFormClientProps {
  initialData?: AccessoryFormData
  vatRates: VatRate[]
  currencies: Currency[]
  units: Unit[]
  partners: Partner[]
  initialPriceHistory?: PriceHistory[]
  initialStockMovements?: StockMovementRow[]
  stockMovementsTotalCount?: number
  stockMovementsTotalPages?: number
  stockMovementsCurrentPage?: number
  currentStock?: {
    quantity_on_hand: number
    stock_value: number
    last_movement_at: string | null
  } | null
}

export default function AccessoryFormClient({ 
  initialData, 
  vatRates, 
  currencies, 
  units, 
  partners,
  initialPriceHistory = [],
  initialStockMovements = [],
  stockMovementsTotalCount = 0,
  stockMovementsTotalPages = 0,
  stockMovementsCurrentPage = 1,
  currentStock = null
}: AccessoryFormClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('1')
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>(initialPriceHistory)
  const [stockMovements, setStockMovements] = useState<StockMovementRow[]>(initialStockMovements)
  const [stockMovementsPage, setStockMovementsPage] = useState(stockMovementsCurrentPage)
  const [stockMovementsTotal, setStockMovementsTotal] = useState(stockMovementsTotalCount)
  const [stockMovementsPages, setStockMovementsPages] = useState(stockMovementsTotalPages)
  const [formData, setFormData] = useState<AccessoryFormData>({
    name: '',
    sku: '',
    barcode: null,
    base_price: 0,
    multiplier: 1.38,
    net_price: 0,
    vat_id: '',
    currency_id: '',
    units_id: '',
    partners_id: '',
    image_url: null
  })

  // Ensure client-side only rendering for media library button
  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync stock movements when initialStockMovements changes
  useEffect(() => {
    setStockMovements(initialStockMovements)
    setStockMovementsPage(stockMovementsCurrentPage)
    setStockMovementsTotal(stockMovementsTotalCount)
    setStockMovementsPages(stockMovementsTotalPages)
  }, [initialStockMovements, stockMovementsCurrentPage, stockMovementsTotalCount, stockMovementsTotalPages])

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue)
  }

  // Handle stock movements page change
  const handleStockMovementsPageChange = async (event: React.ChangeEvent<unknown>, value: number) => {
    if (!initialData?.id) return
    
    setStockMovementsPage(value)
    try {
      const response = await fetch(`/api/accessories/${initialData.id}/stock-movements?page=${value}&limit=50`)
      if (response.ok) {
        const data = await response.json()
        setStockMovements(data.stockMovements || [])
        setStockMovementsTotal(data.totalCount || 0)
        setStockMovementsPages(data.totalPages || 0)
      }
    } catch (error) {
      console.error('Error fetching stock movements:', error)
    }
  }

  // Get source link for stock movement
  const getSourceLink = (row: StockMovementRow) => {
    if (row.source_type === 'pos_sale' && row.source_id) {
      return `/pos-orders/${row.source_id}`
    } else if (row.source_type === 'purchase_receipt' && row.source_id) {
      return `/shipments/${row.source_id}`
    } else if (row.source_type === 'customer_order_handover' && row.source_id) {
      return `/fulfillment-orders/${row.source_id}`
    } else if (row.source_type === 'customer_order_reservation' && row.source_id) {
      return `/fulfillment-orders/${row.source_id}`
    }
    return null
  }

  // Get source type label
  const getSourceTypeLabel = (sourceType: string) => {
    const labels: Record<string, string> = {
      'pos_sale': 'POS eladás',
      'purchase_receipt': 'Beszerzési bevételezés',
      'quote': 'Árajánlat',
      'adjustment': 'Készletigazítás',
      'customer_order_handover': 'Megrendelés átadás',
      'customer_order_reservation': 'Foglalás'
    }
    return labels[sourceType] || sourceType
  }

  // Set default values when component mounts
  useEffect(() => {
    if (!initialData && vatRates.length > 0 && currencies.length > 0) {
      // Find 27% VAT rate
      const vat27 = vatRates.find(vat => vat.kulcs === 27)
      // Find HUF currency
      const hufCurrency = currencies.find(currency => currency.name === 'HUF')
      
      if (vat27 && hufCurrency) {
        setFormData(prev => ({
          ...prev,
          vat_id: vat27.id,
          currency_id: hufCurrency.id
        }))
      }
    }
  }, [vatRates, currencies, initialData])

  const [calculatedPrices, setCalculatedPrices] = useState({
    vat_amount: 0,
    gross_price: 0
  })

  // Initialize form data if editing
  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    }
  }, [initialData])

  // Auto-calculate net_price when base_price or multiplier changes
  useEffect(() => {
    const calculatedNetPrice = Math.round(formData.base_price * formData.multiplier)
    // Only update if the value actually changed to prevent infinite loops
    if (calculatedNetPrice !== formData.net_price) {
      setFormData(prev => ({
        ...prev,
        net_price: calculatedNetPrice
      }))
    }
  }, [formData.base_price, formData.multiplier, formData.net_price])

  // Calculate VAT and gross prices when net_price changes
  useEffect(() => {
    const selectedVat = vatRates.find(vat => vat.id === formData.vat_id)
    if (selectedVat && formData.net_price > 0) {
      const vatAmount = (formData.net_price * selectedVat.kulcs) / 100
      const grossPrice = formData.net_price + vatAmount
      
      // Only update if values actually changed to prevent infinite loops
      setCalculatedPrices(prev => {
        if (prev.vat_amount === vatAmount && prev.gross_price === grossPrice) {
          return prev // Return same reference if no change
        }
        return {
          vat_amount: vatAmount,
          gross_price: grossPrice
        }
      })
    } else {
      // Only update if values actually changed to prevent infinite loops
      setCalculatedPrices(prev => {
        if (prev.vat_amount === 0 && prev.gross_price === formData.net_price) {
          return prev // Return same reference if no change
        }
        return {
          vat_amount: 0,
          gross_price: formData.net_price
        }
      })
    }
  }, [formData.net_price, formData.vat_id, vatRates])

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

  const handleInputChange = (field: keyof AccessoryFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const generateEAN13 = (): string => {
    // EAN-13 format: 12 digits + 1 check digit
    // Generate 12 random digits (first digit should be 0-9, rest can be 0-9)
    let code = ''
    for (let i = 0; i < 12; i++) {
      code += Math.floor(Math.random() * 10).toString()
    }
    
    // Calculate check digit
    let sum = 0
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code[i])
      // Odd positions (1-indexed) are multiplied by 1, even by 3
      if ((i + 1) % 2 === 1) {
        sum += digit
      } else {
        sum += digit * 3
      }
    }
    const checkDigit = (10 - (sum % 10)) % 10
    return code + checkDigit.toString()
  }

  const handleGenerateBarcode = () => {
    const newBarcode = generateEAN13()
    handleInputChange('barcode', newBarcode)
    toast.success('EAN-13 vonalkód generálva', {
      position: "top-right",
      autoClose: 2000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    if (!formData.name.trim() || !formData.sku.trim() || formData.base_price <= 0 || 
        formData.multiplier < 1.0 || formData.multiplier > 5.0 ||
        !formData.vat_id || !formData.currency_id || !formData.units_id || !formData.partners_id) {
      toast.error('Minden mező kitöltése kötelező', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
      return
    }

    setLoading(true)
    try {
      const url = initialData?.id ? `/api/accessories/${initialData.id}` : '/api/accessories'
      const method = initialData?.id ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(initialData?.id ? 'Termék sikeresen frissítve' : 'Termék sikeresen létrehozva', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        router.push('/accessories')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Hiba a mentés során', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
      }
    } catch (error) {
      console.error('Submit error:', error)
      toast.error('Hiba a mentés során', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          component={NextLink}
          underline="hover"
          color="inherit"
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link
          component={NextLink}
          underline="hover"
          color="inherit"
          href="/accessories"
        >
          Termékek
        </Link>
        <Typography color="text.primary">
          {initialData?.id ? 'Szerkesztés' : 'Új termék'}
        </Typography>
      </Breadcrumbs>

      <Typography variant="h4" component="h1" gutterBottom>
        {initialData?.id ? 'Termék szerkesztése' : 'Új termék'}
      </Typography>

      {/* Tabs */}
      <TabContext value={activeTab}>
        <CustomTabList pill='true' onChange={handleTabChange} aria-label='accessory tabs'>
          <Tab value='1' label='Alap adatok' />
          <Tab value='2' label='Készlet' />
        </CustomTabList>

        {/* Tab 1: Alap adatok */}
        <TabPanel value='1' sx={{ p: 0, pt: 3 }}>
          <form onSubmit={handleSubmit}>
        <Stack spacing={3}>
          {/* Row 1: Alap információk and Képfeltöltés */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardHeader title="Alap információk" />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth required disabled={loading}>
                        <InputLabel>Partner</InputLabel>
                        <Select
                          value={formData.partners_id}
                          onChange={(e) => handleInputChange('partners_id', e.target.value)}
                          label="Partner"
                        >
                          {partners.map((partner) => (
                            <MenuItem key={partner.id} value={partner.id}>
                              {partner.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Termék neve"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        required
                        disabled={loading}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="SKU"
                        value={formData.sku}
                        onChange={(e) => handleInputChange('sku', e.target.value)}
                        required
                        disabled={loading}
                        helperText="Egyedi termékszám"
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Vonalkód"
                        value={formData.barcode || ''}
                        onChange={(e) => handleInputChange('barcode', normalizeBarcode(e.target.value))}
                        disabled={loading}
                        helperText="Opcionális"
                        InputProps={{
                          endAdornment: !formData.barcode ? (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={handleGenerateBarcode}
                                disabled={loading}
                                color="primary"
                                edge="end"
                              >
                                <AddIcon fontSize="small" />
                              </IconButton>
                            </InputAdornment>
                          ) : null
                        }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardHeader title="Képfeltöltés" />
                <CardContent>
                  <ImageUpload
                    currentImageUrl={formData.image_url || undefined}
                    onImageChange={(url) => handleInputChange('image_url', url || '')}
                    materialId={initialData?.id || 'new'}
                    disabled={loading}
                    bucketName="accessories"
                    pathPrefix="accessories"
                    altText="Accessory preview"
                    registerInMediaFiles={true}
                  />
                  {mounted && (
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        vagy
                      </Typography>
                      <Button
                        variant="outlined"
                        onClick={() => setMediaLibraryOpen(true)}
                        disabled={loading}
                        fullWidth
                      >
                        Média könyvtárból választás
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Card 2: Árazás */}
          <Card>
            <CardHeader title="Árazás" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Beszerzési ár (Ft)"
                    type="number"
                    value={formData.base_price}
                    onChange={(e) => handleInputChange('base_price', parseFloat(e.target.value) || 0)}
                    required
                    disabled={loading}
                    inputProps={{ min: 0, step: 1 }}
                    helperText="Szorzó előtti beszerzési ár"
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Árrés szorzó"
                    type="number"
                    value={formData.multiplier}
                    onChange={(e) => handleInputChange('multiplier', parseFloat(e.target.value) || 1.38)}
                    required
                    disabled={loading}
                    inputProps={{ min: 1.0, max: 5.0, step: 0.01 }}
                    helperText="1.00 - 5.00 közötti érték"
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Nettó ár (Ft)"
                    type="number"
                    value={formData.net_price}
                    helperText="Automatikusan számított"
                    inputProps={{ 
                      min: 0, 
                      step: 1,
                      readOnly: true
                    }}
                    sx={{
                      '& .MuiInputBase-input[readonly]': {
                        cursor: 'default',
                        WebkitTextFillColor: 'inherit'
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControl fullWidth required disabled={loading}>
                    <InputLabel>ÁFA</InputLabel>
                    <Select
                      value={formData.vat_id}
                      onChange={(e) => handleInputChange('vat_id', e.target.value)}
                      label="ÁFA"
                    >
                      {vatRates.map((vat) => (
                        <MenuItem key={vat.id} value={vat.id}>
                          {vat.name} ({vat.kulcs}%)
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControl fullWidth required disabled={loading}>
                    <InputLabel>Pénznem</InputLabel>
                    <Select
                      value={formData.currency_id}
                      onChange={(e) => handleInputChange('currency_id', e.target.value)}
                      label="Pénznem"
                    >
                      {currencies.map((currency) => (
                        <MenuItem key={currency.id} value={currency.id}>
                          {currency.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControl fullWidth required disabled={loading}>
                    <InputLabel>Mértékegység</InputLabel>
                    <Select
                      value={formData.units_id}
                      onChange={(e) => handleInputChange('units_id', e.target.value)}
                      label="Mértékegység"
                    >
                      {units.map((unit) => (
                        <MenuItem key={unit.id} value={unit.id}>
                          {unit.name} ({unit.shortform})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Card 3: Ár számítás */}
          <Card>
            <CardHeader title="Ár számítás" />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Beszerzési ár
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(formData.base_price)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Árrés szorzó
                    </Typography>
                    <Typography variant="h6" color="info.main">
                      {formData.multiplier}x
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Nettó ár
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(formData.net_price)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Bruttó ár
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary">
                      {formatCurrency(calculatedPrices.gross_price)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Card 4: Ár történet */}
          {initialData?.id && priceHistory.length > 0 && (
            <Card>
              <CardHeader title="Ár történet" />
              <CardContent>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Dátum</TableCell>
                        <TableCell align="right">Régi beszerzési ár</TableCell>
                        <TableCell align="right">Régi szorzó</TableCell>
                        <TableCell align="right">Régi nettó</TableCell>
                        <TableCell align="right">Régi bruttó</TableCell>
                        <TableCell align="right">Új beszerzési ár</TableCell>
                        <TableCell align="right">Új szorzó</TableCell>
                        <TableCell align="right">Új nettó</TableCell>
                        <TableCell align="right">Új bruttó</TableCell>
                        <TableCell align="right">Változás</TableCell>
                        <TableCell>Módosító</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {priceHistory.map((h) => {
                        const oldNetPrice = h.old_net_price || 0
                        const newNetPrice = h.new_net_price || 0
                        const netDiff = newNetPrice - oldNetPrice
                        const netChangePercent = oldNetPrice > 0 
                          ? ((netDiff / oldNetPrice) * 100).toFixed(1)
                          : '0'
                        
                        // Use historical VAT rates if available
                        const oldVatPercent = h.old_vat?.kulcs || (vatRates.find(v => v.id === formData.vat_id)?.kulcs || 27)
                        const newVatPercent = h.new_vat?.kulcs || (vatRates.find(v => v.id === formData.vat_id)?.kulcs || 27)
                        
                        // Calculate gross prices with historical VAT
                        const oldGross = oldNetPrice + (oldNetPrice * oldVatPercent / 100)
                        const newGross = newNetPrice + (newNetPrice * newVatPercent / 100)
                        const grossDiff = newGross - oldGross
                        
                        // Get currency names
                        const oldCurrencyName = h.old_currency?.name || currencies.find(c => c.id === formData.currency_id)?.name || 'Ft'
                        const newCurrencyName = h.new_currency?.name || currencies.find(c => c.id === formData.currency_id)?.name || 'Ft'
                        
                        const formatPriceWithCurrency = (price: number, currencyName: string) => {
                          return `${price.toLocaleString('hu-HU', { maximumFractionDigits: 0 })} ${currencyName}`
                        }
                        
                        return (
                          <TableRow key={h.id}>
                            <TableCell>
                              {new Date(h.changed_at).toLocaleString('hu-HU', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'error.lighter', borderLeft: '3px solid', borderLeftColor: 'error.main' }}>
                              <Typography variant="body2" color="error.dark">
                                {h.old_base_price !== null && h.old_base_price !== undefined 
                                  ? `${h.old_base_price.toLocaleString('hu-HU')} ${oldCurrencyName}`
                                  : '-'
                                }
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'error.lighter' }}>
                              <Typography variant="body2" color="error.dark">
                                {h.old_multiplier !== null && h.old_multiplier !== undefined 
                                  ? h.old_multiplier.toFixed(2)
                                  : '-'
                                }
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'error.lighter' }}>
                              <Typography variant="body2" color="error.dark">
                                {formatPriceWithCurrency(oldNetPrice, oldCurrencyName)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'error.lighter' }}>
                              <Typography variant="body2" fontWeight="medium" color="error.dark">
                                {formatPriceWithCurrency(oldGross, oldCurrencyName)}
                              </Typography>
                              {h.old_vat && (
                                <Typography variant="caption" color="text.secondary">
                                  ({h.old_vat.kulcs}% ÁFA)
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'success.lighter', borderLeft: '3px solid', borderLeftColor: 'success.main' }}>
                              <Typography variant="body2" color="success.dark">
                                {h.new_base_price !== null && h.new_base_price !== undefined 
                                  ? `${h.new_base_price.toLocaleString('hu-HU')} ${newCurrencyName}`
                                  : '-'
                                }
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'success.lighter' }}>
                              <Typography variant="body2" color="success.dark">
                                {h.new_multiplier !== null && h.new_multiplier !== undefined 
                                  ? h.new_multiplier.toFixed(2)
                                  : '-'
                                }
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'success.lighter' }}>
                              <Typography variant="body2" color="success.dark">
                                {formatPriceWithCurrency(newNetPrice, newCurrencyName)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'success.lighter' }}>
                              <Typography variant="body2" fontWeight="medium" color="success.dark">
                                {formatPriceWithCurrency(newGross, newCurrencyName)}
                              </Typography>
                              {h.new_vat && (
                                <Typography variant="caption" color="text.secondary">
                                  ({h.new_vat.kulcs}% ÁFA)
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Box>
                                <Typography 
                                  variant="body2" 
                                  color={netDiff >= 0 ? 'error.main' : 'success.main'}
                                  fontWeight="medium"
                                >
                                  Nettó: {netDiff >= 0 ? '+' : ''}{formatPriceWithCurrency(netDiff, newCurrencyName)}
                                </Typography>
                                <Typography 
                                  variant="body2" 
                                  color={grossDiff >= 0 ? 'error.main' : 'success.main'}
                                  fontWeight="bold"
                                >
                                  Bruttó: {grossDiff >= 0 ? '+' : ''}{formatPriceWithCurrency(grossDiff, newCurrencyName)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ({netDiff >= 0 ? '+' : ''}{netChangePercent}%)
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {h.changed_by_user || 'Rendszer'}
                              </Typography>
                              {h.source_type && h.source_type !== 'edit_page' && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {h.source_type === 'shipment' ? 'Szállítmány' : h.source_type === 'excel_import' ? 'Excel import' : h.source_type}
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => router.back()}
              disabled={loading}
            >
              Vissza
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : undefined}
            >
              {loading ? 'Mentés...' : (initialData?.id ? 'Frissítés' : 'Mentés')}
            </Button>
          </Box>
        </Stack>
      </form>
        </TabPanel>

        {/* Tab 2: Készlet */}
        <TabPanel value='2' sx={{ p: 0, pt: 3 }}>
          <Grid container spacing={3}>
            {/* Inventory Summary Card */}
            <Grid item xs={12}>
              <Card>
                <CardHeader title="Készlet összesítő" />
                <CardContent>
                  {currentStock ? (
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Készleten</Typography>
                          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                            {currentStock.quantity_on_hand} db
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Készlet értéke</Typography>
                          <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            {formatCurrency(currentStock.stock_value)}
                          </Typography>
                        </Box>
                      </Grid>
                      {currentStock.last_movement_at && (
                        <Grid item xs={12} sm={6} md={3}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Utolsó mozgás</Typography>
                            <Typography variant="body2">
                              {new Date(currentStock.last_movement_at).toLocaleDateString('hu-HU', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Nincs készlet adat. A termék még nem érkezett be a raktárba.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Stock Movements Table */}
            <Grid item xs={12}>
              <Card>
                <CardHeader title="Készlet mozgások" />
                <CardContent>
                  {stockMovements.length > 0 ? (
                    <>
                      <TableContainer component={Paper}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell>Mozgás szám</TableCell>
                              <TableCell>Dátum</TableCell>
                              <TableCell>Raktár</TableCell>
                              <TableCell>Termék típus</TableCell>
                              <TableCell>Termék név</TableCell>
                              <TableCell>SKU</TableCell>
                              <TableCell align="right">Mennyiség</TableCell>
                              <TableCell>Mozgás típus</TableCell>
                              <TableCell>Forrás típus</TableCell>
                              <TableCell>Forrás</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {stockMovements.map((row) => {
                              const sourceLink = getSourceLink(row)
                              const quantityColor = row.quantity > 0 ? 'success.main' : row.quantity < 0 ? 'error.main' : 'text.primary'
                              const quantitySign = row.quantity > 0 ? '+' : ''
                              
                              return (
                                <TableRow
                                  key={row.id}
                                  hover
                                  sx={{ cursor: sourceLink ? 'pointer' : 'default' }}
                                  onClick={() => sourceLink && router.push(sourceLink)}
                                >
                                  <TableCell><strong>{row.stock_movement_number}</strong></TableCell>
                                  <TableCell>{row.created_at ? new Date(row.created_at).toLocaleDateString('hu-HU', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : ''}</TableCell>
                                  <TableCell>{row.warehouse_name}</TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={row.product_type === 'accessory' ? 'Kellék' : row.product_type === 'material' ? 'Táblás anyag' : 'Szálas anyag'} 
                                      size="small"
                                      color="info"
                                      variant="outlined"
                                    />
                                  </TableCell>
                                  <TableCell>{row.product_name || '-'}</TableCell>
                                  <TableCell>{row.sku || '-'}</TableCell>
                                  <TableCell align="right">
                                    <Typography sx={{ color: quantityColor, fontWeight: 500 }}>
                                      {quantitySign}{new Intl.NumberFormat('hu-HU', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      }).format(row.quantity)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={row.movement_type === 'in' ? 'Bejövő' : row.movement_type === 'out' ? 'Kimenő' : 'Igazítás'} 
                                      size="small"
                                      color={
                                        row.movement_type === 'in' ? 'success' :
                                        row.movement_type === 'out' ? 'error' :
                                        'warning'
                                      }
                                    />
                                  </TableCell>
                                  <TableCell>{getSourceTypeLabel(row.source_type)}</TableCell>
                                  <TableCell>
                                    {sourceLink ? (
                                      <Link
                                        component={NextLink}
                                        href={sourceLink}
                                        onClick={(e) => e.stopPropagation()}
                                        underline="hover"
                                      >
                                        {row.source_reference}
                                      </Link>
                                    ) : (
                                      row.source_reference
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      {/* Pagination */}
                      {stockMovementsPages > 1 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                          <Pagination
                            count={stockMovementsPages}
                            page={stockMovementsPage}
                            onChange={handleStockMovementsPageChange}
                            color="primary"
                            showFirstButton
                            showLastButton
                          />
                        </Box>
                      )}
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Még nincs készlet mozgás ennél a terméknél.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </TabContext>

      {/* Media Library Modal */}
      {mounted && (
        <MediaLibraryModal
          open={mediaLibraryOpen}
          onClose={() => setMediaLibraryOpen(false)}
          onSelect={(url) => {
            handleInputChange('image_url', url)
            setMediaLibraryOpen(false)
          }}
          currentImageUrl={formData.image_url || undefined}
        />
      )}
    </Box>
  )
}
