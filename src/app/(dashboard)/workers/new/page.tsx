'use client'

import React, { useState } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface Worker {
  id: string
  name: string
  nickname: string | null
  mobile: string | null
  color: string | null
  created_at: string
  updated_at: string
}

export default function NewWorkerPage() {
  const router = useRouter()
  
  // Initialize with empty worker data
  const [worker, setWorker] = useState<Worker>({
    id: '',
    name: '',
    nickname: null,
    mobile: '',
    color: '#1976d2',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  const handleBack = () => {
    router.push('/workers')
  }

  // Phone number formatting helper - same as customers page
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')
    
    // If it starts with 36, keep it as is, otherwise add 36
    let formatted = digits

    if (!digits.startsWith('36') && digits.length > 0) {
      formatted = '36' + digits
    }
    
    // Format: +36 30 999 2800
    if (formatted.length >= 2) {
      const countryCode = formatted.substring(0, 2)
      const areaCode = formatted.substring(2, 4)
      const firstPart = formatted.substring(4, 7)
      const secondPart = formatted.substring(7, 11)
      
      let result = `+${countryCode}`

      if (areaCode) result += ` ${areaCode}`
      if (firstPart) result += ` ${firstPart}`
      if (secondPart) result += ` ${secondPart}`
      
      return result
    }
    
    return value
  }

  const handleInputChange = (field: keyof Worker, value: string | null) => {
    let processedValue = value
    
    // Format phone number if it's the mobile field
    if (field === 'mobile' && typeof value === 'string') {
      processedValue = formatPhoneNumber(value)
    }
    
    setWorker(prev => ({ ...prev, [field]: processedValue }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSave = async () => {
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!worker.name.trim()) {
      newErrors.name = 'A név mező kötelező'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsSaving(true)
    
    try {
      const response = await fetch('/api/workers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: worker.name.trim(),
          nickname: worker.nickname?.trim() || null,
          mobile: worker.mobile?.trim() || null,
          color: worker.color || '#1976d2'
        }),
      })
      
      if (response.ok) {
        const result = await response.json()

        toast.success('Új dolgozó sikeresen létrehozva!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })

        // Invalidate cache to refresh list page
        invalidateApiCache('/api/workers')
        
        // Navigate to the new worker's detail page
        router.push(`/workers/${result.id}`)
      } else {
        const errorData = await response.json()
        
        // Handle duplicate name error specifically
        if (response.status === 409 && errorData.message.includes('név')) {
          setErrors({ name: 'Egy dolgozó már létezik ezzel a névvel' })
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
          href="/workers"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Törzsadatok
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="/workers"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Dolgozók
        </Link>
        <Typography color="text.primary">
          Új dolgozó
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Új dolgozó hozzáadása
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
              value={worker.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              error={!!errors.name}
              helperText={errors.name}
              placeholder="pl. Kovács János, Nagy Anna..."
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Becenév"
              value={worker.nickname || ''}
              onChange={(e) => handleInputChange('nickname', e.target.value)}
              error={!!errors.nickname}
              helperText={errors.nickname}
              placeholder="pl. Jancsi, Anni..."
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Telefon"
              value={worker.mobile || ''}
              onChange={(e) => handleInputChange('mobile', e.target.value)}
              error={!!errors.mobile}
              helperText={errors.mobile}
              placeholder="pl. +36 30 123 4567, 06301234567..."
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" sx={{ minWidth: 60 }}>
                Szín:
              </Typography>
              <input
                type="color"
                value={worker.color || '#1976d2'}
                onChange={(e) => handleInputChange('color', e.target.value)}
                style={{
                  width: 60,
                  height: 40,
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {worker.color || '#1976d2'}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}
