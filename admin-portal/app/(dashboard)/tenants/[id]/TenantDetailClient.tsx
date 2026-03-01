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
  Divider,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress
} from '@mui/material'
import {
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  AccountBalanceWallet as CoinsIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface Tenant {
  id: string
  name: string
  slug: string
  is_active: boolean
  supabase_url: string
  supabase_anon_key: string
  supabase_project_id?: string
  subscription_status?: string
  subscription_plan_id?: string | null
  subscription_plan?: {
    id: string
    name: string
    slug: string
    ai_credits_per_month: number
  } | null
  credit_usage?: number
  credit_limit?: number
  trial_ends_at?: string | null
  created_at: string
  updated_at: string
}

interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  ai_credits_per_month: number
  price_monthly?: number
}

interface CreditUsageLog {
  id: string
  feature_type: string
  credits_used: number
  credit_type: string
  created_at: string
  user_email: string | null
  product_context: {
    product_id?: string
    product_name?: string
    product_sku?: string
  } | null
}

interface TenantDetailClientProps {
  initialTenant: Tenant
}

export default function TenantDetailClient({ initialTenant }: TenantDetailClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(0)
  const [tenant, setTenant] = useState<Tenant>(initialTenant)

  // Debug: Log initial tenant data
  useEffect(() => {
    console.log('[TenantDetailClient] Initial tenant:', {
      id: initialTenant.id,
      subscription_plan_id: initialTenant.subscription_plan_id,
      subscription_plan: initialTenant.subscription_plan,
      credit_limit: initialTenant.credit_limit
    })
  }, [])
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([])
  const [creditLogs, setCreditLogs] = useState<CreditUsageLog[]>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [loadingPurchases, setLoadingPurchases] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [addCreditsOpen, setAddCreditsOpen] = useState(false)
  const [creditsToAdd, setCreditsToAdd] = useState<string>('')
  const [isAddingCredits, setIsAddingCredits] = useState(false)
  const [isResettingUsage, setIsResettingUsage] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  // Load subscription plans, credit logs, and purchases on mount
  useEffect(() => {
    loadSubscriptionPlans()
    loadCreditLogs()
    loadPurchases()
  }, [])

  const loadSubscriptionPlans = async () => {
    setLoadingPlans(true)
    try {
      const res = await fetch('/api/subscription-plans')
      const data = await res.json()
      if (data.success) {
        setSubscriptionPlans(data.plans || [])
      }
    } catch (error) {
      console.error('Error loading subscription plans:', error)
    } finally {
      setLoadingPlans(false)
    }
  }

  const loadCreditLogs = async () => {
    setLoadingLogs(true)
    try {
      const res = await fetch(`/api/tenants/${tenant.id}/credit-logs`)
      const data = await res.json()
      if (data.success) {
        setCreditLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Error loading credit logs:', error)
    } finally {
      setLoadingLogs(false)
    }
  }

  const loadPurchases = async () => {
    setLoadingPurchases(true)
    try {
      const res = await fetch(`/api/tenants/${tenant.id}/purchases`)
      const data = await res.json()
      if (data.success) {
        setPurchases(data.purchases || [])
      }
    } catch (error) {
      console.error('Error loading purchases:', error)
    } finally {
      setLoadingPurchases(false)
    }
  }

  const handleBack = () => {
    router.push('/tenants')
  }

  const handleInputChange = (field: keyof Tenant, value: any) => {
    setTenant(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSave = async () => {
    if (!tenant) return
    
    const newErrors: { [key: string]: string } = {}
    
    if (!tenant.name.trim()) {
      newErrors.name = 'A név mező kötelező'
    }
    
    if (!tenant.slug.trim()) {
      newErrors.slug = 'A slug mező kötelező'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsSaving(true)
    
    try {
      const response = await fetch(`/api/tenants/${tenant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: tenant.name,
          slug: tenant.slug,
          is_active: tenant.is_active,
          subscription_status: tenant.subscription_status,
          plan_id: tenant.subscription_plan_id,
          trial_ends_at: tenant.trial_ends_at
        }),
      })
      
      if (response.ok) {
        const result = await response.json()
        toast.success('Ügyfél adatok sikeresen mentve!', {
          position: "top-right",
          autoClose: 3000,
        })
        setTenant(result)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Mentés sikertelen')
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

  const refreshTenantData = async () => {
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`)
      if (res.ok) {
        const tenantData = await res.json()
        setTenant(tenantData)
      }
    } catch (error) {
      console.error('Error refreshing tenant data:', error)
    }
  }

  const handleAddCredits = async () => {
    if (!creditsToAdd || parseInt(creditsToAdd) <= 0) {
      toast.error('Kérjük, adjon meg egy érvényes számot!')
      return
    }

    setIsAddingCredits(true)
    try {
      const response = await fetch(`/api/tenants/${tenant.id}/add-credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credits: parseInt(creditsToAdd)
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${creditsToAdd} Turitoken hozzáadva! Új bónusz: ${data.bonusCredits}`, {
          position: "top-right",
          autoClose: 3000,
        })
        setAddCreditsOpen(false)
        setCreditsToAdd('')
        // Refresh tenant data to get updated limit
        await refreshTenantData()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba történt')
      }
    } catch (error) {
      console.error('Error adding credits:', error)
      toast.error(`Hiba történt: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
        position: "top-right",
        autoClose: 5000,
      })
    } finally {
      setIsAddingCredits(false)
    }
  }

  const handleResetUsage = async () => {
    if (!confirm('Biztosan szeretné resetelni az aktuális hónap használati adatait? Ez a művelet nem visszavonható, de az adatok audit céljából megmaradnak.')) {
      return
    }

    setIsResettingUsage(true)
    try {
      const response = await fetch(`/api/tenants/${tenant.id}/reset-usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Használat resetelve! ${data.logsReset} log bejegyzés resetelve.`, {
          position: "top-right",
          autoClose: 3000,
        })
        // Refresh tenant data and logs
        await Promise.all([refreshTenantData(), loadCreditLogs()])
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba történt')
      }
    } catch (error) {
      console.error('Error resetting usage:', error)
      toast.error(`Hiba történt: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`, {
        position: "top-right",
        autoClose: 5000,
      })
    } finally {
      setIsResettingUsage(false)
    }
  }

  const getFeatureLabel = (featureType: string): string => {
    const labels: Record<string, string> = {
      'meta_title': 'Meta cím',
      'meta_keywords': 'Meta kulcsszavak',
      'meta_description': 'Meta leírás',
      'url_slug': 'URL slug',
      'product_description': 'Részletes leírás',
      'product_tags': 'Termék címkék',
      'competitor_price_scrape': 'Versenyár ellenőrzés'
    }
    return labels[featureType] || featureType
  }

  const getFeatureColor = (featureType: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    if (featureType.includes('competitor')) return 'warning'
    if (featureType.includes('description')) return 'primary'
    return 'info'
  }

  const creditRemaining = tenant.credit_limit && tenant.credit_usage !== undefined
    ? Math.max(0, tenant.credit_limit - tenant.credit_usage)
    : null
  const creditPercentage = tenant.credit_limit && tenant.credit_limit > 0 && tenant.credit_usage !== undefined
    ? Math.min(100, (tenant.credit_usage / tenant.credit_limit) * 100)
    : 0

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
          href="/tenants"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          Ügyfelek
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {tenant.name}
        </Typography>
      </Breadcrumbs>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{tenant.name}</Typography>
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

      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Áttekintés" />
          <Tab label="Előfizetés" />
          <Tab label="Turitoken" />
          <Tab label="Felhasználók" />
        </Tabs>
      </Paper>

      {/* Tab 1: Overview */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Alapadatok</Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Név"
                    value={tenant.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    error={!!errors.name}
                    helperText={errors.name}
                    required
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Slug"
                    value={tenant.slug}
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
                        checked={tenant.is_active}
                        onChange={(e) => handleInputChange('is_active', e.target.checked)}
                      />
                    }
                    label="Aktív"
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Előfizetés</Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Terv</Typography>
                <Typography variant="h6">{tenant.subscription_plan?.name || 'Nincs'}</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Státusz</Typography>
                <Chip
                  label={tenant.subscription_status === 'active' ? 'Aktív' : 
                         tenant.subscription_status === 'trial' ? 'Próba' :
                         tenant.subscription_status === 'canceled' ? 'Megszakítva' :
                         tenant.subscription_status === 'expired' ? 'Lejárt' : tenant.subscription_status}
                  color={tenant.subscription_status === 'active' ? 'success' : 
                         tenant.subscription_status === 'trial' ? 'info' :
                         tenant.subscription_status === 'canceled' ? 'warning' :
                         tenant.subscription_status === 'expired' ? 'error' : 'default'}
                  size="small"
                />
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Turitoken</Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Felhasználva</Typography>
                  <Typography variant="h6">{tenant.credit_usage || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Limit</Typography>
                  <Typography variant="h6">{tenant.credit_limit !== null && tenant.credit_limit !== undefined ? tenant.credit_limit : 'Nincs limit'}</Typography>
                </Box>
                {creditRemaining !== null && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Maradék</Typography>
                    <Typography variant="h6" color={creditRemaining < 100 ? 'error' : 'success'}>
                      {creditRemaining}
                    </Typography>
                  </Box>
                )}
                {tenant.credit_limit !== null && tenant.credit_limit !== undefined && (
                  <LinearProgress
                    variant="determinate"
                    value={creditPercentage}
                    color={creditPercentage > 90 ? 'error' : creditPercentage > 70 ? 'warning' : 'success'}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                )}
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Információ</Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Létrehozva</Typography>
                <Typography variant="body1">
                  {new Date(tenant.created_at).toLocaleString('hu-HU')}
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Utolsó módosítás</Typography>
                <Typography variant="body1">
                  {new Date(tenant.updated_at).toLocaleString('hu-HU')}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Tab 2: Subscription */}
      {activeTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Előfizetés kezelése</Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="plan-select-label">Előfizetési terv</InputLabel>
                <Select
                  labelId="plan-select-label"
                  value={String(tenant.subscription_plan_id || tenant.subscription_plan?.id || '')}
                  label="Előfizetési terv"
                  onChange={(e) => {
                    console.log('[Select] Changing plan to:', e.target.value)
                    handleInputChange('subscription_plan_id', e.target.value)
                  }}
                  disabled={loadingPlans}
                >
                  {subscriptionPlans.length === 0 && !loadingPlans && (
                    <MenuItem value="" disabled>Nincs elérhető terv</MenuItem>
                  )}
                  {subscriptionPlans.map((plan) => (
                    <MenuItem key={plan.id} value={plan.id}>
                      {plan.name} ({plan.ai_credits_per_month} Turitoken/hó)
                    </MenuItem>
                  ))}
                </Select>
                {process.env.NODE_ENV === 'development' && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Debug: plan_id={String(tenant.subscription_plan_id || 'null')}, plan?.id={String(tenant.subscription_plan?.id || 'null')}
                  </Typography>
                )}
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="status-select-label">Státusz</InputLabel>
                <Select
                  labelId="status-select-label"
                  value={tenant.subscription_status || 'trial'}
                  label="Státusz"
                  onChange={(e) => handleInputChange('subscription_status', e.target.value)}
                >
                  <MenuItem value="trial">Próba</MenuItem>
                  <MenuItem value="active">Aktív</MenuItem>
                  <MenuItem value="canceled">Megszakítva</MenuItem>
                  <MenuItem value="expired">Lejárt</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Próbaidőszak vége"
                type="datetime-local"
                value={tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toISOString().slice(0, 16) : ''}
                onChange={(e) => handleInputChange('trial_ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Tab 3: Turitoken */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Turitoken használat</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadCreditLogs}
                    disabled={loadingLogs}
                  >
                    Frissítés
                  </Button>
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<RefreshIcon />}
                    onClick={handleResetUsage}
                    disabled={isResettingUsage}
                  >
                    {isResettingUsage ? 'Resetelés...' : 'Használat resetelése'}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setAddCreditsOpen(true)}
                  >
                    Turitoken hozzáadása
                  </Button>
                </Box>
              </Box>
              
              <Divider sx={{ mb: 3 }} />
              
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Felhasználva (ez hónap)</Typography>
                  <Typography variant="h6">{tenant.credit_usage || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Limit</Typography>
                  <Typography variant="h6">{tenant.credit_limit !== null && tenant.credit_limit !== undefined ? tenant.credit_limit : 'Nincs limit'}</Typography>
                </Box>
                {creditRemaining !== null && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Maradék</Typography>
                    <Typography variant="h6" color={creditRemaining < 100 ? 'error' : 'success'}>
                      {creditRemaining}
                    </Typography>
                  </Box>
                )}
                {tenant.credit_limit !== null && tenant.credit_limit !== undefined && (
                  <LinearProgress
                    variant="determinate"
                    value={creditPercentage}
                    color={creditPercentage > 90 ? 'error' : creditPercentage > 70 ? 'warning' : 'success'}
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                )}
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Dátum</TableCell>
                      <TableCell>Funkció</TableCell>
                      <TableCell>Felhasználó</TableCell>
                      <TableCell>Termék</TableCell>
                      <TableCell align="right">Turitoken</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loadingLogs ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <CircularProgress size={24} />
                        </TableCell>
                      </TableRow>
                    ) : creditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Nincs használati adat
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      creditLogs.map((log) => (
                        <TableRow key={log.id} hover>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(log.created_at).toLocaleString('hu-HU', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getFeatureLabel(log.feature_type)}
                              size="small"
                              color={getFeatureColor(log.feature_type)}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {log.user_email || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {log.product_context?.product_name ? (
                              <Typography variant="body2">
                                {log.product_context.product_name}
                                {log.product_context.product_sku && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {log.product_context.product_sku}
                                  </Typography>
                                )}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                N/A
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`-${log.credits_used}`}
                              color="error"
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* Purchase History */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Turitoken vásárlási előzmények
              </Typography>
              <Divider sx={{ mb: 3 }} />

              {loadingPurchases ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : purchases.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  Nincs vásárlási előzmény
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Dátum</TableCell>
                        <TableCell>Csomag</TableCell>
                        <TableCell align="right">Turitoken</TableCell>
                        <TableCell align="right">Ár</TableCell>
                        <TableCell>Fizetési mód</TableCell>
                        <TableCell>Felhasználó</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {purchases.map((purchase) => (
                        <TableRow key={purchase.id} hover>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(purchase.created_at).toLocaleString('hu-HU', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {purchase.token_pack?.name || 'Egyedi'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`+${purchase.credits_purchased}`}
                              color="success"
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {purchase.price_paid_huf.toLocaleString('hu-HU')} Ft
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={purchase.payment_method === 'manual' ? 'Manuális' : purchase.payment_method === 'stripe' ? 'Stripe' : purchase.payment_method}
                              size="small"
                              color={purchase.payment_method === 'manual' ? 'default' : 'primary'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {purchase.purchased_by_user_email || 'N/A'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Tab 4: Users */}
      {activeTab === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Tenant felhasználók</Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body2" color="text.secondary">
            Felhasználók kezelése hamarosan...
          </Typography>
        </Paper>
      )}

      {/* Add Credits Dialog */}
      <Dialog open={addCreditsOpen} onClose={() => setAddCreditsOpen(false)}>
        <DialogTitle>Turitoken hozzáadása</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Turitoken mennyisége"
            type="number"
            fullWidth
            variant="outlined"
            value={creditsToAdd}
            onChange={(e) => setCreditsToAdd(e.target.value)}
            helperText="Adja meg, hány Turitokent szeretne hozzáadni"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddCreditsOpen(false)}>Mégse</Button>
          <Button
            onClick={handleAddCredits}
            variant="contained"
            disabled={isAddingCredits || !creditsToAdd || parseInt(creditsToAdd) <= 0}
            startIcon={isAddingCredits ? <CircularProgress size={20} /> : <CoinsIcon />}
          >
            {isAddingCredits ? 'Hozzáadás...' : 'Hozzáadás'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
