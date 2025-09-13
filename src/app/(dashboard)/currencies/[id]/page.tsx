'use client'

import React, { useState, use, useEffect } from 'react'
import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'

interface Currency {
  id: string
  name: string
  rate: number
  created_at: string
  updated_at: string
}

export default function CurrencyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  
  // Sample data - replace with actual API call
  const initialCurrency: Currency = {
    id: resolvedParams.id,
    name: 'EUR',
    rate: 0.0025,
    created_at: '2025-09-13T06:00:00Z',
    updated_at: '2025-09-13T06:00:00Z'
  }

  const [currency, setCurrency] = useState<Currency | null>(null)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load currency data from API
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const response = await fetch(`/api/currencies/${resolvedParams.id}`)
        if (response.ok) {
          const currencyData = await response.json()
          setCurrency(currencyData)
        } else {
          console.error('Failed to load currency')
          // Fallback to initial data if API fails
          setCurrency(initialCurrency)
        }
      } catch (error) {
        console.error('Error loading currency:', error)
        // Fallback to initial data if API fails
        setCurrency(initialCurrency)
      } finally {
        setIsLoading(false)
      }
    }

    loadCurrency()
  }, [resolvedParams.id])

  const handleBack = () => {
    router.push('/currencies')
  }

  const handleInputChange = (field: keyof Currency, value: string | number) => {
    if (currency) {
      setCurrency(prev => prev ? { ...prev, [field]: value } : null)
      // Clear error when user starts typing
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }))
      }
    }
  }

  const handleSave = async () => {
    if (!currency) return
    
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!currency.name.trim()) {
      newErrors.name = 'A név mező kötelező'
    }
    
    if (currency.rate <= 0) {
      newErrors.rate = 'Az árfolyam értéke nagyobb kell legyen mint 0'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsSaving(true)
    
    try {
      const response = await fetch(`/api/currencies/${currency.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(currency),
      })
      
      if (response.ok) {
        const result = await response.json()
        toast.success('Pénznem adatok sikeresen mentve!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        // Update local state with saved data
        setCurrency(result.currency)
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

  if (!currency) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" color="error">
          Pénznem nem található
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
          href="/currencies"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Törzsadatok
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="/currencies"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Pénznemek
        </Link>
        <Typography color="text.primary">
          {currency.name}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Pénznem adatok szerkesztése
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
              value={currency.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              error={!!errors.name}
              helperText={errors.name}
              placeholder="pl. EUR, USD, GBP..."
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Árfolyam (HUF alap)"
              type="number"
              value={currency.rate}
              onChange={(e) => handleInputChange('rate', parseFloat(e.target.value) || 0)}
              required
              error={!!errors.rate}
              helperText={errors.rate}
              inputProps={{ min: 0, step: 0.0001 }}
              placeholder="0.0000"
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
              value={new Date(currency.created_at).toLocaleDateString('hu-HU')}
              InputProps={{ readOnly: true }}
              variant="filled"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Utoljára módosítva"
              value={new Date(currency.updated_at).toLocaleDateString('hu-HU')}
              InputProps={{ readOnly: true }}
              variant="filled"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Pénznem ID"
              value={currency.id}
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
