'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material'
import { Save as SaveIcon, Info as InfoIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import AddressesCard from '@/components/suppliers/AddressesCard'
import BankAccountsCard from '@/components/suppliers/BankAccountsCard'
import OrderChannelsCard from '@/components/suppliers/OrderChannelsCard'
import PaymentSettingsCard from '@/components/suppliers/PaymentSettingsCard'

interface Supplier {
  id: string
  name: string
  short_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  tax_number: string | null
  eu_tax_number: string | null
  note: string | null
  status: string
  addresses: any[]
  bank_accounts: any[]
  order_channels: any[]
}

interface SupplierEditFormProps {
  initialSupplier: Supplier
  vatRates: Array<{ id: string; name: string; rate: number }>
}

export default function SupplierEditForm({ initialSupplier, vatRates }: SupplierEditFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [formData, setFormData] = useState({
    name: initialSupplier.name || '',
    short_name: initialSupplier.short_name || '',
    email: initialSupplier.email || '',
    phone: initialSupplier.phone || '',
    website: initialSupplier.website || '',
    tax_number: initialSupplier.tax_number || '',
    eu_tax_number: initialSupplier.eu_tax_number || '',
    note: initialSupplier.note || '',
    status: initialSupplier.status || 'active'
  })
  const [paymentSettings, setPaymentSettings] = useState({
    default_payment_method_id: (initialSupplier as any).default_payment_method_id || null,
    default_payment_terms_days: (initialSupplier as any).default_payment_terms_days || null,
    default_vat_id: (initialSupplier as any).default_vat_id || null,
    default_currency_id: (initialSupplier as any).default_currency_id || null
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const initialStateRef = useRef<{
    formData: typeof formData
    paymentSettings: typeof paymentSettings
  } | null>(null)

  // Initialize initial state once (after component mounts)
  useEffect(() => {
    if (!initialStateRef.current) {
      // Use a small delay to ensure all state is initialized
      const timer = setTimeout(() => {
        initialStateRef.current = {
          formData: { ...formData },
          paymentSettings: { ...paymentSettings }
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const deepEqual = (a: any, b: any): boolean => {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  // Track changes
  useEffect(() => {
    if (!initialStateRef.current) return
    const current = {
      formData,
      paymentSettings
    }
    const initial = initialStateRef.current
    const changed = !deepEqual(current, initial)
    setHasUnsavedChanges(changed)
  }, [formData, paymentSettings])

  // Warn on browser/tab close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
    }
  }, [hasUnsavedChanges])

  // Handle navigation with unsaved changes check
  const handleNavigation = (url: string, e?: React.MouseEvent) => {
    if (hasUnsavedChanges) {
      e?.preventDefault()
      setPendingNavigation(url)
      setShowUnsavedDialog(true)
      return false
    }
    return true
  }

  // Intercept link clicks within the component
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a[href]') as HTMLAnchorElement
      
      if (link && link.href) {
        const url = new URL(link.href)
        // Only intercept internal navigation (same origin)
        if (url.origin === window.location.origin) {
          const pathname = url.pathname
          // Don't intercept if navigating to the same page
          if (pathname !== window.location.pathname) {
            e.preventDefault()
            setPendingNavigation(pathname)
            setShowUnsavedDialog(true)
          }
        }
      }
    }

    document.addEventListener('click', handleLinkClick, true)
    return () => document.removeEventListener('click', handleLinkClick, true)
  }, [hasUnsavedChanges])

  const handleUpdate = () => {
    // Trigger a refresh of the page data
    setRefreshKey(prev => prev + 1)
    router.refresh()
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'A beszállító neve kötelező'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/suppliers/${initialSupplier.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          short_name: formData.short_name.trim() || null,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          website: formData.website.trim() || null,
          tax_number: formData.tax_number.trim() || null,
          eu_tax_number: formData.eu_tax_number.trim() || null,
          note: formData.note.trim() || null,
          status: formData.status,
          ...paymentSettings
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      toast.success('Beszállító sikeresen frissítve')
      setHasUnsavedChanges(false)
      // Update initial state ref after successful save
      if (initialStateRef.current) {
        initialStateRef.current = {
          formData,
          paymentSettings
        }
      }
      // Refresh page data
      router.refresh()
    } catch (error) {
      console.error('Error saving supplier:', error)
      toast.error(
        `Hiba a mentés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: '#1565c0' }}>
            {initialSupplier.name}
          </Typography>
          <Chip
            label={initialSupplier.status === 'active' ? 'Aktív' : 'Inaktív'}
            size="small"
            sx={{ 
              fontWeight: 500,
              ...(initialSupplier.status === 'active' 
                ? { bgcolor: '#4caf50', color: 'white' }
                : { bgcolor: '#f44336', color: 'white' }
              )
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {hasUnsavedChanges && (
            <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 500 }}>
              Mentetlen változások
            </Typography>
          )}
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            sx={{
              bgcolor: '#2196f3',
              '&:hover': {
                bgcolor: '#1976d2'
              }
            }}
          >
            {saving ? 'Mentés...' : 'Mentés'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Basic Information Section - Blue Border */}
        <Grid item xs={12}>
          <Paper 
            elevation={0}
            sx={{ 
              p: 3,
              bgcolor: 'white',
              border: '2px solid',
              borderColor: '#2196f3',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
              <Box sx={{ 
                p: 1, 
                borderRadius: '50%', 
                bgcolor: '#2196f3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
              }}>
                <InfoIcon sx={{ color: 'white', fontSize: '24px' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0' }}>
                Alapadatok
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <TextField
                  label="Cég neve *"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  fullWidth
                  required
                  error={!!errors.name}
                  helperText={errors.name}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(0, 0, 0, 0.02)',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                      },
                      '&.Mui-focused': {
                        bgcolor: 'white'
                      }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Rövid név / Alias"
                  value={formData.short_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, short_name: e.target.value }))}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(0, 0, 0, 0.02)',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                      },
                      '&.Mui-focused': {
                        bgcolor: 'white'
                      }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="E-mail cím"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(0, 0, 0, 0.02)',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                      },
                      '&.Mui-focused': {
                        bgcolor: 'white'
                      }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Telefonszám"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(0, 0, 0, 0.02)',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                      },
                      '&.Mui-focused': {
                        bgcolor: 'white'
                      }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Weboldal"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(0, 0, 0, 0.02)',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                      },
                      '&.Mui-focused': {
                        bgcolor: 'white'
                      }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Adószám"
                  value={formData.tax_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, tax_number: e.target.value }))}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(0, 0, 0, 0.02)',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                      },
                      '&.Mui-focused': {
                        bgcolor: 'white'
                      }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Közösségi adószám"
                  value={formData.eu_tax_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, eu_tax_number: e.target.value }))}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(0, 0, 0, 0.02)',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                      },
                      '&.Mui-focused': {
                        bgcolor: 'white'
                      }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Státusz</InputLabel>
                  <Select
                    value={formData.status}
                    label="Státusz"
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    sx={{
                      bgcolor: 'rgba(0, 0, 0, 0.02)',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                      },
                      '&.Mui-focused': {
                        bgcolor: 'white'
                      }
                    }}
                  >
                    <MenuItem value="active">Aktív</MenuItem>
                    <MenuItem value="inactive">Inaktív</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Megjegyzés"
                  value={formData.note}
                  onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  fullWidth
                  multiline
                  rows={3}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(0, 0, 0, 0.02)',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                      },
                      '&.Mui-focused': {
                        bgcolor: 'white'
                      }
                    }
                  }}
                />
              </Grid>
              {/* Save buttons moved to header */}
            </Grid>
          </Paper>
        </Grid>

        {/* Payment Settings Card */}
        <Grid item xs={12}>
          <PaymentSettingsCard
            supplierId={initialSupplier.id}
            initialPaymentMethodId={paymentSettings.default_payment_method_id}
            initialPaymentTermsDays={paymentSettings.default_payment_terms_days}
            initialVatId={paymentSettings.default_vat_id}
            initialCurrencyId={paymentSettings.default_currency_id}
            vatRates={vatRates}
            onUpdate={(data) => setPaymentSettings(data)}
          />
        </Grid>

        {/* Addresses Card */}
        <Grid item xs={12}>
          <AddressesCard
            key={`addresses-${refreshKey}`}
            supplierId={initialSupplier.id}
            initialAddresses={initialSupplier.addresses}
            onUpdate={handleUpdate}
          />
        </Grid>

        {/* Bank Accounts Card */}
        <Grid item xs={12}>
          <BankAccountsCard
            key={`bank-accounts-${refreshKey}`}
            supplierId={initialSupplier.id}
            initialBankAccounts={initialSupplier.bank_accounts}
            onUpdate={handleUpdate}
          />
        </Grid>

        {/* Order Channels Card */}
        <Grid item xs={12}>
          <OrderChannelsCard
            key={`order-channels-${refreshKey}`}
            supplierId={initialSupplier.id}
            initialOrderChannels={initialSupplier.order_channels}
            onUpdate={handleUpdate}
          />
        </Grid>
      </Grid>
      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog
        open={showUnsavedDialog}
        onClose={() => {
          setShowUnsavedDialog(false)
          setPendingNavigation(null)
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: 'error.main',
          color: 'error.contrastText',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 2,
          px: 3,
          fontWeight: 600,
          fontSize: '1.25rem'
        }}>
          <InfoIcon sx={{ fontSize: 24 }} />
          Mentetlen változások
        </DialogTitle>
        <DialogContent sx={{ py: 3, px: 3 }}>
          <Typography variant="body1" sx={{ mb: 2, fontWeight: 500, color: 'text.primary', fontSize: '1rem' }}>
            Biztosan kilépsz erről az oldalról?
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, fontSize: '0.9375rem' }}>
            Vannak elmentetlen változások. Biztosan kilépsz az oldalról anélkül, hogy elmentenéd őket?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, px: 3, gap: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={() => {
              setShowUnsavedDialog(false)
              setPendingNavigation(null)
            }}
            variant="outlined"
            sx={{
              minWidth: 100,
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Maradok
          </Button>
          <Button 
            onClick={() => {
              // Discard changes and navigate
              setHasUnsavedChanges(false)
              setShowUnsavedDialog(false)
              if (pendingNavigation) {
                router.push(pendingNavigation)
              } else {
                router.push('/suppliers')
              }
              setPendingNavigation(null)
            }}
            variant="contained"
            color="error"
            sx={{
              minWidth: 100,
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Kilépés
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
