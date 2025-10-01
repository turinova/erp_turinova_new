'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Box, 
  Typography, 
  Button, 
  TextField, 
  Grid,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  CircularProgress,
  Breadcrumbs,
  Link,
  Divider,
  Autocomplete
} from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'
import ImageUpload from '@/components/ImageUpload'

interface Brand {
  id: string
  name: string
}

interface Currency {
  id: string
  name: string
}

interface VAT {
  id: string
  name: string
  kulcs: number
}

interface NewMaterialClientProps {
  initialBrands: Brand[]
  initialCurrencies: Currency[]
  initialVatRates: VAT[]
}

export default function NewMaterialClient({ 
  initialBrands,
  initialCurrencies,
  initialVatRates 
}: NewMaterialClientProps) {
  const router = useRouter()
  
  const [isSaving, setIsSaving] = useState(false)
  const [tempMaterialId] = useState(`temp-${Date.now()}`) // Temp ID for image upload
  
  // Find defaults
  const hufCurrency = initialCurrencies.find(c => c.name === 'HUF')
  const vat27 = initialVatRates.find(v => v.kulcs === 27)
  
  const [formData, setFormData] = useState({
    name: '',
    length_mm: 2800,
    width_mm: 2070,
    thickness_mm: 18,
    grain_direction: false,
    on_stock: true,
    image_url: '',
    brand_id: '',
    kerf_mm: 3,
    trim_top_mm: 10,
    trim_right_mm: 10,
    trim_bottom_mm: 10,
    trim_left_mm: 10,
    rotatable: true,
    waste_multi: 1.0,
    usage_limit: 0.65,
    machine_code: '',
    price_per_sqm: 0,
    currency_id: hufCurrency?.id || '',
    vat_id: vat27?.id || ''
  })

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleBack = () => {
    router.push('/materials')
  }

  const handleSave = async () => {
    // Validation
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

    setIsSaving(true)
    
    try {
      const response = await fetch('/api/materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })
      
      if (response.ok) {
        toast.success('Új anyag sikeresen létrehozva!')
        invalidateApiCache('/api/materials')
        router.push('/materials')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Hiba történt a mentés során')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Hiba történt a mentés során!')
    } finally {
      setIsSaving(false)
    }
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
          Új anyag
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mr: 2 }}
        >
          Vissza
        </Button>
        <Typography variant="h4" component="h1">
          Új anyag hozzáadása
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Alapadatok" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Márka</InputLabel>
                    <Select
                      value={formData.brand_id}
                      label="Márka"
                      onChange={(e) => handleInputChange('brand_id', e.target.value)}
                    >
                      {initialBrands.map((brand) => (
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
                    required
                    label="Anyag neve"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    required
                    label="Hossz (mm)"
                    type="number"
                    value={formData.length_mm}
                    onChange={(e) => handleInputChange('length_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    required
                    label="Szélesség (mm)"
                    type="number"
                    value={formData.width_mm}
                    onChange={(e) => handleInputChange('width_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    required
                    label="Vastagság (mm)"
                    type="number"
                    value={formData.thickness_mm}
                    onChange={(e) => handleInputChange('thickness_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={12}>
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
                materialId={tempMaterialId}
                disabled={isSaving}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Optimization Settings */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Optimalizálási beállítások" />
            <CardContent>
              {/* Szélezési beállítások */}
              <Typography variant="h6" component="h3" gutterBottom>
                Szélezési beállítások
              </Typography>
              <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    required
                    label="Felső trim (mm)"
                    type="number"
                    value={formData.trim_top_mm}
                    onChange={(e) => handleInputChange('trim_top_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    required
                    label="Jobb trim (mm)"
                    type="number"
                    value={formData.trim_right_mm}
                    onChange={(e) => handleInputChange('trim_right_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    required
                    label="Alsó trim (mm)"
                    type="number"
                    value={formData.trim_bottom_mm}
                    onChange={(e) => handleInputChange('trim_bottom_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    required
                    label="Bal trim (mm)"
                    type="number"
                    value={formData.trim_left_mm}
                    onChange={(e) => handleInputChange('trim_left_mm', parseInt(e.target.value) || 0)}
                  />
                </Grid>
              </Grid>
              
              <Divider sx={{ mb: 3 }} />
              
              {/* Egyéb beállítások */}
              <Typography variant="h6" component="h3" gutterBottom>
                Egyéb beállítások
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    required
                    label="Penge vastagság (mm)"
                    type="number"
                    value={formData.kerf_mm}
                    onChange={(e) => handleInputChange('kerf_mm', parseInt(e.target.value) || 3)}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    required
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
                    required
                    label="Kihasználtság küszöb (%)"
                    type="number"
                    inputProps={{ step: "1", min: "0", max: "100" }}
                    value={Math.round(formData.usage_limit * 100)}
                    onChange={(e) => handleInputChange('usage_limit', (parseFloat(e.target.value) || 65) / 100)}
                    helperText="Minimális kihasználtsági arány"
                  />
                </Grid>
                <Grid item xs={3}></Grid>
                
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
          
          {/* Export Settings */}
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
                    required
                    label="Gépkód"
                    value={formData.machine_code}
                    onChange={(e) => handleInputChange('machine_code', e.target.value)}
                    helperText="A gép azonosítója az optimalizáláshoz"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Pricing Settings */}
          <Card sx={{ mt: 4 }}>
            <CardHeader title="Árazási beállítások" />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    required
                    label="Nettó ár (Ft/m²)"
                    type="number"
                    inputProps={{ step: "0.01", min: "0" }}
                    value={formData.price_per_sqm}
                    onChange={(e) => handleInputChange('price_per_sqm', parseFloat(e.target.value) || 0)}
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Autocomplete
                    options={initialCurrencies}
                    getOptionLabel={(option) => option.name}
                    value={initialCurrencies.find(c => c.id === formData.currency_id) || null}
                    onChange={(_, newValue) => handleInputChange('currency_id', newValue?.id || '')}
                    renderInput={(params) => (
                      <TextField {...params} label="Pénznem" required />
                    )}
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Autocomplete
                    options={initialVatRates}
                    getOptionLabel={(option) => option.name}
                    value={initialVatRates.find(v => v.id === formData.vat_id) || null}
                    onChange={(_, newValue) => handleInputChange('vat_id', newValue?.id || '')}
                    renderInput={(params) => (
                      <TextField {...params} label="ÁFA" required />
                    )}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
        <Button
          variant="outlined"
          onClick={handleBack}
          disabled={isSaving}
        >
          Mégse
        </Button>
        <Button
          variant="contained"
          startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Mentés...' : 'Mentés'}
        </Button>
      </Box>
    </Box>
  )
}

