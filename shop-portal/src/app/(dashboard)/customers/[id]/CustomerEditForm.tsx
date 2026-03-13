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
  FormControl,
  InputLabel,
  Select,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel
} from '@mui/material'
import { Save as SaveIcon, Info as InfoIcon, Person as PersonIcon, Business as BusinessIcon, Sync as SyncIcon, Refresh as RefreshIcon, CloudSync as CloudSyncIcon, Receipt as ReceiptIcon } from '@mui/icons-material'
import Tooltip from '@mui/material/Tooltip'
import { toast } from 'react-toastify'
import { CircularProgress } from '@mui/material'
import CustomerAddressesCard from '@/components/customers/CustomerAddressesCard'
import CustomerBankAccountsCard from '@/components/customers/CustomerBankAccountsCard'

interface Customer {
  id: string
  entity_type: 'person' | 'company'
  name: string
  email: string | null
  telephone: string | null
  website: string | null
  identifier: string | null
  source: 'local' | 'webshop_sync'
  customer_group_id: string | null
  is_active: boolean
  firstname: string | null
  lastname: string | null
  tax_number: string | null
  eu_tax_number: string | null
  group_tax_number: string | null
  company_registration_number: string | null
  notes: string | null
  addresses: any[]
  bank_accounts: any[]
  platform_mappings: any[]
  customer_groups: {
    id: string
    name: string
  } | null
}

interface CustomerEditFormProps {
  initialCustomer: Customer
  customerGroups: Array<{ id: string; name: string }>
  currencies: Array<{ id: string; code: string; name: string; symbol: string }>
}

export default function CustomerEditForm({ initialCustomer, customerGroups, currencies }: CustomerEditFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [formData, setFormData] = useState({
    entity_type: initialCustomer.entity_type || 'person',
    name: initialCustomer.name || '',
    email: initialCustomer.email || '',
    telephone: initialCustomer.telephone || '',
    website: initialCustomer.website || '',
    identifier: initialCustomer.identifier || '',
    customer_group_id: initialCustomer.customer_group_id || '',
    is_active: initialCustomer.is_active !== false,
    notes: initialCustomer.notes || '',
    // Person-specific
    firstname: initialCustomer.firstname || '',
    lastname: initialCustomer.lastname || '',
    // Company-specific
    tax_number: initialCustomer.tax_number || '',
    eu_tax_number: initialCustomer.eu_tax_number || '',
    group_tax_number: initialCustomer.group_tax_number || '',
    company_registration_number: initialCustomer.company_registration_number || ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const initialStateRef = useRef<typeof formData | null>(null)

  // Initialize initial state once
  useEffect(() => {
    if (!initialStateRef.current) {
      const timer = setTimeout(() => {
        initialStateRef.current = { ...formData }
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
    const changed = !deepEqual(formData, initialStateRef.current)
    setHasUnsavedChanges(changed)
  }, [formData])

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

  // Intercept link clicks
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a[href]') as HTMLAnchorElement
      
      if (link && link.href) {
        const url = new URL(link.href)
        if (url.origin === window.location.origin) {
          const pathname = url.pathname
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
    // Trigger refresh to reload addresses and bank accounts
    setRefreshKey(prev => prev + 1)
    router.refresh()
  }

  const handleSyncToShopRenter = async () => {
    setSyncing(true)
    try {
      const response = await fetch(`/api/customers/${initialCustomer.id}/sync`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Hiba a szinkronizálás során')
      }

      toast.success(data.message || 'Vevő sikeresen szinkronizálva ShopRenter-be')
      router.refresh()
    } catch (error) {
      console.error('Error syncing customer:', error)
      toast.error(
        `Hiba a szinkronizálás során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setSyncing(false)
    }
  }

  const handlePullFromShopRenter = async () => {
    // Find active ShopRenter connection
    const activeMapping = initialCustomer.platform_mappings?.find((m: any) => 
      m.webshop_connections && 
      m.webshop_connections.connection_type === 'shoprenter' &&
      m.webshop_connections.is_active
    )

    if (!activeMapping || !activeMapping.webshop_connections) {
      toast.error('Nincs aktív ShopRenter kapcsolat ehhez a vevőhöz')
      return
    }

    setPulling(true)
    try {
      // Pull from ShopRenter connection
      const response = await fetch(`/api/connections/${activeMapping.connection_id}/sync-customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: true })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Hiba a frissítés során')
      }

      toast.success('Vevő sikeresen frissítve ShopRenter-ből')
      router.refresh()
    } catch (error) {
      console.error('Error pulling customer:', error)
      toast.error(
        `Hiba a frissítés során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      )
    } finally {
      setPulling(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'A név kötelező'
    }

    if (formData.entity_type === 'person') {
      if (!formData.firstname.trim()) {
        newErrors.firstname = 'A keresztnév kötelező személyeknél'
      }
      if (!formData.lastname.trim()) {
        newErrors.lastname = 'A vezetéknév kötelező személyeknél'
      }
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
      // Build name for person type
      let name = formData.name.trim()
      if (formData.entity_type === 'person' && formData.firstname && formData.lastname) {
        name = `${formData.lastname.trim()} ${formData.firstname.trim()}`
      }

      const response = await fetch(`/api/customers/${initialCustomer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          entity_type: formData.entity_type,
          name,
          email: formData.email.trim() || null,
          telephone: formData.telephone.trim() || null,
          website: formData.website.trim() || null,
          identifier: formData.identifier.trim() || null,
          customer_group_id: formData.customer_group_id || null,
          is_active: formData.is_active,
          firstname: formData.entity_type === 'person' ? formData.firstname.trim() : null,
          lastname: formData.entity_type === 'person' ? formData.lastname.trim() : null,
          // Tax numbers - allow for both person and company
          tax_number: formData.tax_number?.trim() || null,
          eu_tax_number: formData.entity_type === 'company' ? formData.eu_tax_number?.trim() || null : null,
          group_tax_number: formData.entity_type === 'company' ? formData.group_tax_number?.trim() || null : null,
          company_registration_number: formData.entity_type === 'company' ? formData.company_registration_number?.trim() || null : null,
          notes: formData.notes.trim() || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      toast.success('Vevő sikeresen frissítve')
      setHasUnsavedChanges(false)
      if (initialStateRef.current) {
        initialStateRef.current = { ...formData }
      }
      router.refresh()
    } catch (error) {
      console.error('Error saving customer:', error)
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
            {initialCustomer.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              icon={initialCustomer.entity_type === 'person' ? <PersonIcon /> : <BusinessIcon />}
              label={initialCustomer.entity_type === 'person' ? 'Személy' : 'Cég'}
              size="small"
              sx={{
                bgcolor: initialCustomer.entity_type === 'person' ? '#2196f3' : '#ff9800',
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }}
            />
            <Chip
              label={initialCustomer.is_active ? 'Aktív' : 'Inaktív'}
              size="small"
              sx={{
                ...(initialCustomer.is_active 
                  ? { bgcolor: '#4caf50', color: 'white' }
                  : { bgcolor: '#f44336', color: 'white' }
                )
              }}
            />
            {initialCustomer.source === 'webshop_sync' && (
              <Chip
                label="Webshop-ból szinkronizált"
                size="small"
                sx={{ bgcolor: '#9c27b0', color: 'white' }}
              />
            )}
            {initialCustomer.customer_groups && (
              <Chip
                label={initialCustomer.customer_groups.name}
                size="small"
                sx={{ bgcolor: '#757575', color: 'white' }}
              />
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {hasUnsavedChanges && (
            <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 500 }}>
              Mentetlen változások
            </Typography>
          )}
          {(() => {
            const activeMapping = initialCustomer.platform_mappings?.find((m: any) => 
              m.webshop_connections && 
              m.webshop_connections.connection_type === 'shoprenter' &&
              m.webshop_connections.is_active
            )
            const connectionName = activeMapping?.webshop_connections?.name || 'webshop'

            if (activeMapping) {
              return (
                <>
                  <Button
                    variant="outlined"
                    color="info"
                    startIcon={pulling ? <CircularProgress size={20} /> : <RefreshIcon />}
                    onClick={handlePullFromShopRenter}
                    disabled={pulling || syncing}
                    title={`Frissítés ${connectionName}-ből (lekéri a legfrissebb adatokat)`}
                  >
                    {pulling ? 'Frissítés...' : `Frissítés ${connectionName}-ből`}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
                    onClick={handleSyncToShopRenter}
                    disabled={syncing || pulling}
                    title={`Szinkronizálás ${connectionName}-be (elküldi a helyi változtatásokat)`}
                    color="primary"
                  >
                    {syncing ? 'Szinkronizálás...' : 'Szinkronizálás'}
                  </Button>
                </>
              )
            }
            return null
          })()}
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, position: 'relative', zIndex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
              {initialCustomer.source === 'webshop_sync' && (
                <Tooltip title="Ezek a mezők webshop-ból szinkronizálva vannak. Módosításuk a webshop-ba is szinkronizálódik, ha a 'Szinkronizálás' gombra kattintasz.">
                  <Chip
                    icon={<CloudSyncIcon />}
                    label="Webshop szinkronizált"
                    size="small"
                    sx={{ bgcolor: '#9c27b0', color: 'white', '& .MuiChip-icon': { color: 'white' } }}
                  />
                </Tooltip>
              )}
            </Box>

            {/* Info Alert for synced customers */}
            {initialCustomer.source === 'webshop_sync' && (
              <Alert 
                severity="info" 
                icon={<InfoIcon />}
                sx={{ mb: 3 }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Webshop-ból szinkronizált vevő
                </Typography>
                <Typography variant="body2">
                  Az alapadatok (név, e-mail, telefon) webshop-ból érkeznek, de szerkeszthetők. 
                  A változtatások a "Szinkronizálás" gombra kattintva visszakerülnek a webshop-ba.
                  A számlázási adatok (adószám, stb.) csak az ERP-ben tárolódnak és nem szinkronizálódnak.
                </Typography>
              </Alert>
            )}

            {/* Entity Type Selection (only if source is local) */}
            {initialCustomer.source === 'local' && (
              <Box sx={{ mb: 3 }}>
                <FormControl component="fieldset">
                  <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600 }}>
                    Típus *
                  </FormLabel>
                  <RadioGroup
                    row
                    value={formData.entity_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, entity_type: e.target.value as 'person' | 'company' }))}
                  >
                    <FormControlLabel
                      value="person"
                      control={<Radio />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PersonIcon fontSize="small" />
                          <Typography>Személy</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="company"
                      control={<Radio />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BusinessIcon fontSize="small" />
                          <Typography>Cég</Typography>
                        </Box>
                      }
                    />
                  </RadioGroup>
                </FormControl>
              </Box>
            )}

            <Grid container spacing={2}>
              {formData.entity_type === 'person' ? (
                <>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        label="Keresztnév *"
                        value={formData.firstname}
                        onChange={(e) => setFormData(prev => ({ ...prev, firstname: e.target.value }))}
                        fullWidth
                        required
                        error={!!errors.firstname}
                        helperText={errors.firstname}
                      />
                      {initialCustomer.source === 'webshop_sync' && (
                        <Tooltip title="Webshop-ból szinkronizált mező">
                          <CloudSyncIcon sx={{ color: '#9c27b0', fontSize: '20px', mt: 2 }} />
                        </Tooltip>
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        label="Vezetéknév *"
                        value={formData.lastname}
                        onChange={(e) => setFormData(prev => ({ ...prev, lastname: e.target.value }))}
                        fullWidth
                        required
                        error={!!errors.lastname}
                        helperText={errors.lastname}
                      />
                      {initialCustomer.source === 'webshop_sync' && (
                        <Tooltip title="Webshop-ból szinkronizált mező">
                          <CloudSyncIcon sx={{ color: '#9c27b0', fontSize: '20px', mt: 2 }} />
                        </Tooltip>
                      )}
                    </Box>
                  </Grid>
                </>
              ) : (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      label="Cég neve *"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      fullWidth
                      required
                      error={!!errors.name}
                      helperText={errors.name}
                    />
                    {initialCustomer.source === 'webshop_sync' && (
                      <Tooltip title="Webshop-ból szinkronizált mező">
                        <CloudSyncIcon sx={{ color: '#9c27b0', fontSize: '20px', mt: 2 }} />
                      </Tooltip>
                    )}
                  </Box>
                </Grid>
              )}

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    label="E-mail cím"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    fullWidth
                  />
                  {initialCustomer.source === 'webshop_sync' && (
                    <Tooltip title="Webshop-ból szinkronizált mező">
                      <CloudSyncIcon sx={{ color: '#9c27b0', fontSize: '20px', mt: 2 }} />
                    </Tooltip>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    label="Telefonszám"
                    value={formData.telephone}
                    onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                    fullWidth
                  />
                  {initialCustomer.source === 'webshop_sync' && (
                    <Tooltip title="Webshop-ból szinkronizált mező">
                      <CloudSyncIcon sx={{ color: '#9c27b0', fontSize: '20px', mt: 2 }} />
                    </Tooltip>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    label="Weboldal"
                    value={formData.website}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    fullWidth
                  />
                  {initialCustomer.source === 'webshop_sync' && (
                    <Tooltip title="Webshop-ból szinkronizált mező">
                      <CloudSyncIcon sx={{ color: '#9c27b0', fontSize: '20px', mt: 2 }} />
                    </Tooltip>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Azonosító (belső)"
                  value={formData.identifier}
                  onChange={(e) => setFormData(prev => ({ ...prev, identifier: e.target.value }))}
                  fullWidth
                  helperText="Opcionális, egyedi azonosító"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Vevőcsoport</InputLabel>
                  <Select
                    value={formData.customer_group_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_group_id: e.target.value }))}
                    label="Vevőcsoport"
                  >
                    <MenuItem value="">Nincs vevőcsoport</MenuItem>
                    {customerGroups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Státusz</InputLabel>
                  <Select
                    value={formData.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'active' }))}
                    label="Státusz"
                  >
                    <MenuItem value="active">Aktív</MenuItem>
                    <MenuItem value="inactive">Inaktív</MenuItem>
                  </Select>
                </FormControl>
              </Grid>


              <Grid item xs={12}>
                <TextField
                  label="Megjegyzések"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  fullWidth
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Billing Information Card - Always Editable */}
        <Grid item xs={12}>
          <Paper 
            elevation={0}
            sx={{ 
              p: 3,
              bgcolor: 'white',
              border: '2px solid',
              borderColor: '#ff9800',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
              <Box sx={{ 
                p: 1, 
                borderRadius: '50%', 
                bgcolor: '#ff9800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
              }}>
                <ReceiptIcon sx={{ color: 'white', fontSize: '24px' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#e65100' }}>
                Számlázási adatok
              </Typography>
            </Box>

            <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 3 }}>
              <Typography variant="body2">
                A számlázási adatok csak az ERP-ben tárolódnak és nem szinkronizálódnak a webshop-ba. 
                Ezek a mezők mindig szerkeszthetők.
              </Typography>
            </Alert>

            <Grid container spacing={2}>
              {/* Tax number for both person and company */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Adószám"
                  value={formData.tax_number || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, tax_number: e.target.value }))}
                  fullWidth
                  helperText={formData.entity_type === 'person' ? 'Személyeknél is megadható' : 'Cégeknél kötelező lehet'}
                />
              </Grid>
              
              {/* Company-specific fields */}
              {formData.entity_type === 'company' && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Közösségi adószám"
                      value={formData.eu_tax_number || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, eu_tax_number: e.target.value }))}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Csoportos adószám"
                      value={formData.group_tax_number || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, group_tax_number: e.target.value }))}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Cégjegyzékszám"
                      value={formData.company_registration_number || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, company_registration_number: e.target.value }))}
                      fullWidth
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* Addresses Card */}
        <Grid item xs={12}>
          <CustomerAddressesCard
            customerId={initialCustomer.id}
            initialAddresses={initialCustomer.addresses}
            onUpdate={handleUpdate}
            key={`addresses-${refreshKey}`}
          />
        </Grid>

        {/* Bank Accounts Card */}
        <Grid item xs={12}>
          <CustomerBankAccountsCard
            customerId={initialCustomer.id}
            initialBankAccounts={initialCustomer.bank_accounts}
            currencies={currencies}
            onUpdate={handleUpdate}
            key={`bank-accounts-${refreshKey}`}
          />
        </Grid>
      </Grid>

      {/* Unsaved Changes Dialog */}
      <Dialog open={showUnsavedDialog} onClose={() => setShowUnsavedDialog(false)}>
        <DialogTitle>Mentetlen változások</DialogTitle>
        <DialogContent>
          <Typography>
            Vannak mentetlen változások. Biztosan el szeretne navigálni?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUnsavedDialog(false)}>Mégse</Button>
          <Button
            onClick={() => {
              setShowUnsavedDialog(false)
              setHasUnsavedChanges(false)
              if (pendingNavigation) {
                router.push(pendingNavigation)
              }
            }}
            color="error"
            variant="contained"
          >
            Elvetés és navigálás
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
