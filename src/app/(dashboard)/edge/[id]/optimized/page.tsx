'use client'

import React, { useState, use } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

import { useEdgeMaterial, useBrands, useVatRates, useUpdateEdgeMaterial } from '@/hooks/useEdgeMaterials'

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
  brands: {
    name: string
  }
  vat: {
    name: string
    kulcs: number
  }
}

export default function OptimizedEdgeMaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  
  // Use optimized hooks with caching
  const { edgeMaterial, isLoading: materialLoading, error: materialError } = useEdgeMaterial(resolvedParams.id)
  const { brands, isLoading: brandsLoading } = useBrands()
  const { vatRates, isLoading: vatLoading } = useVatRates()
  const { updateEdgeMaterial, isUpdating } = useUpdateEdgeMaterial()
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [localEdgeMaterial, setLocalEdgeMaterial] = useState<EdgeMaterial | null>(null)

  // Update local state when edge material data loads
  React.useEffect(() => {
    if (edgeMaterial) {
      setLocalEdgeMaterial(edgeMaterial)
    }
  }, [edgeMaterial])

  const isLoading = materialLoading || brandsLoading || vatLoading

  const handleBack = () => {
    router.push('/edge')
  }

  const handleInputChange = (field: keyof EdgeMaterial, value: string | number) => {
    if (localEdgeMaterial) {
      setLocalEdgeMaterial(prev => prev ? { ...prev, [field]: value } : null)


      // Clear error when user starts typing
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }))
      }
    }
  }

  const handleSave = async () => {
    if (!localEdgeMaterial) return
    
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!localEdgeMaterial.type.trim()) {
      newErrors.type = 'A típus mező kötelező'
    }
    
    if (!localEdgeMaterial.decor.trim()) {
      newErrors.decor = 'A dekor mező kötelező'
    }
    
    if (localEdgeMaterial.thickness <= 0) {
      newErrors.thickness = 'A vastagság nagyobb kell legyen mint 0'
    }
    
    if (localEdgeMaterial.width <= 0) {
      newErrors.width = 'A szélesség nagyobb kell legyen mint 0'
    }
    
    if (localEdgeMaterial.price <= 0) {
      newErrors.price = 'Az ár nagyobb kell legyen mint 0'
    }
    
    if (!localEdgeMaterial.brand_id) {
      newErrors.brand_id = 'A márka kiválasztása kötelező'
    }
    
    if (!localEdgeMaterial.vat_id) {
      newErrors.vat_id = 'Az adónem kiválasztása kötelező'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      
return
    }
    
    try {
      const result = await updateEdgeMaterial(localEdgeMaterial.id, localEdgeMaterial)
      
      toast.success('Élzáró adatok sikeresen mentve!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
      
      // Update local state with saved data
      setLocalEdgeMaterial(result.data || result)
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
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Adatok betöltése...</Typography>
      </Box>
    )
  }

  if (materialError || !localEdgeMaterial) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" color="error">
          Élzáró nem található vagy hiba történt a betöltés során
        </Typography>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          Vissza az élzárók listájához
        </Button>
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
          {localEdgeMaterial.type}-{localEdgeMaterial.width}/{localEdgeMaterial.thickness}-{localEdgeMaterial.decor}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Élzáró szerkesztése (Optimalizált)
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
                value={localEdgeMaterial.brand_id}
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
              value={localEdgeMaterial.type}
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
              value={localEdgeMaterial.decor}
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
              value={localEdgeMaterial.width}
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
              value={localEdgeMaterial.thickness}
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
              value={localEdgeMaterial.price}
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
                value={localEdgeMaterial.vat_id}
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

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Cache-elt verzió - gyorsabb betöltés
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleBack}
              disabled={isUpdating}
            >
              Mégse
            </Button>
            <Button
              variant="contained"
              startIcon={isUpdating ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={isUpdating}
            >
              {isUpdating ? 'Mentés...' : 'Mentés'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
