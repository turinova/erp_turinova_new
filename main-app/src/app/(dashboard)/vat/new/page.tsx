'use client'

import React, { useState } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface VatRate {
  id: string
  name: string
  kulcs: number
  created_at: string
  updated_at: string
}

export default function NewVatPage() {
  const router = useRouter()
  
  // Initialize with empty VAT rate data
  const [vatRate, setVatRate] = useState<VatRate>({
    id: '',
    name: '',
    kulcs: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  const handleBack = () => {
    router.push('/vat')
  }

  const handleInputChange = (field: keyof VatRate, value: string | number) => {
    setVatRate(prev => ({ ...prev, [field]: value }))


    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSave = async () => {
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!vatRate.name.trim()) {
      newErrors.name = 'A név mező kötelező'
    }
    
    if (vatRate.kulcs < 0 || vatRate.kulcs > 100) {
      newErrors.kulcs = 'A kulcs értéke 0 és 100 között kell legyen'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      
return
    }
    
    setIsSaving(true)
    
    try {
      const response = await fetch('/api/vat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vatRate),
      })
      
      if (response.ok) {
        const result = await response.json()

        toast.success('Új adónem sikeresen létrehozva!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })

        // Invalidate cache to refresh list page
        invalidateApiCache('/api/vat')
        
        // Navigate to the new VAT rate's detail page
        router.push(`/vat/${result.data.id}`)
      } else {
        const errorData = await response.json()
        
        // Handle duplicate name error specifically
        if (response.status === 409 && errorData.message.includes('név')) {
          setErrors({ name: 'Egy adónem már létezik ezzel a névvel' })
          
return
        }
        
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
          href="/vat"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Törzsadatok
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="/vat"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Adónemek
        </Link>
        <Typography color="text.primary">
          Új adónem
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Új adónem hozzáadása
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
              value={vatRate.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              error={!!errors.name}
              helperText={errors.name}
              placeholder="pl. ÁFA 27%, ÁFA mentes, ÁFA 5%..."
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Kulcs (%)"
              type="number"
              value={vatRate.kulcs}
              onChange={(e) => handleInputChange('kulcs', parseFloat(e.target.value) || 0)}
              required
              error={!!errors.kulcs}
              helperText={errors.kulcs}
              inputProps={{ min: 0, max: 100, step: 0.01 }}
              placeholder="0.00"
            />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}
