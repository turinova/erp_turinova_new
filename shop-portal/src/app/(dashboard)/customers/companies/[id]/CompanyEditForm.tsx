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
  Alert
} from '@mui/material'
import { Save as SaveIcon, Info as InfoIcon, Business as BusinessIcon, CloudSync as CloudSyncIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import CustomerAddressesCard from '@/components/customers/CustomerAddressesCard'
import CustomerBankAccountsCard from '@/components/customers/CustomerBankAccountsCard'
import CompanyPersonRelationshipsCard from '@/components/customers/CompanyPersonRelationshipsCard'

interface Company {
  id: string
  name: string
  email: string | null
  telephone: string | null
  website: string | null
  identifier: string | null
  source: 'local' | 'webshop_sync'
  customer_group_id: string | null
  is_active: boolean
  tax_number: string | null
  eu_tax_number: string | null
  group_tax_number: string | null
  company_registration_number: string | null
  notes: string | null
  addresses: any[]
  bank_accounts: any[]
  platform_mappings: any[]
  relationships: any[]
  customer_groups: {
    id: string
    name: string
  } | null
}

interface CompanyEditFormProps {
  initialCompany: Company
  customerGroups: Array<{ id: string; name: string }>
  currencies: Array<{ id: string; code: string; name: string; symbol: string }>
}

export default function CompanyEditForm({ initialCompany, customerGroups, currencies }: CompanyEditFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [formData, setFormData] = useState({
    name: initialCompany.name || '',
    email: initialCompany.email || '',
    telephone: initialCompany.telephone || '',
    website: initialCompany.website || '',
    identifier: initialCompany.identifier || '',
    customer_group_id: initialCompany.customer_group_id || '',
    is_active: initialCompany.is_active !== false,
    tax_number: initialCompany.tax_number || '',
    eu_tax_number: initialCompany.eu_tax_number || '',
    group_tax_number: initialCompany.group_tax_number || '',
    company_registration_number: initialCompany.company_registration_number || '',
    notes: initialCompany.notes || ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
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

  const handleUpdate = () => {
    setRefreshKey(prev => prev + 1)
    router.refresh()
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'A cég neve kötelező'
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
      const response = await fetch(`/api/customers/companies/${initialCompany.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          telephone: formData.telephone.trim() || null,
          website: formData.website.trim() || null,
          identifier: formData.identifier.trim() || null,
          customer_group_id: formData.customer_group_id || null,
          is_active: formData.is_active,
          tax_number: formData.tax_number?.trim() || null,
          eu_tax_number: formData.eu_tax_number?.trim() || null,
          group_tax_number: formData.group_tax_number?.trim() || null,
          company_registration_number: formData.company_registration_number?.trim() || null,
          notes: formData.notes.trim() || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      toast.success('Cég sikeresen frissítve')
      setHasUnsavedChanges(false)
      if (initialStateRef.current) {
        initialStateRef.current = { ...formData }
      }
      router.refresh()
    } catch (error) {
      console.error('Error saving company:', error)
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
            {initialCompany.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              icon={<BusinessIcon />}
              label="Cég"
              size="small"
              sx={{
                bgcolor: '#ff9800',
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }}
            />
            <Chip
              label={initialCompany.is_active ? 'Aktív' : 'Inaktív'}
              size="small"
              sx={{
                ...(initialCompany.is_active 
                  ? { bgcolor: '#4caf50', color: 'white' }
                  : { bgcolor: '#f44336', color: 'white' }
                )
              }}
            />
            {initialCompany.source === 'webshop_sync' && (
              <Chip
                label="Webshop-ból szinkronizált"
                size="small"
                sx={{ bgcolor: '#9c27b0', color: 'white' }}
              />
            )}
            {initialCompany.customer_groups && (
              <Chip
                label={initialCompany.customer_groups.name}
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
        {/* Basic Information Section */}
        <Grid item xs={12}>
          <Paper 
            elevation={0}
            sx={{ 
              p: 3,
              bgcolor: 'white',
              border: '2px solid',
              borderColor: '#2196f3',
              borderRadius: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
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

            {initialCompany.source === 'webshop_sync' && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  Az alapadatok webshop-ból érkeznek, de szerkeszthetők. A számlázási adatok (adószámok) csak az ERP-ben tárolódnak.
                </Typography>
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Cég neve *"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  fullWidth
                  required
                  error={!!errors.name}
                  helperText={errors.name}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="E-mail cím"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Telefonszám"
                  value={formData.telephone}
                  onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Weboldal"
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Azonosító (belső)"
                  value={formData.identifier}
                  onChange={(e) => setFormData(prev => ({ ...prev, identifier: e.target.value }))}
                  fullWidth
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
                <TextField
                  label="Adószám"
                  value={formData.tax_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, tax_number: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Közösségi adószám"
                  value={formData.eu_tax_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, eu_tax_number: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Csoportos adószám"
                  value={formData.group_tax_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, group_tax_number: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Cégjegyzékszám"
                  value={formData.company_registration_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, company_registration_number: e.target.value }))}
                  fullWidth
                />
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

        {/* Addresses Card */}
        <Grid item xs={12}>
          <CustomerAddressesCard
            customerId={initialCompany.id}
            initialAddresses={initialCompany.addresses}
            onUpdate={handleUpdate}
            entityType="company"
          />
        </Grid>

        {/* Bank Accounts Card */}
        <Grid item xs={12}>
          <CustomerBankAccountsCard
            customerId={initialCompany.id}
            initialBankAccounts={initialCompany.bank_accounts}
            currencies={currencies}
            onUpdate={handleUpdate}
            entityType="company"
          />
        </Grid>

        {/* Person Relationships Card */}
        <Grid item xs={12}>
          <CompanyPersonRelationshipsCard
            companyId={initialCompany.id}
            initialRelationships={initialCompany.relationships || []}
            onUpdate={handleUpdate}
          />
        </Grid>
      </Grid>
    </Box>
  )
}
