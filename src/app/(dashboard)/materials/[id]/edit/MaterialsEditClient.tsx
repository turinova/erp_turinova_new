'use client'

import React, { useState, useEffect } from 'react'

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
  CircularProgress
} from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

import { usePermissions } from '@/contexts/PermissionContext'
import ImageUpload from '@/components/ImageUpload'
import MediaLibraryModal from '@/components/MediaLibraryModal'
import { formatPriceWithCurrency, calculateFullBoardCost, calculateSquareMeters, calculateGrossPrice } from '@/utils/priceFormatters'

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
  old_price_per_sqm: number
  new_price_per_sqm: number
  changed_at: string
  changed_by: string | null
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

interface MaterialsEditClientProps {
  initialMaterial: Material
  initialBrands: Brand[]
  initialCurrencies: Currency[]
  initialVatRates: VAT[]
  initialPriceHistory: PriceHistory[]
  initialPartners: Partner[]
  initialUnits: Unit[]
}

export default function MaterialsEditClient({ 
  initialMaterial, 
  initialBrands,
  initialCurrencies,
  initialVatRates,
  initialPriceHistory,
  initialPartners,
  initialUnits
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
  
  // All data from SSR - no client-side fetching needed!
  const [currencies] = useState<Currency[]>(initialCurrencies)
  const [vatRates] = useState<VAT[]>(initialVatRates)
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>(initialPriceHistory)
  const [loadingPriceHistory, setLoadingPriceHistory] = useState(false)
  
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
                          <TableCell align="right">Régi nettó</TableCell>
                          <TableCell align="right">Régi bruttó</TableCell>
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
                          
                          // Calculate gross prices with current VAT
                          const oldGross = calculateGrossPrice(history.old_price_per_sqm, currentVatPercent)
                          const newGross = calculateGrossPrice(history.new_price_per_sqm, currentVatPercent)
                          const grossDiff = newGross - oldGross
                          
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
                                  {formatPriceWithCurrency(history.old_price_per_sqm)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'error.lighter' }}>
                                <Typography variant="body2" fontWeight="medium" color="error.dark">
                                  {formatPriceWithCurrency(oldGross)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'success.lighter', borderLeft: '3px solid', borderLeftColor: 'success.main' }}>
                                <Typography variant="body2" color="success.dark">
                                  {formatPriceWithCurrency(history.new_price_per_sqm)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'success.lighter' }}>
                                <Typography variant="body2" fontWeight="medium" color="success.dark">
                                  {formatPriceWithCurrency(newGross)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Box>
                                  <Typography 
                                    variant="body2" 
                                    color={netDiff >= 0 ? 'error.main' : 'success.main'}
                                    fontWeight="medium"
                                  >
                                    Nettó: {netDiff >= 0 ? '+' : ''}{formatPriceWithCurrency(netDiff)}
                                  </Typography>
                                  <Typography 
                                    variant="body2" 
                                    color={grossDiff >= 0 ? 'error.main' : 'success.main'}
                                    fontWeight="bold"
                                  >
                                    Bruttó: {grossDiff >= 0 ? '+' : ''}{formatPriceWithCurrency(grossDiff)}
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
