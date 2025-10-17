'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Typography, Breadcrumbs, Link, Grid, Button, TextField, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, Card, CardHeader, CardContent } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon, Image as ImageIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'
import ImageUpload from '@/components/ImageUpload'
import MediaLibraryModal from '@/components/MediaLibraryModal'

interface Brand { id: string; name: string }
interface VatRate { id: string; name: string; kulcs: number }
interface Currency { id: string; name: string }
interface Partner { id: string; name: string }
interface Unit { id: string; name: string; shortform: string }

interface NewLinearMaterialClientProps {
  brands: Brand[]
  vatRates: VatRate[]
  currencies: Currency[]
  partners: Partner[]
  units: Unit[]
  defaultCurrencyId: string
  defaultVatId: string
  defaultUnitId: string
}

export default function NewLinearMaterialClient({ brands, vatRates, currencies, partners, units, defaultCurrencyId, defaultVatId, defaultUnitId }: NewLinearMaterialClientProps) {
  const router = useRouter()
  const [tempMaterialId] = useState(() => `temp-${Date.now()}`)
  
  const [formData, setFormData] = useState({
    brand_id: '',
    name: '',
    type: '',
    width: 600,
    length: 4100,
    thickness: 36,
    base_price: 0,
    multiplier: 1.38,
    price_per_m: 0,
    partners_id: '',
    units_id: defaultUnitId,
    currency_id: defaultCurrencyId,
    vat_id: defaultVatId,
    on_stock: true,
    active: true,
    image_url: null as string | null
  })
  
  const [machineCode, setMachineCode] = useState('')
  const [errors, setErrors] = useState<any>({})
  const [isSaving, setIsSaving] = useState(false)
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate price_per_m when base_price or multiplier changes
  useEffect(() => {
    const calculatedPrice = Math.round(formData.base_price * formData.multiplier)
    setFormData(prev => ({ ...prev, price_per_m: calculatedPrice }))
  }, [formData.base_price, formData.multiplier])

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
    if (formData.width <= 0) newErrors.width = 'Szélesség nagyobb kell legyen mint 0'
    if (formData.length <= 0) newErrors.length = 'Hossz nagyobb kell legyen mint 0'
    if (formData.thickness <= 0) newErrors.thickness = 'Vastagság nagyobb kell legyen mint 0'
    if (formData.base_price < 0) newErrors.base_price = 'Beszerzési ár nem lehet negatív'
    if (formData.multiplier < 1.0 || formData.multiplier > 5.0) newErrors.multiplier = 'Árrés szorzó 1.0 és 5.0 között kell legyen'
    if (!formData.units_id) newErrors.units_id = 'Mértékegység kötelező'
    if (!formData.currency_id) newErrors.currency_id = 'Pénznem kötelező'
    if (!formData.vat_id) newErrors.vat_id = 'Adónem kötelező'
    if (!machineCode.trim()) newErrors.machine_code = 'Gépkód kötelező'
    
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
      const response = await fetch('/api/linear-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, machine_code: machineCode })
      })

      if (!response.ok) throw new Error('Failed to create')

      toast.success('Anyag sikeresen létrehozva!')
      invalidateApiCache('/api/linear-materials')
      router.push('/linear-materials')
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Hiba történt a mentés során!')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link href="/home" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Főoldal
        </Link>
        <Link href="/linear-materials" sx={{ textDecoration: 'none' }}>Szálas anyagok</Link>
        <Typography color="text.primary">Új anyag</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Új Szálas Anyag</Typography>
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
                  <TextField fullWidth required label="Szélesség (mm)" type="number" value={formData.width} onChange={(e) => handleInputChange('width', parseFloat(e.target.value.replace(',', '.')) || 0)} error={!!errors.width} helperText={errors.width} inputProps={{ step: 0.1 }} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth required label="Hossz (mm)" type="number" value={formData.length} onChange={(e) => handleInputChange('length', parseFloat(e.target.value.replace(',', '.')) || 0)} error={!!errors.length} helperText={errors.length} inputProps={{ step: 0.1 }} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth required label="Vastagság (mm)" type="number" value={formData.thickness} onChange={(e) => handleInputChange('thickness', parseFloat(e.target.value.replace(',', '.')) || 0)} error={!!errors.thickness} helperText={errors.thickness} inputProps={{ step: 0.1 }} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel control={<Switch checked={formData.on_stock} onChange={(e) => handleInputChange('on_stock', e.target.checked)} />} label="Raktáron" />
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
                materialId={tempMaterialId}
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

        {/* Árazási adatok */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Árazási adatok" />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Partner</InputLabel>
                    <Select value={formData.partners_id} label="Partner" onChange={(e) => handleInputChange('partners_id', e.target.value)}>
                      <MenuItem value=""><em>Nincs</em></MenuItem>
                      {partners.map(p => (<MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField 
                    fullWidth 
                    required 
                    label="Beszerzési ár" 
                    type="number" 
                    value={formData.base_price} 
                    onChange={(e) => handleInputChange('base_price', parseFloat(e.target.value.replace(',', '.')) || 0)} 
                    error={!!errors.base_price} 
                    helperText={errors.base_price} 
                    inputProps={{ step: 0.01, min: 0 }} 
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField 
                    fullWidth 
                    required 
                    label="Árrés szorzó" 
                    type="number" 
                    value={formData.multiplier} 
                    onChange={(e) => handleInputChange('multiplier', parseFloat(e.target.value.replace(',', '.')) || 1.38)} 
                    error={!!errors.multiplier} 
                    helperText={errors.multiplier} 
                    inputProps={{ step: 0.01, min: 1.0, max: 5.0 }} 
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField 
                    fullWidth 
                    label="Ár/m (Ft)" 
                    type="number" 
                    value={formData.price_per_m} 
                    disabled 
                    helperText="Számított érték" 
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth required error={!!errors.currency_id}>
                    <InputLabel>Pénznem</InputLabel>
                    <Select value={formData.currency_id} label="Pénznem" onChange={(e) => handleInputChange('currency_id', e.target.value)}>
                      {currencies.map(c => (<MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth required error={!!errors.vat_id}>
                    <InputLabel>ÁFA</InputLabel>
                    <Select value={formData.vat_id} label="ÁFA" onChange={(e) => handleInputChange('vat_id', e.target.value)}>
                      {vatRates.map(v => (<MenuItem key={v.id} value={v.id}>{v.name} ({v.kulcs}%)</MenuItem>))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
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
                  <TextField fullWidth required label="Gépkód" value={machineCode} onChange={(e) => setMachineCode(e.target.value)} error={!!errors.machine_code} helperText={errors.machine_code} placeholder="Gépkód hozzáadása..." />
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

