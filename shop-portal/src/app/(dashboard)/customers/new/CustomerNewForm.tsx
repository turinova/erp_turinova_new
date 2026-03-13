'use client'

import React, { useState } from 'react'
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
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Alert
} from '@mui/material'
import { Save as SaveIcon, Info as InfoIcon, Person as PersonIcon, Business as BusinessIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

interface CustomerNewFormProps {
  customerGroups: Array<{ id: string; name: string }>
}

export default function CustomerNewForm({ customerGroups }: CustomerNewFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [entityType, setEntityType] = useState<'person' | 'company'>('person')
  
  const [formData, setFormData] = useState({
    // Common fields
    name: '',
    email: '',
    telephone: '',
    website: '',
    identifier: '',
    customer_group_id: '',
    is_active: true,
    notes: '',
    // Person-specific
    firstname: '',
    lastname: '',
    // Company-specific
    tax_number: '',
    eu_tax_number: '',
    group_tax_number: '',
    company_registration_number: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (entityType === 'person') {
      if (!formData.firstname.trim()) {
        newErrors.firstname = 'A keresztnév kötelező személyeknél'
      }
      if (!formData.lastname.trim()) {
        newErrors.lastname = 'A vezetéknév kötelező személyeknél'
      }
    } else {
      // Company type
      if (!formData.name.trim()) {
        newErrors.name = 'A cég neve kötelező'
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
      if (entityType === 'person' && formData.firstname && formData.lastname) {
        name = `${formData.lastname.trim()} ${formData.firstname.trim()}`
      }

      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          entity_type: entityType,
          name,
          email: formData.email.trim() || null,
          telephone: formData.telephone.trim() || null,
          website: formData.website.trim() || null,
          identifier: formData.identifier.trim() || null,
          source: 'local',
          customer_group_id: formData.customer_group_id || null,
          is_active: formData.is_active,
          firstname: entityType === 'person' ? formData.firstname.trim() : null,
          lastname: entityType === 'person' ? formData.lastname.trim() : null,
          tax_number: entityType === 'company' ? formData.tax_number.trim() || null : null,
          eu_tax_number: entityType === 'company' ? formData.eu_tax_number.trim() || null : null,
          group_tax_number: entityType === 'company' ? formData.group_tax_number.trim() || null : null,
          company_registration_number: entityType === 'company' ? formData.company_registration_number.trim() || null : null,
          notes: formData.notes.trim() || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const { customer } = await response.json()
      toast.success('Vevő sikeresen létrehozva')
      router.push(`/customers/${customer.id}`)
    } catch (error) {
      console.error('Error creating customer:', error)
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
            Új vevő létrehozása
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Hozzon létre egy új vevőt vagy céget. Később hozzáadhat címeket, bankszámlákat és más adatokat.
          </Typography>
        </Box>
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

            {/* Entity Type Selection */}
            <Box sx={{ mb: 3 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600 }}>
                  Típus *
                </FormLabel>
                <RadioGroup
                  row
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value as 'person' | 'company')}
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

            <Grid container spacing={2}>
              {entityType === 'person' ? (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Keresztnév *"
                      value={formData.firstname}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstname: e.target.value }))}
                      fullWidth
                      required
                      error={!!errors.firstname}
                      helperText={errors.firstname}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Vezetéknév *"
                      value={formData.lastname}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastname: e.target.value }))}
                      fullWidth
                      required
                      error={!!errors.lastname}
                      helperText={errors.lastname}
                    />
                  </Grid>
                </>
              ) : (
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
              )}

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

              {entityType === 'company' && (
                <>
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
                </>
              )}

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
      </Grid>

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          A vevő létrehozása után hozzáadhat címeket, bankszámlákat és más adatokat a részletek oldalon.
        </Typography>
      </Alert>
    </Box>
  )
}
