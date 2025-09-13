'use client'

import React, { useState, use, useEffect } from 'react'
import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'

interface Brand {
  id: string
  name: string
  comment: string | null
  created_at: string
  updated_at: string
}

export default function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  
  // Sample data - replace with actual API call
  const initialBrand: Brand = {
    id: resolvedParams.id,
    name: 'Egger',
    comment: 'Magyarország egyik vezető furnérgyártója',
    created_at: '2025-09-08T12:21:59.233917+00:00',
    updated_at: '2025-09-13T05:46:21.750811+00:00'
  }

  const [brand, setBrand] = useState<Brand | null>(null)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load brand data from API
  useEffect(() => {
    const loadBrand = async () => {
      try {
        const response = await fetch(`/api/brands/${resolvedParams.id}`)
        if (response.ok) {
          const brandData = await response.json()
          setBrand(brandData)
        } else {
          console.error('Failed to load brand')
          // Fallback to initial data if API fails
          setBrand(initialBrand)
        }
      } catch (error) {
        console.error('Error loading brand:', error)
        // Fallback to initial data if API fails
        setBrand(initialBrand)
      } finally {
        setIsLoading(false)
      }
    }

    loadBrand()
  }, [resolvedParams.id])

  const handleBack = () => {
    router.push('/brands')
  }

  const handleInputChange = (field: keyof Brand, value: string) => {
    if (brand) {
      setBrand(prev => prev ? { ...prev, [field]: value } : null)
      // Clear error when user starts typing
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }))
      }
    }
  }

  const handleSave = async () => {
    if (!brand) return
    
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!brand.name.trim()) {
      newErrors.name = 'A név mező kötelező'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsSaving(true)
    
    try {
      const response = await fetch(`/api/brands/${brand.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(brand),
      })
      
      if (response.ok) {
        const result = await response.json()
        toast.success('Gyártó adatok sikeresen mentve!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        // Update local state with saved data
        setBrand(result.brand)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Mentés sikertelen')
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

  if (!brand) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" color="error">
          Gyártó nem található
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mt: 2 }}
        >
          Vissza
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
          href="/brands"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Törzsadatok
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="/brands"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Gyártók
        </Link>
        <Typography color="text.primary">
          {brand.name}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Gyártó adatok szerkesztése
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

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary">
              Alapadatok
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Név"
              value={brand.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              error={!!errors.name}
              helperText={errors.name}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Megjegyzés"
              value={brand.comment || ''}
              onChange={(e) => handleInputChange('comment', e.target.value)}
              multiline
              rows={3}
              placeholder="Gyártó leírása, információk..."
            />
          </Grid>

          {/* Metadata */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
              Metaadatok
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Létrehozva"
              value={new Date(brand.created_at).toLocaleDateString('hu-HU')}
              InputProps={{ readOnly: true }}
              variant="filled"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Utoljára módosítva"
              value={new Date(brand.updated_at).toLocaleDateString('hu-HU')}
              InputProps={{ readOnly: true }}
              variant="filled"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Gyártó ID"
              value={brand.id}
              InputProps={{ readOnly: true }}
              variant="filled"
              sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
            />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}
