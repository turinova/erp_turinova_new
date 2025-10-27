'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, Switch, FormControlLabel } from '@mui/material'
import { Home as HomeIcon, ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

interface Company {
  id: string
  name: string
  slug: string
  is_active: boolean
  supabase_url: string
  supabase_anon_key: string
  created_at: string
  updated_at: string
  logo_url?: string
  settings?: any
}

interface CompanyEditClientProps {
  initialCompany: Company
}

export default function CompanyEditClient({ initialCompany }: CompanyEditClientProps) {
  const router = useRouter()
  
  const [company, setCompany] = useState<Company>(initialCompany)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  const handleBack = () => {
    router.push('/companies')
  }

  const handleInputChange = (field: keyof Company, value: any) => {
    setCompany(prev => ({ ...prev, [field]: value }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSave = async () => {
    if (!company) return
    
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!company.name.trim()) {
      newErrors.name = 'A név mező kötelező'
    }
    
    if (!company.slug.trim()) {
      newErrors.slug = 'A slug mező kötelező'
    }
    
    if (!company.supabase_url.trim()) {
      newErrors.supabase_url = 'A Supabase URL mező kötelező'
    }
    
    if (!company.supabase_anon_key.trim()) {
      newErrors.supabase_anon_key = 'A Supabase Anon Key mező kötelező'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsSaving(true)
    
    try {
      const response = await fetch(`/api/companies/${company.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(company),
      })
      
      if (response.ok) {
        const result = await response.json()

        toast.success('Cég adatok sikeresen mentve!', {
          position: "top-right",
          autoClose: 3000,
        })

        // Update local state with saved data
        setCompany(result)
        
        // Optionally navigate back to list
        // router.push('/companies')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Mentés sikertelen')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error(`Hiba történt a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
        position: "top-right",
        autoClose: 5000,
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
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Kezdőlap
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="/companies"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Cégek
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {company.name}
        </Typography>
      </Breadcrumbs>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Cég szerkesztése</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
          >
            Vissza
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Mentés...' : 'Mentés'}
          </Button>
        </Box>
      </Box>
      
      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>Alapadatok</Typography>
            <Divider sx={{ mb: 3 }} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Név"
              value={company.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              error={!!errors.name}
              helperText={errors.name}
              required
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Slug"
              value={company.slug}
              onChange={(e) => handleInputChange('slug', e.target.value)}
              error={!!errors.slug}
              helperText={errors.slug || 'URL-barát azonosító'}
              required
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={company.is_active}
                  onChange={(e) => handleInputChange('is_active', e.target.checked)}
                />
              }
              label="Aktív"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Supabase Kapcsolat</Typography>
            <Divider sx={{ mb: 3 }} />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Supabase URL"
              value={company.supabase_url}
              onChange={(e) => handleInputChange('supabase_url', e.target.value)}
              error={!!errors.supabase_url}
              helperText={errors.supabase_url || 'pl.: https://your-project.supabase.co'}
              required
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Supabase Anon Key"
              value={company.supabase_anon_key}
              onChange={(e) => handleInputChange('supabase_anon_key', e.target.value)}
              error={!!errors.supabase_anon_key}
              helperText={errors.supabase_anon_key}
              required
              multiline
              rows={3}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              Létrehozva: {new Date(company.created_at).toLocaleString('hu-HU')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Utolsó módosítás: {new Date(company.updated_at).toLocaleString('hu-HU')}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}

