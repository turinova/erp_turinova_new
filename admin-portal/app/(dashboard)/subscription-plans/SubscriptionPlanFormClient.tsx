'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Paper,
  Grid,
  Divider,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Checkbox,
  FormGroup,
  FormControl,
  InputLabel,
  MenuItem,
  Select
} from '@mui/material'
import {
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface SubscriptionPlan {
  id?: string
  name: string
  slug: string
  price_monthly: number | null
  price_yearly: number | null
  features: Record<string, any>
  ai_credits_per_month: number | null
  is_active: boolean
  display_order: number
  tenant_count?: number
  created_at?: string
  updated_at?: string
}

interface SubscriptionPlanFormClientProps {
  initialPlan?: SubscriptionPlan
}

// Available features that can be toggled
const AVAILABLE_FEATURES = [
  { key: 'ai_generation', label: 'AI Generálás', description: 'AI-alapú tartalom generálás' },
  { key: 'analytics', label: 'Elemzés', description: 'Részletes elemzési funkciók' },
  { key: 'invoicing', label: 'Számlázás', description: 'Számla kezelés (jövőbeli funkció)' },
  { key: 'shipping', label: 'Szállítás', description: 'Szállítási kezelés (jövőbeli funkció)' },
  { key: 'advanced_reporting', label: 'Haladó jelentések', description: 'Részletes jelentések és exportálás' },
  { key: 'api_access', label: 'API hozzáférés', description: 'REST API hozzáférés' },
  { key: 'priority_support', label: 'Prioritásos támogatás', description: '24/7 prioritásos ügyfélszolgálat' }
]

export default function SubscriptionPlanFormClient({ initialPlan }: SubscriptionPlanFormClientProps) {
  const router = useRouter()
  const isEditing = !!initialPlan

  const [plan, setPlan] = useState<SubscriptionPlan>(initialPlan || {
    name: '',
    slug: '',
    price_monthly: null,
    price_yearly: null,
    features: {},
    ai_credits_per_month: null,
    is_active: true,
    display_order: 0
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  const handleBack = () => {
    router.push('/subscription-plans')
  }

  const handleInputChange = (field: keyof SubscriptionPlan, value: any) => {
    setPlan(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleFeatureToggle = (featureKey: string, enabled: boolean) => {
    setPlan(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [featureKey]: enabled
      }
    }))
  }

  const handleSave = async () => {
    const newErrors: { [key: string]: string } = {}

    if (!plan.name.trim()) {
      newErrors.name = 'A név mező kötelező'
    }

    if (!plan.slug.trim()) {
      newErrors.slug = 'A slug mező kötelező'
    } else if (!/^[a-z0-9-]+$/.test(plan.slug)) {
      newErrors.slug = 'A slug csak kisbetűket, számokat és kötőjeleket tartalmazhat'
    }

    if (plan.price_monthly !== null && plan.price_monthly < 0) {
      newErrors.price_monthly = 'Az ár nem lehet negatív'
    }

    if (plan.price_yearly !== null && plan.price_yearly < 0) {
      newErrors.price_yearly = 'Az ár nem lehet negatív'
    }

    if (plan.ai_credits_per_month !== null && plan.ai_credits_per_month < 0) {
      newErrors.ai_credits_per_month = 'A limit nem lehet negatív'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSaving(true)

    try {
      const url = isEditing
        ? `/api/subscription-plans/${plan.id}`
        : '/api/subscription-plans'
      
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(plan),
      })

      if (response.ok) {
        toast.success(isEditing ? 'Előfizetési terv frissítve!' : 'Előfizetési terv létrehozva!', {
          position: "top-right",
          autoClose: 3000,
        })
        router.push('/subscription-plans')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Mentés sikertelen')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error(`Hiba történt: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
        position: "top-right",
        autoClose: 5000,
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    handleInputChange('name', name)
    if (!isEditing && !plan.slug) {
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      handleInputChange('slug', slug)
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
          href="/subscription-plans"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Előfizetési tervek
        </Link>
        <Typography color="text.primary">
          {isEditing ? plan.name : 'Új terv'}
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {isEditing ? 'Előfizetési terv szerkesztése' : 'Új előfizetési terv'}
        </Typography>
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

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Alapadatok</Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Név"
                  value={plan.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  error={!!errors.name}
                  helperText={errors.name}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Slug"
                  value={plan.slug}
                  onChange={(e) => handleInputChange('slug', e.target.value)}
                  error={!!errors.slug}
                  helperText={errors.slug || 'URL-barát azonosító (pl: pro-plan)'}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Megjelenési sorrend"
                  type="number"
                  value={plan.display_order}
                  onChange={(e) => handleInputChange('display_order', parseInt(e.target.value) || 0)}
                  helperText="Alacsonyabb szám = előbb jelenik meg"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={plan.is_active}
                      onChange={(e) => handleInputChange('is_active', e.target.checked)}
                    />
                  }
                  label="Aktív"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Pricing */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Árazás</Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Havi ár (HUF)"
                  type="number"
                  value={plan.price_monthly || ''}
                  onChange={(e) => handleInputChange('price_monthly', e.target.value ? parseFloat(e.target.value) : null)}
                  error={!!errors.price_monthly}
                  helperText={errors.price_monthly}
                  InputProps={{
                    inputProps: { min: 0, step: 1 }
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Éves ár (HUF)"
                  type="number"
                  value={plan.price_yearly || ''}
                  onChange={(e) => handleInputChange('price_yearly', e.target.value ? parseFloat(e.target.value) : null)}
                  error={!!errors.price_yearly}
                  helperText={errors.price_yearly}
                  InputProps={{
                    inputProps: { min: 0, step: 1 }
                  }}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Turitoken Limit */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Turitoken limit</Typography>
            <Divider sx={{ mb: 3 }} />

            <TextField
              fullWidth
              label="Havi Turitoken limit"
              type="number"
              value={plan.ai_credits_per_month || ''}
              onChange={(e) => handleInputChange('ai_credits_per_month', e.target.value ? parseInt(e.target.value) : null)}
              error={!!errors.ai_credits_per_month}
              helperText={errors.ai_credits_per_month || 'Hagyd üresen korlátlan limithez'}
              InputProps={{
                inputProps: { min: 0, step: 1 }
              }}
            />
          </Paper>
        </Grid>

        {/* Features */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Funkciók</Typography>
            <Divider sx={{ mb: 3 }} />

            <FormGroup>
              {AVAILABLE_FEATURES.map((feature) => (
                <FormControlLabel
                  key={feature.key}
                  control={
                    <Checkbox
                      checked={plan.features[feature.key] === true || (typeof plan.features[feature.key] === 'object' && plan.features[feature.key]?.enabled === true)}
                      onChange={(e) => handleFeatureToggle(feature.key, e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {feature.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {feature.description}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </FormGroup>
          </Paper>
        </Grid>

        {/* Statistics (if editing) */}
        {isEditing && plan.tenant_count !== undefined && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Statisztikák</Typography>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Aktív ügyfelek</Typography>
                    <Typography variant="h5">{plan.tenant_count || 0}</Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}
