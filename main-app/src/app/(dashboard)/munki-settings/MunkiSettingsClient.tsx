'use client'

import React, { useState, useEffect } from 'react'

import { Box, Typography, Breadcrumbs, Link, Paper, Grid, Divider, Button, TextField, CircularProgress, MenuItem } from '@mui/material'
import { Home as HomeIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

import { usePermissions } from '@/contexts/PermissionContext'
import { useRouter } from 'next/navigation'
import { grossToNetPreservingGross, netToGross } from '@/lib/pricing/hungarianRounding'

interface Currency {
  id: string
  name: string
}

interface VatRate {
  id: string
  kulcs: number
}

interface WorktopConfigFee {
  id: string
  kereszt_vagas_fee: number
  hosszanti_vagas_fee_per_meter: number
  ives_vagas_fee: number
  szogvagas_fee: number
  kivagas_fee: number
  elzaro_fee_per_meter: number
  osszemaras_fee: number
  kereszt_vagas_fee_gross?: number | null
  hosszanti_vagas_fee_per_meter_gross?: number | null
  ives_vagas_fee_gross?: number | null
  szogvagas_fee_gross?: number | null
  kivagas_fee_gross?: number | null
  elzaro_fee_per_meter_gross?: number | null
  osszemaras_fee_gross?: number | null
  currency_id: string
  vat_id: string
  currencies: Currency
  vat: VatRate
  created_at: string
  updated_at: string
}

interface GrossPrices {
  kereszt_vagas_fee_gross: number
  hosszanti_vagas_fee_per_meter_gross: number
  ives_vagas_fee_gross: number
  szogvagas_fee_gross: number
  kivagas_fee_gross: number
  elzaro_fee_per_meter_gross: number
  osszemaras_fee_gross: number
}

interface MunkiSettingsClientProps {
  initialWorktopConfigFee: WorktopConfigFee | null
  currencies: Currency[]
  vatRates: VatRate[]
}

export default function MunkiSettingsClient({ initialWorktopConfigFee, currencies, vatRates }: MunkiSettingsClientProps) {
  const router = useRouter()
  
  // Check permission for this page
  const { canAccess, loading: permissionsLoading } = usePermissions()
  const hasAccess = canAccess('/munki-settings')
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<WorktopConfigFee | null>(initialWorktopConfigFee)
  const [grossPrices, setGrossPrices] = useState<GrossPrices>({
    kereszt_vagas_fee_gross: 0,
    hosszanti_vagas_fee_per_meter_gross: 0,
    ives_vagas_fee_gross: 0,
    szogvagas_fee_gross: 0,
    kivagas_fee_gross: 0,
    elzaro_fee_per_meter_gross: 0,
    osszemaras_fee_gross: 0
  })

  // Update form data when initial worktop config fee data changes
  useEffect(() => {
    if (initialWorktopConfigFee) {
      setFormData(initialWorktopConfigFee)
      
      // Use gross prices from database if available, otherwise calculate from net
      const vatRate = initialWorktopConfigFee.vat.kulcs / 100
      setGrossPrices({
        kereszt_vagas_fee_gross: initialWorktopConfigFee.kereszt_vagas_fee_gross ?? netToGross(initialWorktopConfigFee.kereszt_vagas_fee, vatRate),
        hosszanti_vagas_fee_per_meter_gross: initialWorktopConfigFee.hosszanti_vagas_fee_per_meter_gross ?? netToGross(initialWorktopConfigFee.hosszanti_vagas_fee_per_meter, vatRate),
        ives_vagas_fee_gross: initialWorktopConfigFee.ives_vagas_fee_gross ?? netToGross(initialWorktopConfigFee.ives_vagas_fee, vatRate),
        szogvagas_fee_gross: initialWorktopConfigFee.szogvagas_fee_gross ?? netToGross(initialWorktopConfigFee.szogvagas_fee, vatRate),
        kivagas_fee_gross: initialWorktopConfigFee.kivagas_fee_gross ?? netToGross(initialWorktopConfigFee.kivagas_fee, vatRate),
        elzaro_fee_per_meter_gross: initialWorktopConfigFee.elzaro_fee_per_meter_gross ?? netToGross(initialWorktopConfigFee.elzaro_fee_per_meter, vatRate),
        osszemaras_fee_gross: initialWorktopConfigFee.osszemaras_fee_gross ?? netToGross(initialWorktopConfigFee.osszemaras_fee, vatRate)
      })
    }
  }, [initialWorktopConfigFee])

  const handleInputChange = (field: keyof WorktopConfigFee, value: string | number) => {
    if (formData) {
      // Update the form data
      setFormData(prev => prev ? { ...prev, [field]: value } : null)
      
      // Clear error when user starts typing
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }))
      }
    }
  }

  const handleGrossPriceChange = (field: keyof GrossPrices, value: number) => {
    if (formData) {
      // Update gross price - we'll save this directly to the database
      setGrossPrices(prev => ({ ...prev, [field]: value }))
      
      // Clear error when user starts typing
      const errorField = field.replace('_gross', '')
      if (errors[errorField]) {
        setErrors(prev => ({ ...prev, [errorField]: '' }))
      }
    }
  }

  const handleSave = async () => {
    if (!formData) return
    
    const newErrors: { [key: string]: string } = {}
    
    // Validate required fields
    if (!grossPrices.kereszt_vagas_fee_gross || grossPrices.kereszt_vagas_fee_gross < 0) {
      newErrors.kereszt_vagas_fee = 'A kereszt vágás díj kötelező és nem lehet negatív'
    }
    
    if (!grossPrices.hosszanti_vagas_fee_per_meter_gross || grossPrices.hosszanti_vagas_fee_per_meter_gross < 0) {
      newErrors.hosszanti_vagas_fee_per_meter = 'A hosszanti vágás díj kötelező és nem lehet negatív'
    }
    
    if (!grossPrices.ives_vagas_fee_gross || grossPrices.ives_vagas_fee_gross < 0) {
      newErrors.ives_vagas_fee = 'Az íves vágás díj kötelező és nem lehet negatív'
    }
    
    if (!grossPrices.szogvagas_fee_gross || grossPrices.szogvagas_fee_gross < 0) {
      newErrors.szogvagas_fee = 'A szögvágás díj kötelező és nem lehet negatív'
    }
    
    if (!grossPrices.kivagas_fee_gross || grossPrices.kivagas_fee_gross < 0) {
      newErrors.kivagas_fee = 'A kivágás díj kötelező és nem lehet negatív'
    }
    
    if (!grossPrices.elzaro_fee_per_meter_gross || grossPrices.elzaro_fee_per_meter_gross < 0) {
      newErrors.elzaro_fee_per_meter = 'Az élzáró díj kötelező és nem lehet negatív'
    }
    
    if (!grossPrices.osszemaras_fee_gross || grossPrices.osszemaras_fee_gross < 0) {
      newErrors.osszemaras_fee = 'Az összemarás díj kötelező és nem lehet negatív'
    }
    
    if (!formData.currency_id) {
      newErrors.currency_id = 'A pénznem kötelező'
    }
    
    if (!formData.vat_id) {
      newErrors.vat_id = 'Az ÁFA kulcs kötelező'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsSaving(true)
    
    try {
      const response = await fetch(`/api/worktop-config-fees/${formData.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kereszt_vagas_fee_gross: grossPrices.kereszt_vagas_fee_gross,
          hosszanti_vagas_fee_per_meter_gross: grossPrices.hosszanti_vagas_fee_per_meter_gross,
          ives_vagas_fee_gross: grossPrices.ives_vagas_fee_gross,
          szogvagas_fee_gross: grossPrices.szogvagas_fee_gross,
          kivagas_fee_gross: grossPrices.kivagas_fee_gross,
          elzaro_fee_per_meter_gross: grossPrices.elzaro_fee_per_meter_gross,
          osszemaras_fee_gross: grossPrices.osszemaras_fee_gross,
          currency_id: formData.currency_id,
          vat_id: formData.vat_id,
        }),
      })
      
      if (response.ok) {
        const result = await response.json()

        toast.success('Munki beállítások sikeresen mentve!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        
        // Update local state with saved data
        setFormData(result.worktopConfigFee)
        // Update gross prices from saved data
        if (result.worktopConfigFee) {
          const saved = result.worktopConfigFee
          setGrossPrices({
            kereszt_vagas_fee_gross: saved.kereszt_vagas_fee_gross ?? grossPrices.kereszt_vagas_fee_gross,
            hosszanti_vagas_fee_per_meter_gross: saved.hosszanti_vagas_fee_per_meter_gross ?? grossPrices.hosszanti_vagas_fee_per_meter_gross,
            ives_vagas_fee_gross: saved.ives_vagas_fee_gross ?? grossPrices.ives_vagas_fee_gross,
            szogvagas_fee_gross: saved.szogvagas_fee_gross ?? grossPrices.szogvagas_fee_gross,
            kivagas_fee_gross: saved.kivagas_fee_gross ?? grossPrices.kivagas_fee_gross,
            elzaro_fee_per_meter_gross: saved.elzaro_fee_per_meter_gross ?? grossPrices.elzaro_fee_per_meter_gross,
            osszemaras_fee_gross: saved.osszemaras_fee_gross ?? grossPrices.osszemaras_fee_gross
          })
        }
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

  // Check access permission
  useEffect(() => {
    if (!permissionsLoading && !hasAccess) {
      toast.error('Nincs jogosultsága a Munki beállítások oldal megtekintéséhez!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
      router.push('/home')
    }
  }, [hasAccess, permissionsLoading, router])

  // Show loading state while permissions are being checked
  if (permissionsLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography variant="h6" color="error">
          Nincs jogosultsága a Munki beállítások oldal megtekintéséhez!
        </Typography>
      </Box>
    )
  }

  if (!formData) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" color="error">
          Munki beállítások nem találhatók
        </Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          Kérjük, először hozza létre a beállításokat az adatbázisban.
        </Typography>
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
        <Typography color="text.primary">
          Munki beállítások
        </Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Munki beállítások szerkesztése
        </Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          color="primary"
          disabled={isSaving}
        >
          {isSaving ? 'Mentés...' : 'Mentés'}
        </Button>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* Currency and VAT Settings */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary">
              Pénznem és ÁFA beállítások
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Pénznem"
              select
              value={formData.currency_id}
              onChange={(e) => handleInputChange('currency_id', e.target.value)}
              required
              error={!!errors.currency_id}
              helperText={errors.currency_id}
            >
              {currencies.map((currency) => (
                <MenuItem key={currency.id} value={currency.id}>
                  {currency.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="ÁFA kulcs"
              select
              value={formData.vat_id}
              onChange={(e) => handleInputChange('vat_id', e.target.value)}
              required
              error={!!errors.vat_id}
              helperText={errors.vat_id}
            >
              {vatRates.map((vat) => (
                <MenuItem key={vat.id} value={vat.id}>
                  {vat.kulcs}%
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Worktop Config Fees */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
              Munkapult konfiguráció díjak
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Kereszt vágás (Bruttó)"
              type="number"
              value={grossPrices.kereszt_vagas_fee_gross}
              onChange={(e) => handleGrossPriceChange('kereszt_vagas_fee_gross', parseFloat(e.target.value) || 0)}
              required
              error={!!errors.kereszt_vagas_fee}
              helperText={errors.kereszt_vagas_fee || 'Ft (bruttó, fix díj)'}
              inputProps={{ min: 0, step: 1 }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Hosszanti vágás méterenként (Bruttó)"
              type="number"
              value={grossPrices.hosszanti_vagas_fee_per_meter_gross}
              onChange={(e) => handleGrossPriceChange('hosszanti_vagas_fee_per_meter_gross', parseFloat(e.target.value) || 0)}
              required
              error={!!errors.hosszanti_vagas_fee_per_meter}
              helperText={errors.hosszanti_vagas_fee_per_meter || 'Ft/m (bruttó)'}
              inputProps={{ min: 0, step: 1 }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Íves vágás (Bruttó)"
              type="number"
              value={grossPrices.ives_vagas_fee_gross}
              onChange={(e) => handleGrossPriceChange('ives_vagas_fee_gross', parseFloat(e.target.value) || 0)}
              required
              error={!!errors.ives_vagas_fee}
              helperText={errors.ives_vagas_fee || 'Ft (bruttó, lekerekítésenként)'}
              inputProps={{ min: 0, step: 1 }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Szögvágás (Bruttó)"
              type="number"
              value={grossPrices.szogvagas_fee_gross}
              onChange={(e) => handleGrossPriceChange('szogvagas_fee_gross', parseFloat(e.target.value) || 0)}
              required
              error={!!errors.szogvagas_fee}
              helperText={errors.szogvagas_fee || 'Ft (bruttó, csoportonként)'}
              inputProps={{ min: 0, step: 1 }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Kivágás (Bruttó)"
              type="number"
              value={grossPrices.kivagas_fee_gross}
              onChange={(e) => handleGrossPriceChange('kivagas_fee_gross', parseFloat(e.target.value) || 0)}
              required
              error={!!errors.kivagas_fee}
              helperText={errors.kivagas_fee || 'Ft (bruttó, kivágásonként)'}
              inputProps={{ min: 0, step: 1 }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Élzáró méterenként (Bruttó)"
              type="number"
              value={grossPrices.elzaro_fee_per_meter_gross}
              onChange={(e) => handleGrossPriceChange('elzaro_fee_per_meter_gross', parseFloat(e.target.value) || 0)}
              required
              error={!!errors.elzaro_fee_per_meter}
              helperText={errors.elzaro_fee_per_meter || 'Ft/m (bruttó)'}
              inputProps={{ min: 0, step: 1 }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Összemarás (Bruttó)"
              type="number"
              value={grossPrices.osszemaras_fee_gross}
              onChange={(e) => handleGrossPriceChange('osszemaras_fee_gross', parseFloat(e.target.value) || 0)}
              required
              error={!!errors.osszemaras_fee}
              helperText={errors.osszemaras_fee || 'Ft (bruttó, fix díj)'}
              inputProps={{ min: 0, step: 1 }}
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
              value={formData.created_at ? new Date(formData.created_at).toLocaleDateString('hu-HU') : '-'}
              InputProps={{ readOnly: true }}
              variant="filled"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Utolsó módosítás"
              value={formData.updated_at ? new Date(formData.updated_at).toLocaleDateString('hu-HU') : '-'}
              InputProps={{ readOnly: true }}
              variant="filled"
            />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}
