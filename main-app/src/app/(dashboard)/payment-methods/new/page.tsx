'use client'

import React, { useState } from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress, FormControlLabel, Switch } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import { invalidateApiCache } from '@/hooks/useApiCache'

interface PaymentMethod {
  id: string
  name: string
  comment: string
  active: boolean
  created_at: string
  updated_at: string
}

export default function NewPaymentMethodPage() {
  const router = useRouter()
  
  // Initialize with empty payment method data
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>({
    id: '',
    name: '',
    comment: '',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  const handleBack = () => {
    router.push('/payment-methods')
  }

  const handleInputChange = (field: keyof PaymentMethod, value: string | boolean) => {
    setPaymentMethod(prev => ({ ...prev, [field]: value }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSave = async () => {
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!paymentMethod.name.trim()) {
      newErrors.name = 'A név mező kötelező'
    }
    
    // Validate name length
    if (paymentMethod.name.length > 50) {
      newErrors.name = 'A név maximum 50 karakter lehet'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsSaving(true)
    
    try {
      const response = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentMethod),
      })
      
      if (response.ok) {
        const result = await response.json()

        toast.success('Új fizetési mód sikeresen létrehozva!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })

        // Invalidate cache to refresh list page
        invalidateApiCache('/api/payment-methods')
        
        // Navigate to the new payment method's detail page
        router.push(`/payment-methods/${result.data.id}`)
      } else {
        const errorData = await response.json()
        
        // Handle duplicate name error specifically
        if (response.status === 409 && errorData.message.includes('név')) {
          setErrors({ name: 'Egy fizetési mód már létezik ezzel a névvel' })
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
          href="#"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Törzsadatok
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="/payment-methods"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Fizetési módok
        </Link>
        <Typography color="text.primary">
          Új fizetési mód
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Új fizetési mód hozzáadása
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
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
            disabled={isSaving}
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
              value={paymentMethod.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              error={!!errors.name}
              helperText={errors.name || 'Maximum 50 karakter'}
              placeholder="pl. Készpénz, Bankkártya, Átutalás..."
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={paymentMethod.active}
                  onChange={(e) => handleInputChange('active', e.target.checked)}
                  color="success"
                />
              }
              label="Aktív"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Megjegyzés"
              value={paymentMethod.comment}
              onChange={(e) => handleInputChange('comment', e.target.value)}
              multiline
              rows={3}
              placeholder="Opcionális megjegyzés vagy leírás..."
            />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}

