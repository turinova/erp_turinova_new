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

interface AccessoryFormClientProps {
  initialData?: AccessoryFormData
  vatRates: VatRate[]
  currencies: Currency[]
  units: Unit[]
  partners: Partner[]
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
    }
    return null
  }

  // Get source type label
  const getSourceTypeLabel = (sourceType: string) => {
    const labels: Record<string, string> = {
      'pos_sale': 'POS eladás',
      'purchase_receipt': 'Beszerzési bevételezés',
      'quote': 'Árajánlat',
      'adjustment': 'Készletigazítás'
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
    setFormData(prev => ({
      ...prev,
      net_price: calculatedNetPrice
    }))
  }, [formData.base_price, formData.multiplier])

  // Calculate VAT and gross prices when net_price changes
  useEffect(() => {
    const selectedVat = vatRates.find(vat => vat.id === formData.vat_id)
    if (selectedVat && formData.net_price > 0) {
      const vatAmount = (formData.net_price * selectedVat.kulcs) / 100
      const grossPrice = formData.net_price + vatAmount
      
      setCalculatedPrices({
        vat_amount: vatAmount,
        gross_price: grossPrice
      })
    } else {
      setCalculatedPrices({
        vat_amount: 0,
        gross_price: formData.net_price
      })
    }
  }, [formData.net_price, formData.vat_id, vatRates])

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
                        onChange={(e) => handleInputChange('barcode', e.target.value)}
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
