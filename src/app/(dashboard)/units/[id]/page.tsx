'use client'

import React, { useState, use, useEffect } from 'react'

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

export default function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  
  // Sample data - replace with actual API call
  const initialUnit: Unit = {
    id: resolvedParams.id,
    name: 'Darab',
    shortform: 'db',
    created_at: '2025-09-13T06:00:00Z',
    updated_at: '2025-09-13T06:00:00Z'
  }

  const [unit, setUnit] = useState<Unit | null>(null)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load unit data from API
  useEffect(() => {
    const loadUnit = async () => {
      try {
        const response = await fetch(`/api/units/${resolvedParams.id}`)

        if (response.ok) {
          const unitData = await response.json()

          setUnit(unitData)
        } else {
          console.error('Failed to load unit')

          // Fallback to initial data if API fails
          setUnit(initialUnit)
        }
      } catch (error) {
        console.error('Error loading unit:', error)

        // Fallback to initial data if API fails
        setUnit(initialUnit)
      } finally {
        setIsLoading(false)
      }
    }

    loadUnit()
  }, [resolvedParams.id])

  const handleBack = () => {
    router.push('/units')
  }

  const handleInputChange = (field: keyof Unit, value: string) => {
    if (unit) {
      setUnit(prev => prev ? { ...prev, [field]: value } : null)


      // Clear error when user starts typing
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }))
      }
    }
  }

  const handleSave = async () => {
    if (!unit) return
    
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
      const response = await fetch(`/api/units/${unit.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(unit),
      })
      
      if (response.ok) {
        const result = await response.json()

        toast.success('Egység adatok sikeresen mentve!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })

        // Update local state with saved data
        setUnit(result.data)
        
        // Invalidate cache to refresh list page
        invalidateApiCache('/api/units')
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

  if (!unit) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" color="error">
          Egység nem található
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
          {unit.name}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Egység adatok szerkesztése
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
              placeholder="pl. Darab, Kilogramm, Méter..."
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
              placeholder="pl. db, kg, m..."
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
              value={new Date(unit.created_at).toLocaleDateString('hu-HU')}
              InputProps={{ readOnly: true }}
              variant="filled"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Utoljára módosítva"
              value={new Date(unit.updated_at).toLocaleDateString('hu-HU')}
              InputProps={{ readOnly: true }}
              variant="filled"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Egység ID"
              value={unit.id}
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
