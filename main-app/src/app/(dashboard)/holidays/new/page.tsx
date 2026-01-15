'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Grid,
  Button,
  TextField,
  Card,
  CardHeader,
  CardContent,
  Switch,
  FormControlLabel,
  MenuItem
} from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface Holiday {
  id: string
  name: string
  start_date: string
  end_date: string
  type: 'national' | 'company'
  active: boolean
  created_at: string
  updated_at: string
}

export default function NewHolidayPage() {
  const router = useRouter()
  
  const [holiday, setHoliday] = useState<Partial<Holiday>>({
    name: '',
    start_date: '',
    end_date: '',
    type: 'national',
    active: true
  })
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  const handleBack = () => {
    router.push('/holidays')
  }

  const handleInputChange = (field: keyof Holiday, value: string | boolean) => {
    setHoliday(prev => ({ ...prev, [field]: value }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSave = async () => {
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!holiday.name || !holiday.name.trim()) {
      newErrors.name = 'Az ünnep neve megadása kötelező'
    }

    if (!holiday.start_date) {
      newErrors.start_date = 'Kezdő dátum megadása kötelező'
    }

    if (!holiday.end_date) {
      newErrors.end_date = 'Vég dátum megadása kötelező'
    }

    if (holiday.start_date && holiday.end_date && new Date(holiday.end_date) < new Date(holiday.start_date)) {
      newErrors.end_date = 'A vég dátum nem lehet korábbi, mint a kezdő dátum'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsSaving(true)
    
    try {
      const response = await fetch('/api/holidays', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: holiday.name?.trim(),
          start_date: holiday.start_date,
          end_date: holiday.end_date,
          type: holiday.type || 'national',
          active: holiday.active !== undefined ? holiday.active : true,
        }),
      })
      
      if (response.ok) {
        const result = await response.json()

        toast.success('Új ünnep sikeresen létrehozva!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })

        // Invalidate cache to refresh list page
        invalidateApiCache('/api/holidays')
        
        // Navigate to the list page
        router.push('/holidays')
      } else {
        const errorData = await response.json()
        
        // Handle duplicate holiday error specifically
        if (response.status === 409 && errorData.error.includes('már létezik')) {
          setErrors({ name: 'Ez az ünnep már létezik' })
          return
        }
        
        throw new Error(errorData.error || 'Mentés sikertelen')
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
          href="/holidays"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Ünnepek
        </Link>
        <Typography color="text.primary">
          Új ünnep
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Új ünnep hozzáadása
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

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Ünnep adatai" />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Név"
                    value={holiday.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    error={!!errors.name}
                    helperText={errors.name}
                    required
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Típus"
                    select
                    value={holiday.type || 'national'}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    required
                  >
                    <MenuItem value="national">Nemzeti</MenuItem>
                    <MenuItem value="company">Céges</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Kezdő dátum"
                    type="date"
                    value={holiday.start_date || ''}
                    onChange={(e) => handleInputChange('start_date', e.target.value)}
                    error={!!errors.start_date}
                    helperText={errors.start_date}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Vég dátum"
                    type="date"
                    value={holiday.end_date || ''}
                    onChange={(e) => handleInputChange('end_date', e.target.value)}
                    error={!!errors.end_date}
                    helperText={errors.end_date}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={holiday.active !== undefined ? holiday.active : true}
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
      </Grid>
    </Box>
  )
}
