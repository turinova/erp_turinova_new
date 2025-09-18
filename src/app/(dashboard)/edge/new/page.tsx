'use client'

import React, { useState, useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
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

export default function NewEdgeMaterialPage() {
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
    vat_id: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  
  const [brands, setBrands] = useState<Brand[]>([])
  const [vatRates, setVatRates] = useState<VatRate[]>([])
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load brands and VAT rates for dropdowns
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        
        // Load brands for dropdown
        const brandsResponse = await fetch('/api/brands')

        if (brandsResponse.ok) {
          const brandsData = await brandsResponse.json()

          setBrands(brandsData)
        }
        
        // Load VAT rates for dropdown
        const vatResponse = await fetch('/api/vat')

        if (vatResponse.ok) {
          const vatData = await vatResponse.json()

          setVatRates(vatData)
        }
        
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Hiba történt az adatok betöltése során!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const handleBack = () => {
    router.push('/edge')
  }

  const handleInputChange = (field: keyof EdgeMaterial, value: string | number) => {
    setEdgeMaterial(prev => ({ ...prev, [field]: value }))


    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSave = async () => {
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!edgeMaterial.type.trim()) {
      newErrors.type = 'A típus mező kötelező'
    }
    
    if (!edgeMaterial.decor.trim()) {
      newErrors.decor = 'A dekor mező kötelező'
    }
    
    if (edgeMaterial.thickness <= 0) {
      newErrors.thickness = 'A vastagság nagyobb kell legyen mint 0'
    }
    
    if (edgeMaterial.width <= 0) {
      newErrors.width = 'A szélesség nagyobb kell legyen mint 0'
    }
    
    if (edgeMaterial.price <= 0) {
      newErrors.price = 'Az ár nagyobb kell legyen mint 0'
    }
    
    if (!edgeMaterial.brand_id) {
      newErrors.brand_id = 'A márka kiválasztása kötelező'
    }
    
    if (!edgeMaterial.vat_id) {
      newErrors.vat_id = 'Az adónem kiválasztása kötelező'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      
return
    }
    
    setIsSaving(true)
    
    try {
      console.log('Sending edge material data:', JSON.stringify(edgeMaterial, null, 2))

      const response = await fetch('/api/edge-materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(edgeMaterial),
      })
      
      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)
      
      if (response.ok) {
        const result = await response.json()

        console.log('Create response:', result)
        toast.success('Új élzáró sikeresen létrehozva!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        
        // Invalidate cache to refresh list page
        invalidateApiCache('/api/edge-materials')
        
        router.push('/edge')
      } else {
        const errorData = await response.json()

        console.error('Create error response:', errorData)
        throw new Error(errorData.message || 'Létrehozás sikertelen')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error(`Hiba történt a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="/edge"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Élzárók
        </Link>
        <Typography color="text.primary">
          Új élzáró
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Új élzáró hozzáadása
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          Vissza
        </Button>
      </Box>

      <Paper sx={{ p: 3 }}>
        {/* Alap adatok section */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
          Alap adatok
        </Typography>
        <Grid container spacing={3} sx={{ mb: 4 }}>
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
              onChange={(e) => handleInputChange('width', parseFloat(e.target.value) || 0)}
              error={!!errors.width}
              helperText={errors.width}
              required
            />
          </Grid>
          
          <Grid item xs={12} md={2.4}>
            <TextField
              fullWidth
              label="Vastagság (mm)"
              type="number"
              value={edgeMaterial.thickness}
              onChange={(e) => handleInputChange('thickness', parseFloat(e.target.value) || 0)}
              error={!!errors.thickness}
              helperText={errors.thickness}
              required
            />
          </Grid>
        </Grid>

        {/* Árazási adatok section */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
          Árazási adatok
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={2.4}>
            <TextField
              fullWidth
              label="Ár (Ft)"
              type="number"
              value={edgeMaterial.price}
              onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
              error={!!errors.price}
              helperText={errors.price}
              required
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
                {vatRates.map((vat) => (
                  <MenuItem key={vat.id} value={vat.id}>
                    {vat.name} ({vat.kulcs}%)
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

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
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
      </Paper>
    </Box>
  )
}
