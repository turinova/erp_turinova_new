'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Typography, Breadcrumbs, Link, Grid, Button, TextField, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, Card, CardHeader, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Divider } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'
import ImageUpload from '@/components/ImageUpload'
import MediaLibraryModal from '@/components/MediaLibraryModal'

interface LinearMaterial {
  id: string
  brand_id: string
  name: string
  width: number
  length: number
  thickness: number
  type: string
  image_url: string | null
  base_price: number
  multiplier: number
  price_per_m: number
  partners_id: string | null
  units_id: string | null
  currency_id: string
  vat_id: string
  on_stock: boolean
  active: boolean
  created_at: string
  updated_at: string
  machine_code: string
  brands?: { name: string }
  currencies?: { name: string }
  vat?: { name: string; kulcs: number }
}

interface Brand { id: string; name: string }
interface VatRate { id: string; name: string; kulcs: number }
interface Currency { id: string; name: string }
interface Partner { id: string; name: string }
interface Unit { id: string; name: string; shortform: string }

interface LinearMaterialEditClientProps {
  initialLinearMaterial: LinearMaterial
  brands: Brand[]
  vatRates: VatRate[]
  currencies: Currency[]
  partners: Partner[]
  units: Unit[]
  priceHistory: any[]
}

export default function LinearMaterialEditClient({ initialLinearMaterial, brands, vatRates, currencies, partners, units, priceHistory }: LinearMaterialEditClientProps) {
  const router = useRouter()
  
  const [formData, setFormData] = useState(initialLinearMaterial)
  const [machineCode, setMachineCode] = useState(initialLinearMaterial.machine_code || '')
  const [errors, setErrors] = useState<any>({})
  const [isSaving, setIsSaving] = useState(false)
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Calculate price_per_m from base_price and multiplier
  const calculatedPricePerM = React.useMemo(() => {
    return Math.round(formData.base_price * formData.multiplier)
  }, [formData.base_price, formData.multiplier])

  // Update price_per_m when base_price or multiplier changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, price_per_m: calculatedPricePerM }))
  }, [calculatedPricePerM])

  useEffect(() => {
    setMounted(true)
    console.log('[LINEAR MATERIALS CLIENT] Price history entries:', priceHistory?.length || 0)
    console.log('[LINEAR MATERIALS CLIENT] Price history data:', priceHistory)
  }, [])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev: any) => ({ ...prev, [field]: '' }))
  }

  const handleMediaSelect = (imageUrl: string, filename: string) => {
    handleInputChange('image_url', imageUrl)
    toast.success(`Kép kiválasztva: ${filename}`)
  }

  const validate = () => {
    const newErrors: any = {}
    if (!formData.brand_id) newErrors.brand_id = 'Márka kötelező'
    if (!formData.name.trim()) newErrors.name = 'Név kötelező'
    if (!formData.type.trim()) newErrors.type = 'Típus kötelező'
    if (!machineCode.trim()) newErrors.machine_code = 'Gépkód kötelező'
    if (formData.base_price <= 0) newErrors.base_price = 'A beszerzési ár nagyobb kell legyen mint 0'
    if (formData.multiplier < 1.0 || formData.multiplier > 5.0) newErrors.multiplier = 'Az árrés szorzó 1.0 és 5.0 között kell legyen'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Kérem töltse ki az összes kötelező mezőt!')
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch(`/api/linear-materials/${formData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, machine_code: machineCode })
      })

      if (!response.ok) throw new Error('Failed to update')

      toast.success('Anyag sikeresen mentve!')
      invalidateApiCache('/api/linear-materials')
      
      // Refresh the page to get updated price history (SSR)
      router.refresh()
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Hiba történt a mentés során!')
    } finally {
      setIsSaving(false)
    }
  }

  const formatPrice = (price: number, currencyName: string) => {
    return `${price.toLocaleString('hu-HU', { maximumFractionDigits: 0 })} ${currencyName}`
  }

  const calculateGrossPrice = (netPrice: number, vatPercent: number) => {
    return netPrice * (1 + vatPercent / 100)
  }

  // Get current VAT percent for price history calculations
  const currentVat = vatRates.find(v => v.id === formData.vat_id)
  const currentVatPercent = currentVat?.kulcs || 0
  
  // Get current currency
  const currentCurrency = currencies.find(c => c.id === formData.currency_id)
  const currentCurrencyName = currentCurrency?.name || 'HUF'
  
  // Calculate prices
  const netPricePerM = calculatedPricePerM || 0
  const grossPricePerM = calculateGrossPrice(netPricePerM, currentVatPercent)

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link href="/home" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Főoldal
        </Link>
        <Link href="/linear-materials" sx={{ textDecoration: 'none' }}>Szálas anyagok</Link>
        <Typography color="text.primary">{formData.name}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Anyag szerkesztése</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Mentés...' : 'Mentés'}
          </Button>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => router.push('/linear-materials')}>
            Vissza
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Alap adatok */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Alap adatok" />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth required error={!!errors.brand_id}>
                    <InputLabel>Márka</InputLabel>
                    <Select value={formData.brand_id} label="Márka" onChange={(e) => handleInputChange('brand_id', e.target.value)}>
                      {brands.map(b => (<MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth required label="Név" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} error={!!errors.name} helperText={errors.name} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth required label="Típus" value={formData.type} onChange={(e) => handleInputChange('type', e.target.value)} error={!!errors.type} helperText={errors.type} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth required label="Szélesség (mm)" type="number" value={formData.width} onChange={(e) => handleInputChange('width', parseFloat(e.target.value.replace(',', '.')) || 0)} inputProps={{ step: 0.1 }} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth required label="Hossz (mm)" type="number" value={formData.length} onChange={(e) => handleInputChange('length', parseFloat(e.target.value.replace(',', '.')) || 0)} inputProps={{ step: 0.1 }} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth required label="Vastagság (mm)" type="number" value={formData.thickness} onChange={(e) => handleInputChange('thickness', parseFloat(e.target.value.replace(',', '.')) || 0)} inputProps={{ step: 0.1 }} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel control={<Switch checked={formData.on_stock} onChange={(e) => handleInputChange('on_stock', e.target.checked)} />} label="Raktáron" />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel control={<Switch checked={formData.active} onChange={(e) => handleInputChange('active', e.target.checked)} />} label="Aktív" />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Képfeltöltés */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Képfeltöltés" />
            <CardContent>
              <ImageUpload
                currentImageUrl={formData.image_url || undefined}
                onImageChange={(url) => handleInputChange('image_url', url || '')}
                materialId={formData.id}
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

        {/* Export beállítások */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Export beállítások" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Gép típus</InputLabel>
                    <Select value="Korpus" label="Gép típus" disabled>
                      <MenuItem value="Korpus">Korpus</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth required label="Gépkód" value={machineCode} onChange={(e) => setMachineCode(e.target.value)} error={!!errors.machine_code} helperText={errors.machine_code} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Árazási adatok */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Árazási adatok" />
            <CardContent>
              <Grid container spacing={3}>
                {/* Partner */}
                <Grid item md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Partner</InputLabel>
                    <Select value={formData.partners_id || ''} label="Partner" onChange={(e) => handleInputChange('partners_id', e.target.value)}>
                      <MenuItem value="">Nincs partner</MenuItem>
                      {partners.map(p => (<MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Beszerzési ár */}
                <Grid item md={2}>
                  <TextField 
                    fullWidth 
                    required 
                    label="Beszerzési ár" 
                    type="number" 
                    value={formData.base_price} 
                    onChange={(e) => handleInputChange('base_price', parseInt(e.target.value) || 0)} 
                    inputProps={{ step: 1, min: 0 }} 
                  />
                </Grid>

                {/* Árrés szorzó */}
                <Grid item md={2}>
                  <TextField 
                    fullWidth 
                    required 
                    label="Árrés szorzó" 
                    type="number" 
                    value={formData.multiplier} 
                    onChange={(e) => handleInputChange('multiplier', parseFloat(e.target.value) || 1.38)} 
                    inputProps={{ step: 0.01, min: 1.00, max: 5.00 }} 
                  />
                </Grid>

                {/* Ár/m (Ft) */}
                <Grid item md={2}>
                  <TextField 
                    fullWidth 
                    label="Ár/m (Ft)" 
                    type="number" 
                    value={calculatedPricePerM} 
                    disabled 
                    InputProps={{ readOnly: true }} 
                  />
                </Grid>

                {/* Currency */}
                <Grid item md={2}>
                  <FormControl fullWidth required>
                    <InputLabel>Pénznem</InputLabel>
                    <Select value={formData.currency_id} label="Pénznem" onChange={(e) => handleInputChange('currency_id', e.target.value)}>
                      {currencies.map(c => (<MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* VAT */}
                <Grid item md={2}>
                  <FormControl fullWidth required>
                    <InputLabel>Adónem</InputLabel>
                    <Select value={formData.vat_id} label="Adónem" onChange={(e) => handleInputChange('vat_id', e.target.value)}>
                      {vatRates.map(v => (<MenuItem key={v.id} value={v.id}>{v.name} ({v.kulcs}%)</MenuItem>))}
                    </Select>
                  </FormControl>
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
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        Nettó ár/m:
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {netPricePerM.toLocaleString('hu-HU', { maximumFractionDigits: 0 })} {currentCurrencyName}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        Bruttó ár/m ({currentVatPercent}% ÁFA):
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {grossPricePerM.toLocaleString('hu-HU', { maximumFractionDigits: 0 })} {currentCurrencyName}
                      </Typography>
                    </Box>
                    
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Hossz: {formData.length} mm, Szélesség: {formData.width} mm, Vastagság: {formData.thickness} mm
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Price History - Inside pricing card */}
              {priceHistory && priceHistory.length > 0 && (
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
                        {priceHistory.map((h: any) => {
                          const netDiff = h.new_price - h.old_price
                          const netChangePercent = h.old_price > 0 
                            ? ((netDiff / h.old_price) * 100).toFixed(1)
                            : '0'
                          
                          // Calculate gross prices
                          const oldGross = calculateGrossPrice(h.old_price, h.old_vat?.kulcs || currentVatPercent)
                          const newGross = calculateGrossPrice(h.new_price, h.new_vat?.kulcs || currentVatPercent)
                          const grossDiff = newGross - oldGross
                          
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
                                  {formatPrice(h.old_price, h.old_currency?.name || '')}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'error.lighter' }}>
                                <Typography variant="body2" fontWeight="medium" color="error.dark">
                                  {formatPrice(oldGross, h.old_currency?.name || '')}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'success.lighter', borderLeft: '3px solid', borderLeftColor: 'success.main' }}>
                                <Typography variant="body2" color="success.dark">
                                  {formatPrice(h.new_price, h.new_currency?.name || '')}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'success.lighter' }}>
                                <Typography variant="body2" fontWeight="medium" color="success.dark">
                                  {formatPrice(newGross, h.new_currency?.name || '')}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Box>
                                  <Typography 
                                    variant="body2" 
                                    color={netDiff >= 0 ? 'error.main' : 'success.main'}
                                    fontWeight="medium"
                                  >
                                    Nettó: {netDiff >= 0 ? '+' : ''}{formatPrice(netDiff, h.new_currency?.name || '')}
                                  </Typography>
                                  <Typography 
                                    variant="body2" 
                                    color={grossDiff >= 0 ? 'error.main' : 'success.main'}
                                    fontWeight="bold"
                                  >
                                    Bruttó: {grossDiff >= 0 ? '+' : ''}{formatPrice(grossDiff, h.new_currency?.name || '')}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    ({netDiff >= 0 ? '+' : ''}{netChangePercent}%)
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {h.changed_by_user?.email || 'Rendszer'}
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

        {/* Metaadatok */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Metaadatok" />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Létrehozva" value={new Date(formData.created_at).toLocaleString('hu-HU')} InputProps={{ readOnly: true }} variant="filled" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="Módosítva" value={new Date(formData.updated_at).toLocaleString('hu-HU')} InputProps={{ readOnly: true }} variant="filled" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth label="ID" value={formData.id} InputProps={{ readOnly: true }} variant="filled" sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }} />
                </Grid>
              </Grid>
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

