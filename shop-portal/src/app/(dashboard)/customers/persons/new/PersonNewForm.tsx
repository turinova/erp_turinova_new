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
  Alert
} from '@mui/material'
import { Save as SaveIcon, Info as InfoIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

interface PersonNewFormProps {
  customerGroups: Array<{ id: string; name: string }>
}

export default function PersonNewForm({ customerGroups }: PersonNewFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    telephone: '',
    website: '',
    identifier: '',
    customer_group_id: '',
    is_active: true,
    tax_number: '',
    notes: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.firstname.trim()) {
      newErrors.firstname = 'A keresztnév kötelező'
    }
    if (!formData.lastname.trim()) {
      newErrors.lastname = 'A vezetéknév kötelező'
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
      const response = await fetch('/api/customers/persons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstname: formData.firstname.trim(),
          lastname: formData.lastname.trim(),
          email: formData.email.trim() || null,
          telephone: formData.telephone.trim() || null,
          website: formData.website.trim() || null,
          identifier: formData.identifier.trim() || null,
          source: 'local',
          customer_group_id: formData.customer_group_id || null,
          is_active: formData.is_active,
          tax_number: formData.tax_number.trim() || null,
          notes: formData.notes.trim() || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const { person } = await response.json()
      toast.success('Személy sikeresen létrehozva')
      router.push(`/customers/persons/${person.id}`)
    } catch (error) {
      console.error('Error creating person:', error)
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
            Új személy létrehozása
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Hozzon létre egy új személyt. Később hozzáadhat címeket, bankszámlákat és más adatokat.
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

            <Grid container spacing={2}>
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
              <Grid item xs={12} md={6}>
                <TextField
                  label="Adószám (egyéni vállalkozó)"
                  value={formData.tax_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, tax_number: e.target.value }))}
                  fullWidth
                  helperText="Csak akkor töltse ki, ha egyéni vállalkozó. Később cégkapcsolatot is hozzáadhat."
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
      </Grid>

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          A személy létrehozása után hozzáadhat címeket, bankszámlákat és más adatokat a részletek oldalon.
        </Typography>
      </Alert>
    </Box>
  )
}
