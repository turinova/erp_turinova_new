'use client'

import React, { useState } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface Unit {
  id: string
  name: string
  shortform: string
  created_at: string
  updated_at: string
}

export default function NewUnitPage() {
  const router = useRouter()
  
  // Initialize with empty unit data
  const [unit, setUnit] = useState<Unit>({
    id: '',
    name: '',
    shortform: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  const handleBack = () => {
    router.push('/units')
  }

  const handleInputChange = (field: keyof Unit, value: string) => {
    setUnit(prev => ({ ...prev, [field]: value }))


    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSave = async () => {
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!unit.name.trim()) {
      newErrors.name = 'A név mező kötelező'
    }
    
    if (!unit.shortform.trim()) {
      newErrors.shortform = 'A rövidítés mező kötelező'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      
return
    }
    
    setIsSaving(true)
    
    try {
      const response = await fetch('/api/units', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(unit),
      })
      
      if (response.ok) {
        const result = await response.json()

        toast.success('Új egység sikeresen létrehozva!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })

        // Invalidate cache to refresh list page
        invalidateApiCache('/api/units')
        
        // Navigate to the new unit's detail page
        router.push(`/units/${result.data.id}`)
      } else {
        const errorData = await response.json()
        
        // Handle duplicate name error specifically
        if (response.status === 409 && errorData.message.includes('név')) {
          setErrors({ name: 'Egy egység már létezik ezzel a névvel' })
          
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
          href="/units"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Törzsadatok
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="/units"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Egységek
        </Link>
        <Typography color="text.primary">
          Új egység
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Új egység hozzáadása
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
              value={unit.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              error={!!errors.name}
              helperText={errors.name}
              placeholder="pl. Darab, Kilogramm, Méter, Liter..."
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Rövidítés"
              value={unit.shortform}
              onChange={(e) => handleInputChange('shortform', e.target.value)}
              required
              error={!!errors.shortform}
              helperText={errors.shortform}
              placeholder="pl. db, kg, m, l..."
            />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}
