'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Paper,
  Grid,
  Button,
  TextField,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Chip
} from '@mui/material'
import {
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Error as ErrorIcon,
  Info as InfoIcon,
  Download as DownloadIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  ai_credits_per_month: number | null
  price_monthly: number | null
}

interface FormData {
  name: string
  slug: string
  plan_id: string
  supabase_project_id: string
  supabase_url: string
  supabase_anon_key: string
  supabase_service_role_key: string
  is_active: boolean
  subscription_status: string
}

interface ValidationState {
  slugAvailable: boolean | null
  connectionTested: boolean
  connectionValid: boolean | null
  schemaValid: boolean | null
  missingTables: string[] | null
  testingConnection: boolean
}

const steps = [
  { id: 'basic', label: 'Alapadatok' },
  { id: 'database', label: 'Adatbázis beállítás' },
  { id: 'review', label: 'Áttekintés' }
]

export default function TenantNewClient({ initialPlans }: { initialPlans: SubscriptionPlan[] }) {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(0)
  const [plans, setPlans] = useState<SubscriptionPlan[]>(initialPlans || [])
  const [formData, setFormData] = useState<FormData>({
    name: '',
    slug: '',
    plan_id: '',
    supabase_project_id: '',
    supabase_url: '',
    supabase_anon_key: '',
    supabase_service_role_key: '',
    is_active: true,
    subscription_status: 'trial'
  })
  const [validation, setValidation] = useState<ValidationState>({
    slugAvailable: null,
    connectionTested: false,
    connectionValid: null,
    schemaValid: null,
    missingTables: null,
    testingConnection: false
  })
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isCreating, setIsCreating] = useState(false)
  const [showAnonKey, setShowAnonKey] = useState(false)
  const [showServiceKey, setShowServiceKey] = useState(false)

  // Generate slug from name
  useEffect(() => {
    if (formData.name && !formData.slug) {
      const generatedSlug = formData.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setFormData(prev => ({ ...prev, slug: generatedSlug }))
    }
  }, [formData.name])

  // Check slug availability
  useEffect(() => {
    if (formData.slug && formData.slug.length >= 3) {
      const checkSlug = async () => {
        try {
          const response = await fetch(`/api/tenants?slug=${formData.slug}`)
          const data = await response.json()
          setValidation(prev => ({ ...prev, slugAvailable: !data.exists }))
        } catch (error) {
          console.error('Error checking slug:', error)
        }
      }
      const timeoutId = setTimeout(checkSlug, 500)
      return () => clearTimeout(timeoutId)
    } else {
      setValidation(prev => ({ ...prev, slugAvailable: null }))
    }
  }, [formData.slug])

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validateStep = (step: number): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (step === 0) {
      if (!formData.name.trim()) {
        newErrors.name = 'A név kötelező'
      }
      if (!formData.slug.trim()) {
        newErrors.slug = 'A slug kötelező'
      } else if (formData.slug.length < 3) {
        newErrors.slug = 'A slug legalább 3 karakter hosszú kell legyen'
      } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
        newErrors.slug = 'A slug csak kisbetűket, számokat és kötőjeleket tartalmazhat'
      } else if (validation.slugAvailable === false) {
        newErrors.slug = 'Ez a slug már foglalt'
      }
      if (!formData.plan_id) {
        newErrors.plan_id = 'Válasszon előfizetési tervet'
      }
    }

    if (step === 1) {
      if (!formData.supabase_url.trim()) {
        newErrors.supabase_url = 'A Supabase URL kötelező'
      } else if (!formData.supabase_url.startsWith('https://') || !formData.supabase_url.includes('.supabase.co')) {
        newErrors.supabase_url = 'Érvényes Supabase URL-t adjon meg (pl. https://xxxxx.supabase.co)'
      }
      if (!formData.supabase_anon_key.trim()) {
        newErrors.supabase_anon_key = 'Az Anon Key kötelező'
      }
      if (!formData.supabase_service_role_key.trim()) {
        newErrors.supabase_service_role_key = 'A Service Role Key kötelező'
      }
      if (!validation.connectionTested) {
        newErrors.connection = 'Kérjük, tesztelje a kapcsolatot'
      } else if (validation.connectionValid === false) {
        newErrors.connection = 'A kapcsolat tesztelése sikertelen volt'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    setActiveStep(prev => prev - 1)
  }

  const handleTestConnection = async () => {
    if (!formData.supabase_url || !formData.supabase_anon_key) {
      toast.error('Kérjük, töltse ki a Supabase URL-t és az Anon Key-t')
      return
    }

    setValidation(prev => ({ ...prev, testingConnection: true, connectionTested: false }))

    try {
      const response = await fetch('/api/tenants/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formData.supabase_url,
          anonKey: formData.supabase_anon_key,
          serviceRoleKey: formData.supabase_service_role_key
        })
      })

      const data = await response.json()

      if (data.success) {
        setValidation(prev => ({
          ...prev,
          connectionTested: true,
          connectionValid: true,
          schemaValid: data.schemaValid,
          missingTables: data.missingTables,
          testingConnection: false
        }))
        toast.success(data.message || 'Kapcsolat sikeresen tesztelve')
      } else {
        setValidation(prev => ({
          ...prev,
          connectionTested: true,
          connectionValid: false,
          testingConnection: false
        }))
        toast.error(data.error || 'Kapcsolat tesztelése sikertelen')
      }
    } catch (error: any) {
      setValidation(prev => ({
        ...prev,
        connectionTested: true,
        connectionValid: false,
        testingConnection: false
      }))
      toast.error('Hiba a kapcsolat tesztelése során')
      console.error('Connection test error:', error)
    }
  }

  const handleCreate = async () => {
    if (!validateStep(0) || !validateStep(1)) {
      toast.error('Kérjük, javítsa ki a hibákat')
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          subscription_status: formData.subscription_status || 'trial'
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Ügyfél sikeresen létrehozva!')
        router.push(`/tenants/${data.id}`)
      } else {
        toast.error(data.error || 'Hiba az ügyfél létrehozása során')
        setIsCreating(false)
      }
    } catch (error: any) {
      console.error('Error creating tenant:', error)
      toast.error('Hiba az ügyfél létrehozása során')
      setIsCreating(false)
    }
  }

  const selectedPlan = plans.find(p => p.id === formData.plan_id)

  return (
    <Box>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          color="inherit"
          href="/"
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Főoldal
        </Link>
        <Link
          color="inherit"
          href="/tenants"
          sx={{ textDecoration: 'none' }}
        >
          Ügyfelek
        </Link>
        <Typography color="text.primary">Új ügyfél</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Új ügyfél létrehozása
        </Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/tenants')}
        >
          Vissza
        </Button>
      </Box>

      {/* Stepper */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Step 1: Basic Information */}
          <Step>
            <StepLabel>Alapadatok</StepLabel>
            <StepContent>
              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Ügyfél neve"
                    value={formData.name}
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
                    value={formData.slug}
                    onChange={(e) => handleInputChange('slug', e.target.value.toLowerCase())}
                    error={!!errors.slug}
                    helperText={errors.slug || (validation.slugAvailable === true && '✓ Elérhető')}
                    required
                    InputProps={{
                      endAdornment: validation.slugAvailable === false && (
                        <Chip label="Foglalt" color="error" size="small" />
                      )
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    URL-ben használt azonosító (pl. tenant-2)
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth error={!!errors.plan_id}>
                    <InputLabel>Előfizetési terv</InputLabel>
                    <Select
                      value={formData.plan_id}
                      onChange={(e) => handleInputChange('plan_id', e.target.value)}
                      label="Előfizetési terv"
                    >
                      {plans.map((plan) => (
                        <MenuItem key={plan.id} value={plan.id}>
                          {plan.name}
                          {plan.ai_credits_per_month !== null && plan.ai_credits_per_month !== Infinity && (
                            <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                              ({plan.ai_credits_per_month} Turitoken/hó)
                            </Typography>
                          )}
                          {plan.ai_credits_per_month === null || plan.ai_credits_per_month === Infinity ? (
                            <Typography component="span" variant="caption" sx={{ ml: 1, color: 'success.main' }}>
                              (Korlátlan)
                            </Typography>
                          ) : null}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.plan_id && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                        {errors.plan_id}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
              </Grid>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={handleNext} variant="contained">
                  Következő: Adatbázis beállítás
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 2: Database Connection */}
          <Step>
            <StepLabel>Adatbázis beállítás</StepLabel>
            <StepContent>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="body2">
                    <strong>Fontos:</strong> Hozzon létre egy új Supabase projektet és futtassa le a database template SQL-t
                    az adatbázisban, mielőtt folytatná.
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => window.open('/api/tenants/template/download', '_blank')}
                    sx={{ ml: 2, flexShrink: 0 }}
                  >
                    SQL Template letöltése
                  </Button>
                </Box>
              </Alert>

              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Supabase Project ID"
                    value={formData.supabase_project_id}
                    onChange={(e) => handleInputChange('supabase_project_id', e.target.value)}
                    helperText="A Supabase projekt beállításokban található"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Supabase URL"
                    value={formData.supabase_url}
                    onChange={(e) => handleInputChange('supabase_url', e.target.value)}
                    error={!!errors.supabase_url}
                    helperText={errors.supabase_url || 'pl. https://xxxxx.supabase.co'}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Anon Key"
                    type={showAnonKey ? 'text' : 'password'}
                    value={formData.supabase_anon_key}
                    onChange={(e) => handleInputChange('supabase_anon_key', e.target.value)}
                    error={!!errors.supabase_anon_key}
                    helperText={errors.supabase_anon_key}
                    required
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowAnonKey(!showAnonKey)} edge="end">
                            {showAnonKey ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Service Role Key"
                    type={showServiceKey ? 'text' : 'password'}
                    value={formData.supabase_service_role_key}
                    onChange={(e) => handleInputChange('supabase_service_role_key', e.target.value)}
                    error={!!errors.supabase_service_role_key}
                    helperText={errors.supabase_service_role_key}
                    required
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowServiceKey(!showServiceKey)} edge="end">
                            {showServiceKey ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    onClick={handleTestConnection}
                    disabled={validation.testingConnection || !formData.supabase_url || !formData.supabase_anon_key}
                    startIcon={validation.testingConnection ? <CircularProgress size={20} /> : <InfoIcon />}
                  >
                    {validation.testingConnection ? 'Tesztelés...' : 'Kapcsolat tesztelése'}
                  </Button>
                  {validation.connectionTested && (
                    <Box sx={{ mt: 2 }}>
                      {validation.connectionValid ? (
                        <Alert severity="success" icon={<CheckCircle />}>
                          Kapcsolat sikeresen tesztelve
                          {validation.schemaValid && ' - Adatbázis séma ellenőrizve'}
                          {validation.missingTables && validation.missingTables.length > 0 && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              <strong>Hiányzó táblák:</strong> {validation.missingTables.join(', ')}
                            </Typography>
                          )}
                        </Alert>
                      ) : (
                        <Alert severity="error" icon={<ErrorIcon />}>
                          A kapcsolat tesztelése sikertelen volt
                        </Alert>
                      )}
                    </Box>
                  )}
                  {errors.connection && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {errors.connection}
                    </Alert>
                  )}
                </Grid>
              </Grid>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                <Button onClick={handleBack}>Vissza</Button>
                <Button onClick={handleNext} variant="contained">
                  Következő: Áttekintés
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 3: Review */}
          <Step>
            <StepLabel>Áttekintés</StepLabel>
            <StepContent>
              <Paper variant="outlined" sx={{ p: 3, mt: 1 }}>
                <Typography variant="h6" gutterBottom>Alapadatok</Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Név</Typography>
                    <Typography variant="body1">{formData.name}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Slug</Typography>
                    <Typography variant="body1">{formData.slug}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Előfizetési terv</Typography>
                    <Typography variant="body1">{selectedPlan?.name || 'Nincs kiválasztva'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Státusz</Typography>
                    <Typography variant="body1">{formData.subscription_status === 'trial' ? 'Próbaidőszak' : 'Aktív'}</Typography>
                  </Grid>
                </Grid>

                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Adatbázis kapcsolat</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Supabase URL</Typography>
                    <Typography variant="body1">{formData.supabase_url || 'Nincs megadva'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Anon Key</Typography>
                    <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {formData.supabase_anon_key ? `${formData.supabase_anon_key.substring(0, 20)}...` : 'Nincs megadva'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Service Role Key</Typography>
                    <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {formData.supabase_service_role_key ? `${formData.supabase_service_role_key.substring(0, 20)}...` : 'Nincs megadva'}
                    </Typography>
                  </Grid>
                  {validation.connectionTested && (
                    <Grid item xs={12}>
                      <Chip
                        label={validation.connectionValid ? 'Kapcsolat ellenőrizve ✓' : 'Kapcsolat nem ellenőrizve'}
                        color={validation.connectionValid ? 'success' : 'warning'}
                        sx={{ mt: 1 }}
                      />
                    </Grid>
                  )}
                </Grid>
              </Paper>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                <Button onClick={handleBack}>Vissza</Button>
                <Button
                  onClick={handleCreate}
                  variant="contained"
                  startIcon={isCreating ? <CircularProgress size={20} /> : <SaveIcon />}
                  disabled={isCreating}
                >
                  {isCreating ? 'Létrehozás...' : 'Ügyfél létrehozása'}
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </Paper>
    </Box>
  )
}
