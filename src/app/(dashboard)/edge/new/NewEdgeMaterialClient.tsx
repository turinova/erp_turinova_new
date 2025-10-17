'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Typography, Breadcrumbs, Link, Grid, Button, TextField, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, Card, CardHeader, CardContent } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface EdgeMaterial {
  id: string
  brand_id: string
  type: string
  thickness: number
  width: number
  decor: string
  price: number
  vat_id: string
  active: boolean
  ráhagyás: number
  favourite_priority: number | null
  created_at: string
  updated_at: string
}

interface Brand {
  id: string
  name: string
}

interface VatRate {
  id: string
  name: string
  kulcs: number
}

interface NewEdgeMaterialClientProps {
  brands: Brand[]
  vatRates: VatRate[]
  defaultVatId: string
}

export default function NewEdgeMaterialClient({ brands, vatRates, defaultVatId }: NewEdgeMaterialClientProps) {
  const router = useRouter()
  
  // Initialize with empty edge material data
  const [edgeMaterial, setEdgeMaterial] = useState<EdgeMaterial>({
    id: '',
    brand_id: '',
    type: '',
    thickness: 0,
    width: 0,
    decor: '',
    price: 0,
    vat_id: defaultVatId,
    active: true,
    ráhagyás: 0,
    favourite_priority: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  
  const [machineCode, setMachineCode] = useState<string>('')
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)
  const [grossPrice, setGrossPrice] = useState<number | ''>(0)

  const handleBack = () => {
    router.push('/edge')
  }

  const handleInputChange = (field: keyof EdgeMaterial, value: string | number | boolean) => {
    setEdgeMaterial(prev => ({ ...prev, [field]: value }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleGrossPriceChange = (value: string) => {
    setGrossPrice(value)
    
    // Calculate net price from gross price
    const numericValue = parseFloat(value) || 0
    const selectedVat = vatRates.find(vat => vat.id === edgeMaterial.vat_id)
    if (selectedVat && value !== '') {
      const vatRate = selectedVat.kulcs / 100
      const netPrice = numericValue / (1 + vatRate)
      // Round to integer to avoid floating point precision issues
      const roundedNetPrice = Math.round(netPrice)
      setEdgeMaterial(prev => ({ ...prev, price: roundedNetPrice }))
    } else if (value === '') {
      setEdgeMaterial(prev => ({ ...prev, price: 0 }))
    }
    
    // Clear error when user starts typing
    if (errors.price) {
      setErrors(prev => ({ ...prev, price: '' }))
    }
  }

  const validate = () => {
    const newErrors: { [key: string]: string } = {}

    if (!edgeMaterial.brand_id) {
      newErrors.brand_id = 'A márka kiválasztása kötelező'
    }

    if (!edgeMaterial.type.trim()) {
      newErrors.type = 'A típus mező kötelező'
    }

    if (!edgeMaterial.decor.trim()) {
      newErrors.decor = 'A dekor mező kötelező'
    }

    if (edgeMaterial.width <= 0) {
      newErrors.width = 'A szélesség nagyobb kell legyen mint 0'
    }

    if (edgeMaterial.thickness <= 0) {
      newErrors.thickness = 'A vastagság nagyobb kell legyen mint 0'
    }

    if (grossPrice === '' || grossPrice === undefined || grossPrice === null) {
      newErrors.price = 'A bruttó ár mező kötelező'
    }

    if (!edgeMaterial.vat_id) {
      newErrors.vat_id = 'Az adónem kiválasztása kötelező'
    }

    if (!machineCode.trim()) {
      newErrors.machine_code = 'A gépkód mező kötelező'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Kérem töltse ki az összes kötelező mezőt!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch('/api/edge-materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand_id: edgeMaterial.brand_id,
          type: edgeMaterial.type,
          thickness: edgeMaterial.thickness,
          width: edgeMaterial.width,
          decor: edgeMaterial.decor,
          price: edgeMaterial.price,
          vat_id: edgeMaterial.vat_id,
          active: edgeMaterial.active,
          ráhagyás: edgeMaterial.ráhagyás,
          favourite_priority: edgeMaterial.favourite_priority,
          machineCode: machineCode
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create edge material')
      }

      const result = await response.json()

      // Invalidate the cache
      invalidateApiCache('/api/edge-materials')

      toast.success('Élzáró sikeresen létrehozva!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })

      router.push('/edge')
    } catch (error) {
      console.error('Error creating edge material:', error)
      toast.error('Hiba történt az élzáró létrehozása során!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          href="/dashboard"
          color="inherit"
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Kezdőlap
        </Link>
        <Link
          href="/edge"
          color="inherit"
          sx={{ textDecoration: 'none' }}
        >
          Élzárók
        </Link>
        <Typography color="text.primary">Új Élzáró</Typography>
      </Breadcrumbs>

      {/* Header with action buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Új Élzáró Hozzáadása
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            color="primary"
            disabled={isSaving}
          >
            {isSaving ? 'Mentés...' : 'Mentés'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
          >
            Vissza
          </Button>
        </Box>
      </Box>

      {/* Form */}
      <Grid container spacing={3}>
        {/* Alap adatok section */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Alap adatok" />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={2.4}>
                  <FormControl fullWidth error={!!errors.brand_id} required>
                    <InputLabel>Márka</InputLabel>
                    <Select
                      value={edgeMaterial.brand_id}
                      label="Márka"
                      onChange={(e) => handleInputChange('brand_id', e.target.value)}
                    >
                      {brands.map((brand) => (
                        <MenuItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.brand_id && (
                      <Typography variant="caption" color="error" sx={{ mt: 1, ml: 2 }}>
                        {errors.brand_id}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={2.4}>
                  <TextField
                    fullWidth
                    label="Típus"
                    value={edgeMaterial.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    error={!!errors.type}
                    helperText={errors.type}
                    required
                  />
                </Grid>
                
                <Grid item xs={12} md={2.4}>
                  <TextField
                    fullWidth
                    label="Dekor"
                    value={edgeMaterial.decor}
                    onChange={(e) => handleInputChange('decor', e.target.value)}
                    error={!!errors.decor}
                    helperText={errors.decor}
                    required
                  />
                </Grid>
                
                <Grid item xs={12} md={2.4}>
                  <TextField
                    fullWidth
                    label="Szélesség (mm)"
                    type="number"
                    value={edgeMaterial.width}
                    onChange={(e) => {
                      const val = e.target.value.replace(',', '.')
                      handleInputChange('width', parseFloat(val) || 0)
                    }}
                    error={!!errors.width}
                    helperText={errors.width}
                    required
                    inputProps={{ step: 0.1 }}
                  />
                </Grid>
                
                <Grid item xs={12} md={2.4}>
                  <TextField
                    fullWidth
                    label="Vastagság (mm)"
                    type="number"
                    value={edgeMaterial.thickness}
                    onChange={(e) => {
                      const val = e.target.value.replace(',', '.')
                      handleInputChange('thickness', parseFloat(val) || 0)
                    }}
                    error={!!errors.thickness}
                    helperText={errors.thickness}
                    required
                    inputProps={{ step: 0.1 }}
                  />
                </Grid>
          
                <Grid item xs={12} md={2.4}>
                  <TextField
                    fullWidth
                    label="Kedvenc sorrend"
                    type="number"
                    value={edgeMaterial.favourite_priority ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      handleInputChange('favourite_priority', val === '' ? null : parseInt(val))
                    }}
                    inputProps={{ min: 1 }}
                    placeholder="Nem kedvenc"
                    helperText="1 = első, 2 = második, stb. Hagyd üresen ha nem kedvenc"
                  />
                </Grid>
                
                <Grid item xs={12} md={2.4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={edgeMaterial.active}
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

        {/* Árazási adatok section */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Árazási adatok" />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={2.4}>
                  <TextField
                    fullWidth
                    label="Bruttó ár (Ft)"
                    type="number"
                    value={grossPrice}
                    onChange={(e) => handleGrossPriceChange(e.target.value)}
                    error={!!errors.price}
                    helperText={errors.price || 'Ft (bruttó)'}
                    required
                    inputProps={{ step: 1 }}
                  />
                </Grid>
          
                <Grid item xs={12} md={2.4}>
                  <FormControl fullWidth error={!!errors.vat_id} required>
                    <InputLabel>Adónem</InputLabel>
                    <Select
                      value={edgeMaterial.vat_id}
                      label="Adónem"
                      onChange={(e) => handleInputChange('vat_id', e.target.value)}
                    >
                      {vatRates.map((vatRate) => (
                        <MenuItem key={vatRate.id} value={vatRate.id}>
                          {vatRate.name} ({vatRate.kulcs}%)
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.vat_id && (
                      <Typography variant="caption" color="error" sx={{ mt: 1, ml: 2 }}>
                        {errors.vat_id}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Optimalizálási beállítások section */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Optimalizálási beállítások" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Ráhagyás (mm)"
                    type="number"
                    value={edgeMaterial.ráhagyás}
                    onChange={(e) => handleInputChange('ráhagyás', parseInt(e.target.value) || 0)}
                    inputProps={{ min: 0 }}
                    placeholder="0"
                    helperText="Élzáró túlnyúlás milliméterben (alapértelmezett: 0)"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Export beállítások section */}
        <Grid item xs={12}>
          <Card>
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
                    value={machineCode}
                    onChange={(e) => setMachineCode(e.target.value)}
                    placeholder="Gépkód hozzáadása..."
                    required
                    error={!!errors.machine_code}
                    helperText={errors.machine_code}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

