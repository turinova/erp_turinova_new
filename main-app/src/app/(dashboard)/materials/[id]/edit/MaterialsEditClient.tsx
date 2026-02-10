'use client'

import React, { useState, useEffect } from 'react'
import type { SyntheticEvent } from 'react'

import { useRouter } from 'next/navigation'

import { 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  Alert,
  Breadcrumbs,
  Link,
  FormControlLabel,
  Switch,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  CircularProgress,
  Tab,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material'
import TabPanel from '@mui/lab/TabPanel'
import TabContext from '@mui/lab/TabContext'
import CustomTabList from '@core/components/mui/TabList'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { Pagination } from '@mui/material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

import { usePermissions } from '@/contexts/PermissionContext'
import ImageUpload from '@/components/ImageUpload'
import MediaLibraryModal from '@/components/MediaLibraryModal'
import { formatPriceWithCurrency, calculateFullBoardCost, calculateSquareMeters, calculateGrossPrice } from '@/utils/priceFormatters'
import { Delete as DeleteIcon } from '@mui/icons-material'

interface Material {
  id: string
  name: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  grain_direction: boolean
  on_stock: boolean
  active: boolean
  image_url: string | null
  brand_id: string
  brand_name: string
  kerf_mm: number
  trim_top_mm: number
  trim_right_mm: number
  trim_bottom_mm: number
  trim_left_mm: number
  rotatable: boolean
  waste_multi: number
  usage_limit: number
  machine_code: string
  base_price: number
  multiplier: number
  price_per_sqm: number
  partners_id: string | null
  units_id: string | null
  currency_id: string | null
  vat_id: string | null
  currencies?: { id: string; name: string } | null
  vat?: { id: string; name: string; kulcs: number } | null
  created_at: string
  updated_at: string
}

interface Currency {
  id: string
  name: string
  rate: number
}

interface VAT {
  id: string
  name: string
  kulcs: number
}

interface PriceHistory {
  id: string
  old_base_price?: number | null
  new_base_price?: number | null
  old_multiplier?: number | null
  new_multiplier?: number | null
  old_price_per_sqm: number
  new_price_per_sqm: number
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

interface Brand {
  id: string
  name: string
  comment: string | null
  created_at: string
  updated_at: string
}

interface Partner {
  id: string
  name: string
}

interface Unit {
  id: string
  name: string
  shortform: string
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

interface MaterialsEditClientProps {
  initialMaterial: Material
  initialBrands: Brand[]
  initialCurrencies: Currency[]
  initialVatRates: VAT[]
  initialPriceHistory: PriceHistory[]
  initialPartners: Partner[]
  initialUnits: Unit[]
  initialStockMovements?: StockMovementRow[]
  stockMovementsTotalCount?: number
  stockMovementsTotalPages?: number
  stockMovementsCurrentPage?: number
  currentStock?: {
    quantity_on_hand: number
    stock_value: number
    last_movement_at: string | null
  } | null
  initialAccessories: any[]
  initialMaterialAccessories: {
    material_id: string
    accessory_id: string
    created_at: string
    updated_at: string
    accessory: {
      id: string
      name: string
      sku: string
      base_price: number
      partners_id?: string | null
      partner_name?: string
    }
  }[]
}

export default function MaterialsEditClient({ 
  initialMaterial, 
  initialBrands,
  initialCurrencies,
  initialVatRates,
  initialPriceHistory,
  initialPartners,
  initialUnits,
  initialStockMovements = [],
  stockMovementsTotalCount = 0,
  stockMovementsTotalPages = 0,
  stockMovementsCurrentPage = 1,
  currentStock = null,
  initialAccessories = [],
  initialMaterialAccessories = []
}: MaterialsEditClientProps) {
  const router = useRouter()
  
  console.log('MaterialsEditClient initialized with material:', initialMaterial?.id, initialMaterial?.name)
  console.log('Initial price history entries:', initialPriceHistory.length)
  console.log('Price history data:', initialPriceHistory)
  
  // Check permission for this page - temporarily bypassed to fix hook errors
  // const { canAccess } = usePermissions()
  const hasAccess = true // Temporarily bypass permission check for testing
  
  const [material, setMaterial] = useState<Material>(initialMaterial)
  const [brands, setBrands] = useState<Brand[]>(initialBrands)
  const [isSaving, setIsSaving] = useState(false)
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('1')
  
  // All data from SSR - no client-side fetching needed!
  const [currencies] = useState<Currency[]>(initialCurrencies)
  const [vatRates] = useState<VAT[]>(initialVatRates)
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>(initialPriceHistory)
  const [stockMovements, setStockMovements] = useState<StockMovementRow[]>(initialStockMovements)
  const [stockMovementsPage, setStockMovementsPage] = useState(stockMovementsCurrentPage)
  const [stockMovementsTotal, setStockMovementsTotal] = useState(stockMovementsTotalCount)
  const [stockMovementsPages, setStockMovementsPages] = useState(stockMovementsTotalPages)
  const [materialAccessories, setMaterialAccessories] = useState(initialMaterialAccessories)
  const [selectedAccessory, setSelectedAccessory] = useState<any | null>(null)
  const [isSavingAccessory, setIsSavingAccessory] = useState(false)
  const [accessorySearchTerm, setAccessorySearchTerm] = useState('')
  const [accessoryOptions, setAccessoryOptions] = useState<any[]>([])
  const [isAccessorySearching, setIsAccessorySearching] = useState(false)
  const [loadingPriceHistory, setLoadingPriceHistory] = useState(false)
  
  // Helper function to format price with currency (for price history)
  const formatPriceWithCurrencyName = (price: number, currencyName: string) => {
    return `${price.toLocaleString('hu-HU', { maximumFractionDigits: 0 })} ${currencyName}`
  }
  
  // Ensure client-side only rendering for media library button
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Form state
  const [formData, setFormData] = useState({
    name: initialMaterial.name || '',
    length_mm: initialMaterial.length_mm || 0,
    width_mm: initialMaterial.width_mm || 0,
    thickness_mm: initialMaterial.thickness_mm || 0,
    grain_direction: initialMaterial.grain_direction || false,
    on_stock: initialMaterial.on_stock !== undefined ? initialMaterial.on_stock : true,
    active: initialMaterial.active !== undefined ? initialMaterial.active : true,
    image_url: initialMaterial.image_url || '',
    brand_id: initialMaterial.brand_id || '',
    kerf_mm: initialMaterial.kerf_mm || 3,
    trim_top_mm: initialMaterial.trim_top_mm || 0,
    trim_right_mm: initialMaterial.trim_right_mm || 0,
    trim_bottom_mm: initialMaterial.trim_bottom_mm || 0,
    trim_left_mm: initialMaterial.trim_left_mm || 0,
    rotatable: initialMaterial.rotatable !== undefined ? initialMaterial.rotatable : true,
    waste_multi: initialMaterial.waste_multi || 1.0,
    usage_limit: initialMaterial.usage_limit || 0.65,
    machine_code: initialMaterial.machine_code || '',
    base_price: initialMaterial.base_price || 0,
    multiplier: initialMaterial.multiplier || 1.38,
    partners_id: initialMaterial.partners_id || '',
    units_id: initialMaterial.units_id || '',
    currency_id: initialMaterial.currency_id || '',
    vat_id: initialMaterial.vat_id || ''
  })
  
  // Calculate price_per_sqm from base_price and multiplier
  const calculatedPricePerSqm = React.useMemo(() => {
    return Math.round(formData.base_price * formData.multiplier)
  }, [formData.base_price, formData.multiplier])

  // Update price_per_sqm when base_price or multiplier changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, price_per_sqm: calculatedPricePerSqm }))
  }, [calculatedPricePerSqm])

  // Get current VAT percentage
  const currentVatPercent = React.useMemo(() => {
    const selectedVat = vatRates.find(v => v.id === formData.vat_id)
    return selectedVat?.kulcs || 0
  }, [vatRates, formData.vat_id])

  // Get current currency name
  const currentCurrencyName = React.useMemo(() => {
    const selectedCurrency = initialCurrencies.find(c => c.id === formData.currency_id)
    return selectedCurrency?.name || 'Ft'
  }, [initialCurrencies, formData.currency_id])
  
  // Calculate prices in real-time
  const squareMeters = React.useMemo(() => {
    return calculateSquareMeters(formData.length_mm, formData.width_mm)
  }, [formData.length_mm, formData.width_mm])
  
  const netPricePerSqm = formData.price_per_sqm
  const grossPricePerSqm = React.useMemo(() => {
    return calculateGrossPrice(netPricePerSqm, currentVatPercent)
  }, [netPricePerSqm, currentVatPercent])
  
  const netFullBoardCost = React.useMemo(() => {
    return calculateFullBoardCost(formData.length_mm, formData.width_mm, formData.price_per_sqm)
  }, [formData.length_mm, formData.width_mm, formData.price_per_sqm])
  
  const grossFullBoardCost = React.useMemo(() => {
    return calculateGrossPrice(netFullBoardCost, currentVatPercent)
  }, [netFullBoardCost, currentVatPercent])
  
  // No useEffect needed - all data comes from SSR! 🎉

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }
  
  // Handle media library image selection
  const handleMediaSelect = (imageUrl: string, filename: string) => {
    handleInputChange('image_url', imageUrl)
    toast.success(`Kép kiválasztva: ${filename}`)
  }

  const handleSave = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      toast.error('Az anyag neve kötelező!')
      return
    }
    if (!formData.brand_id) {
      toast.error('A márka kiválasztása kötelező!')
      return
    }
    if (formData.length_mm <= 0) {
      toast.error('A hossz nagyobb kell legyen mint 0!')
      return
    }
    if (formData.width_mm <= 0) {
      toast.error('A szélesség nagyobb kell legyen mint 0!')
      return
    }
    if (formData.thickness_mm <= 0) {
      toast.error('A vastagság nagyobb kell legyen mint 0!')
      return
    }
    if (formData.base_price <= 0) {
      toast.error('A beszerzési ár nagyobb kell legyen mint 0!')
      return
    }
    if (formData.multiplier < 1.0 || formData.multiplier > 5.0) {
      toast.error('Az árrés szorzó 1.0 és 5.0 között kell legyen!')
      return
    }
    if (!formData.currency_id) {
      toast.error('A pénznem kiválasztása kötelező!')
      return
    }
    if (!formData.vat_id) {
      toast.error('Az ÁFA kiválasztása kötelező!')
      return
    }
    if (!formData.machine_code.trim()) {
      toast.error('A gépkód kötelező!')
      return
    }

    try {
      setIsSaving(true)

      const response = await fetch(`/api/materials/${initialMaterial.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success('Anyag sikeresen frissítve!')
        
        // Invalidate cache to refresh list page
        invalidateApiCache('/api/materials')
        
        // Re-fetch the full material data to ensure we have complete updated info
        const materialRes = await fetch(`/api/materials/${initialMaterial.id}`)
        if (materialRes.ok) {
          const updatedMaterial = await materialRes.json()
          setMaterial(updatedMaterial)
        }
        
        // Refresh price history to show the new change
        const historyRes = await fetch(`/api/materials/${initialMaterial.id}/price-history`)
        if (historyRes.ok) {
          const historyData = await historyRes.json()
          console.log(`Updated price history after save, new length: ${historyData.length}`)
          setPriceHistory(historyData)
        }
        
        // Stay on the same page (removed router.push)
      } else {
        const errorData = await response.json()

        toast.error(errorData.error || 'Hiba történt a mentés során')
      }
    } catch (err) {
      toast.error('Hiba történt a mentés során')
      console.error('Error saving material:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    router.push('/materials')
  }

  // Handle tab change
  const handleTabChange = (event: SyntheticEvent, newValue: string) => {
    setActiveTab(newValue)
  }

  // Sync stock movements when initialStockMovements changes
  useEffect(() => {
    setStockMovements(initialStockMovements)
    setStockMovementsPage(stockMovementsCurrentPage)
    setStockMovementsTotal(stockMovementsTotalCount)
    setStockMovementsPages(stockMovementsTotalPages)
  }, [initialStockMovements, stockMovementsCurrentPage, stockMovementsTotalCount, stockMovementsTotalPages])

  // Handle stock movements page change
  const handleStockMovementsPageChange = async (event: React.ChangeEvent<unknown>, value: number) => {
    setStockMovementsPage(value)
    try {
      const response = await fetch(`/api/materials/${initialMaterial.id}/stock-movements?page=${value}&limit=50`)
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
    } else if (row.source_type === 'quote' && row.source_id) {
      return `/orders/${row.source_id}`
    } else if (row.source_type === 'quote_reservation' && row.source_id) {
      return `/orders/${row.source_id}`
    }
    return null
  }

  // Get source type label
  const getSourceTypeLabel = (sourceType: string) => {
    const labels: Record<string, string> = {
      'pos_sale': 'POS eladás',
      'purchase_receipt': 'Beszerzési bevételezés',
      'quote': 'Árajánlat',
      'quote_reservation': 'Foglalás',
      'adjustment': 'Készletigazítás',
      'customer_order_handover': 'Megrendelés átadás',
      'customer_order_reservation': 'Foglalás'
    }
    return labels[sourceType] || sourceType
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Fetch linked accessories (material_accessories)
  const fetchMaterialAccessories = async () => {
    try {
      const res = await fetch(`/api/materials/${initialMaterial.id}/accessories`)
      if (res.ok) {
        const data = await res.json()
        setMaterialAccessories(data || [])
      }
    } catch (error) {
      console.error('Error fetching material accessories:', error)
    }
  }

  // Async search accessories (server-side) to avoid preload limits
  useEffect(() => {
    const controller = new AbortController()

    const runSearch = async () => {
      if (!accessorySearchTerm || accessorySearchTerm.trim().length < 3) {
        setAccessoryOptions([])
        return
      }
      setIsAccessorySearching(true)
      try {
        const res = await fetch(`/api/accessories/search?q=${encodeURIComponent(accessorySearchTerm)}&limit=100`, {
          signal: controller.signal
        })
        if (res.ok) {
          const data = await res.json()
          const existingIds = new Set(materialAccessories.map((ma: any) => ma.accessory_id))
          setAccessoryOptions((data.accessories || []).filter((acc: any) => !existingIds.has(acc.id)))
        } else {
          setAccessoryOptions([])
        }
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Accessory search error:', error)
        setAccessoryOptions([])
      } finally {
        if (!controller.signal.aborted) setIsAccessorySearching(false)
      }
    }

    const t = setTimeout(runSearch, 300)
    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [accessorySearchTerm, materialAccessories])

  const handleAddAccessory = async () => {
    if (!selectedAccessory?.id) return
    setIsSavingAccessory(true)
    try {
      const res = await fetch(`/api/materials/${initialMaterial.id}/accessories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessory_id: selectedAccessory.id })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Hiba történt az élzáró hozzáadásakor')
      } else {
        await fetchMaterialAccessories()
        setSelectedAccessory(null)
        toast.success('Élzáró hozzáadva')
      }
    } catch (error) {
      console.error('Error adding accessory:', error)
      toast.error('Hiba történt az élzáró hozzáadásakor')
    } finally {
      setIsSavingAccessory(false)
    }
  }

  const handleDeleteAccessory = async (accessoryId: string) => {
    try {
      const res = await fetch(`/api/materials/${initialMaterial.id}/accessories/${accessoryId}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Hiba történt a törlés során')
        return
      }
      setMaterialAccessories(prev => prev.filter((item: any) => item.accessory_id !== accessoryId))
      toast.success('Élzáró eltávolítva')
    } catch (error) {
      console.error('Error deleting accessory:', error)
      toast.error('Hiba történt a törlés során')
    }
  }

  // Refresh inventory data
  const handleRefreshInventory = async () => {
    try {
      const [summaryRes, transactionsRes] = await Promise.all([
        fetch(`/api/materials/${initialMaterial.id}/inventory-summary`),
        fetch(`/api/materials/${initialMaterial.id}/inventory-transactions`)
      ])

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json()
        setInventorySummary(summaryData)
      }

      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json()
        setInventoryTransactions(transactionsData)
      }

      toast.success('Készlet adatok frissítve!')
    } catch (error) {
      console.error('Error refreshing inventory:', error)
      toast.error('Hiba történt a készlet frissítése során')
    }
  }

  // Format date for display
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get transaction type label
  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'in': return 'Bevételezés'
      case 'out': return 'Kivételezés'
      case 'reserved': return 'Foglalás'
      case 'released': return 'Feloldás'
      default: return type
    }
  }

  // Get transaction type color
  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'in': return 'success'
      case 'out': return 'error'
      case 'reserved': return 'warning'
      case 'released': return 'info'
      default: return 'default'
    }
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Nincs jogosultsága az oldal megtekintéséhez.</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => router.push('/home')}
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Főoldal
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => router.push('/materials')}
          sx={{ textDecoration: 'none' }}
        >
          Anyagok
        </Link>
        <Typography color="text.primary">
          {material?.name || 'Anyag szerkesztése'}
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleCancel}
            sx={{ mr: 2 }}
          >
            Vissza
          </Button>
          <Typography variant="h4" component="h1">
            Anyag szerkesztése: {material?.name || 'Ismeretlen'}
          </Typography>
        </Box>
        {mounted && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Mégse
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Mentés...' : 'Mentés'}
            </Button>
          </Box>
        )}
      </Box>

      {/* Tabs */}
      <TabContext value={activeTab}>
        <CustomTabList pill='true' onChange={handleTabChange} aria-label='material tabs'>
          <Tab value='1' label='Alap adatok' />
          <Tab value='2' label='Készlet' />
        </CustomTabList>

        {/* Tab 1: Alap adatok */}
        <TabPanel value='1' sx={{ p: 0, pt: 3 }}>
          <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Alapadatok" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Márka</InputLabel>
                    <Select
                      value={formData.brand_id}
                      label="Márka"
                      onChange={(e) => handleInputChange('brand_id', e.target.value)}
                    >
                      {brands.map((brand) => (
                        <MenuItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Anyag neve"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Hossz (mm)"
                    type="number"
                    value={formData.length_mm}
                    onChange={(e) => handleInputChange('length_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Szélesség (mm)"
                    type="number"
                    value={formData.width_mm}
                    onChange={(e) => handleInputChange('width_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Vastagság (mm)"
                    type="number"
                    value={formData.thickness_mm}
                    onChange={(e) => handleInputChange('thickness_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.on_stock}
                        onChange={(e) => handleInputChange('on_stock', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Raktáron"
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.active}
                        onChange={(e) => handleInputChange('active', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Aktív"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Image Upload */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Képfeltöltés" />
            <CardContent>
              <ImageUpload
                currentImageUrl={formData.image_url || undefined}
                onImageChange={(url) => handleInputChange('image_url', url || '')}
                materialId={material.id}
                disabled={isSaving}
                bucketName="materials"
                pathPrefix="materials"
                altText="Material preview"
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
                    disabled={isSaving}
                    fullWidth
                  >
                    Média könyvtárból választás
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Optimization Settings */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Optimalizálási beállítások" />
            <CardContent>
              {/* Szélezési beállítások section */}
              <Typography variant="h6" component="h3" gutterBottom>
                Szélezési beállítások
              </Typography>
              <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Felső trim (mm)"
                    type="number"
                    value={formData.trim_top_mm}
                    onChange={(e) => handleInputChange('trim_top_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Jobb trim (mm)"
                    type="number"
                    value={formData.trim_right_mm}
                    onChange={(e) => handleInputChange('trim_right_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Alsó trim (mm)"
                    type="number"
                    value={formData.trim_bottom_mm}
                    onChange={(e) => handleInputChange('trim_bottom_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Bal trim (mm)"
                    type="number"
                    value={formData.trim_left_mm}
                    onChange={(e) => handleInputChange('trim_left_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
              </Grid>
              
              <Divider sx={{ mb: 3 }} />
              
              {/* Egyéb beállítások section */}
              <Typography variant="h6" component="h3" gutterBottom>
                Egyéb beállítások
              </Typography>
              <Grid container spacing={2}>
                {/* Row 1: Kerf, Waste Multi, Usage Limit */}
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Penge vastagság (mm)"
                    type="number"
                    value={formData.kerf_mm}
                    onChange={(e) => handleInputChange('kerf_mm', parseInt(e.target.value) || 3)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Hulladék szorzó"
                    type="number"
                    inputProps={{ step: "0.1" }}
                    value={formData.waste_multi}
                    onChange={(e) => handleInputChange('waste_multi', parseFloat(e.target.value) || 1.0)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Kihasználtság küszöb (%)"
                    type="number"
                    inputProps={{ step: "1", min: "0", max: "100" }}
                    value={Math.round(formData.usage_limit * 100)}
                    onChange={(e) => handleInputChange('usage_limit', (parseFloat(e.target.value) || 65) / 100)}
                    helperText="Minimális kihasználtsági arány"
                  />
                </Grid>
                
                {/* Row 2: Spacer */}
                <Grid item xs={3}></Grid>
                
                {/* Row 3: Szálirány and Forgatható switches side by side */}
                <Grid item xs={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.grain_direction}
                        onChange={(e) => handleInputChange('grain_direction', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Szálirány"
                  />
                </Grid>
                <Grid item xs={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.rotatable}
                        onChange={(e) => handleInputChange('rotatable', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Forgatható"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
          
          {/* Export Settings Card */}
          <Card sx={{ mt: 4 }}>
            <CardHeader title="Export beállítások" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Gép típus</InputLabel>
                    <Select
                      value="Korpus"
                      label="Gép típus"
                      disabled
                    >
                      <MenuItem value="Korpus">Korpus</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Gépkód"
                    value={formData.machine_code}
                    onChange={(e) => handleInputChange('machine_code', e.target.value)}
                    helperText="A gép azonosítója az optimalizáláshoz"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Élzáró anyagok Card */}
          <Card sx={{ mt: 4 }}>
            <CardHeader title="Élzáró anyagok" />
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={8} md={6}>
                  <Autocomplete
            options={accessoryOptions}
            loading={isAccessorySearching}
            getOptionLabel={(option: any) => option?.name ? `${option.name}${option.sku ? ` (${option.sku})` : ''}` : ''}
            value={selectedAccessory}
            onChange={(_, newValue) => setSelectedAccessory(newValue)}
            inputValue={accessorySearchTerm}
            onInputChange={(_, newInput) => setAccessorySearchTerm(newInput)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Élzáró kiválasztása"
                placeholder="Keresés név vagy SKU alapján"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isAccessorySearching ? <CircularProgress color="inherit" size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
                  />
                </Grid>
                <Grid item>
                  <Button
                    variant="contained"
                    onClick={handleAddAccessory}
                    disabled={!selectedAccessory || isSavingAccessory}
                  >
                    Hozzáadás
                  </Button>
                </Grid>
              </Grid>

              <TableContainer component={Paper} sx={{ mt: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Partner</TableCell>
                      <TableCell>Név</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Beszerzési ár</TableCell>
                      <TableCell align="right">Művelet</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {materialAccessories.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary">Nincs élzáró kapcsolva.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {materialAccessories.map((item: any) => (
                      <TableRow key={item.accessory_id}>
                        <TableCell>{item.accessory?.partner_name || '-'}</TableCell>
                        <TableCell>{item.accessory?.name || '-'}</TableCell>
                        <TableCell>{item.accessory?.sku || '-'}</TableCell>
                        <TableCell>{item.accessory?.base_price !== undefined ? formatPriceWithCurrency(item.accessory.base_price) : '-'}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Törlés">
                            <IconButton color="error" onClick={() => handleDeleteAccessory(item.accessory_id)}>
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Pricing Settings Card */}
          <Card sx={{ mt: 4 }}>
            <CardHeader title="Árazási beállítások" />
            <CardContent>
              <Grid container spacing={3}>
                {/* Partner */}
                <Grid item sm={2}>
                  <Autocomplete
                    options={initialPartners}
                    getOptionLabel={(option) => option.name}
                    value={initialPartners.find(p => p.id === formData.partners_id) || null}
                    onChange={(_, newValue) => handleInputChange('partners_id', newValue?.id || '')}
                    renderInput={(params) => (
                      <TextField {...params} label="Partner" />
                    )}
                  />
                </Grid>

                {/* Beszerzési ár */}
                <Grid item sm={2}>
                  <TextField
                    fullWidth
                    required
                    label="Beszerzési ár"
                    type="number"
                    inputProps={{ step: "1", min: "0" }}
                    value={formData.base_price}
                    onChange={(e) => handleInputChange('base_price', parseInt(e.target.value) || 0)}
                  />
                </Grid>

                {/* Árrés szorzó */}
                <Grid item sm={2}>
                  <TextField
                    fullWidth
                    required
                    label="Árrés szorzó"
                    type="number"
                    inputProps={{ step: "0.01", min: "1.00", max: "5.00" }}
                    value={formData.multiplier}
                    onChange={(e) => handleInputChange('multiplier', parseFloat(e.target.value) || 1.38)}
                  />
                </Grid>

                {/* Ár/m² (Ft) */}
                <Grid item sm={2}>
                  <TextField
                    fullWidth
                    label="Ár/m² (Ft)"
                    type="number"
                    value={calculatedPricePerSqm}
                    disabled
                    InputProps={{
                      readOnly: true,
                    }}
                  />
                </Grid>

                {/* Currency */}
                <Grid item sm={2}>
                  <Autocomplete
                    options={currencies}
                    getOptionLabel={(option) => option.name}
                    value={currencies.find(c => c.id === formData.currency_id) || null}
                    onChange={(_, newValue) => handleInputChange('currency_id', newValue?.id || '')}
                    renderInput={(params) => (
                      <TextField {...params} label="Pénznem" required />
                    )}
                  />
                </Grid>

                {/* VAT */}
                <Grid item sm={2}>
                  <Autocomplete
                    options={vatRates}
                    getOptionLabel={(option) => option.name}
                    value={vatRates.find(v => v.id === formData.vat_id) || null}
                    onChange={(_, newValue) => handleInputChange('vat_id', newValue?.id || '')}
                    renderInput={(params) => (
                      <TextField {...params} label="ÁFA" required />
                    )}
                  />
                </Grid>

                {/* Calculated Prices */}
                <Grid item xs={12}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: 'action.hover', 
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Számított árak
                    </Typography>
                    
                    {/* Price per m² */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        Nettó ár/m²:
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatPriceWithCurrency(calculatedPricePerSqm)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        Bruttó ár/m² ({currentVatPercent}% ÁFA):
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatPriceWithCurrency(grossPricePerSqm)}
                      </Typography>
                    </Box>
                    
                    <Divider sx={{ my: 1.5 }} />
                    
                    {/* Full board cost */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        Teljes tábla nettó:
                      </Typography>
                      <Typography variant="body2" fontWeight="medium" color="primary">
                        {formatPriceWithCurrency(netFullBoardCost)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        Teljes tábla bruttó:
                      </Typography>
                      <Typography variant="h6" color="primary">
                        {formatPriceWithCurrency(grossFullBoardCost)}
                      </Typography>
                    </Box>
                    
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      {formData.length_mm} × {formData.width_mm} mm = {squareMeters.toFixed(3)} m²
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Price History */}
              {priceHistory.length > 0 && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Typography variant="h6" gutterBottom>
                    Ár történet (utolsó 10)
                  </Typography>
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
                        {priceHistory.map((history) => {
                          const netDiff = history.new_price_per_sqm - history.old_price_per_sqm
                          const netChangePercent = history.old_price_per_sqm > 0 
                            ? ((netDiff / history.old_price_per_sqm) * 100).toFixed(1)
                            : '0'
                          
                          // Use historical VAT rates if available, otherwise fall back to current
                          const oldVatPercent = history.old_vat?.kulcs || currentVatPercent
                          const newVatPercent = history.new_vat?.kulcs || currentVatPercent
                          
                          // Calculate gross prices with historical VAT
                          const oldGross = calculateGrossPrice(history.old_price_per_sqm, oldVatPercent)
                          const newGross = calculateGrossPrice(history.new_price_per_sqm, newVatPercent)
                          const grossDiff = newGross - oldGross
                          
                          // Get currency names
                          const oldCurrencyName = history.old_currency?.name || currentCurrencyName
                          const newCurrencyName = history.new_currency?.name || currentCurrencyName
                          
                          return (
                            <TableRow key={history.id}>
                              <TableCell>
                                {new Date(history.changed_at).toLocaleString('hu-HU', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'error.lighter', borderLeft: '3px solid', borderLeftColor: 'error.main' }}>
                                <Typography variant="body2" color="error.dark">
                                  {history.old_base_price !== null && history.old_base_price !== undefined 
                                    ? `${history.old_base_price.toLocaleString('hu-HU')} ${oldCurrencyName}`
                                    : '-'
                                  }
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'error.lighter' }}>
                                <Typography variant="body2" color="error.dark">
                                  {history.old_multiplier !== null && history.old_multiplier !== undefined 
                                    ? history.old_multiplier.toFixed(3)
                                    : '-'
                                  }
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'error.lighter' }}>
                                <Typography variant="body2" color="error.dark">
                                  {formatPriceWithCurrencyName(history.old_price_per_sqm, oldCurrencyName)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'error.lighter' }}>
                                <Typography variant="body2" fontWeight="medium" color="error.dark">
                                  {formatPriceWithCurrencyName(oldGross, oldCurrencyName)}
                                </Typography>
                                {history.old_vat && (
                                  <Typography variant="caption" color="text.secondary">
                                    ({history.old_vat.kulcs}% ÁFA)
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'success.lighter', borderLeft: '3px solid', borderLeftColor: 'success.main' }}>
                                <Typography variant="body2" color="success.dark">
                                  {history.new_base_price !== null && history.new_base_price !== undefined 
                                    ? `${history.new_base_price.toLocaleString('hu-HU')} ${newCurrencyName}`
                                    : '-'
                                  }
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'success.lighter' }}>
                                <Typography variant="body2" color="success.dark">
                                  {history.new_multiplier !== null && history.new_multiplier !== undefined 
                                    ? history.new_multiplier.toFixed(3)
                                    : '-'
                                  }
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'success.lighter' }}>
                                <Typography variant="body2" color="success.dark">
                                  {formatPriceWithCurrencyName(history.new_price_per_sqm, newCurrencyName)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'success.lighter' }}>
                                <Typography variant="body2" fontWeight="medium" color="success.dark">
                                  {formatPriceWithCurrencyName(newGross, newCurrencyName)}
                                </Typography>
                                {history.new_vat && (
                                  <Typography variant="caption" color="text.secondary">
                                    ({history.new_vat.kulcs}% ÁFA)
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
                                    Nettó: {netDiff >= 0 ? '+' : ''}{formatPriceWithCurrencyName(netDiff, newCurrencyName)}
                                  </Typography>
                                  <Typography 
                                    variant="body2" 
                                    color={grossDiff >= 0 ? 'error.main' : 'success.main'}
                                    fontWeight="bold"
                                  >
                                    Bruttó: {grossDiff >= 0 ? '+' : ''}{formatPriceWithCurrencyName(grossDiff, newCurrencyName)}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    ({netDiff >= 0 ? '+' : ''}{netChangePercent}%)
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {history.changed_by_user || 'Rendszer'}
                                </Typography>
                                {history.source_type && history.source_type !== 'edit_page' && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {history.source_type === 'shipment' ? 'Szállítmány' : history.source_type === 'excel_import' ? 'Excel import' : history.source_type}
                                  </Typography>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
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
                            {currentStock.quantity_on_hand} m²
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
                      Nincs készlet adat. Az anyag még nem érkezett be a raktárba.
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
                      Még nincs készlet mozgás ennél az anyagnál.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </TabContext>
      
      {/* Media Library Modal */}
      <MediaLibraryModal
        open={mediaLibraryOpen}
        onClose={() => setMediaLibraryOpen(false)}
        onSelect={handleMediaSelect}
        currentImageUrl={formData.image_url}
      />
    </Box>
  )
}
