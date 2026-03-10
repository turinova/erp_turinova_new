'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material'
import { Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

interface SupplierNewFormProps {
  initialSupplier: null
  vatRates: Array<{ id: string; name: string; rate: number }>
}

export default function SupplierNewForm({ vatRates }: SupplierNewFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    email: '',
    phone: '',
    website: '',
    tax_number: '',
    eu_tax_number: '',
    note: '',
    status: 'active',
    default_vat_id: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

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
      const response = await fetch('/api/suppliers', {
        method: 'POST',
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
          status: formData.status
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba a mentés során')
      }

      const result = await response.json()
      toast.success('Beszállító sikeresen létrehozva')
      router.push(`/suppliers/${result.supplier.id}`)
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
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Új beszállító létrehozása
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Adja meg a beszállító alapvető adatait. További információkat (címek, banki adatok, rendelési csatornák) később adhat hozzá.
        </Typography>
      </Box>

      <Card elevation={2}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Cég neve *"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name}
            />

            <TextField
              label="Rövid név / Alias"
              value={formData.short_name}
              onChange={(e) => setFormData(prev => ({ ...prev, short_name: e.target.value }))}
              fullWidth
              helperText="Opcionális rövid név vagy alias"
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="E-mail cím"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                fullWidth
              />

              <TextField
                label="Telefonszám"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                fullWidth
              />
            </Box>

            <TextField
              label="Weboldal"
              type="url"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              fullWidth
              placeholder="https://example.com"
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Adószám"
                value={formData.tax_number}
                onChange={(e) => setFormData(prev => ({ ...prev, tax_number: e.target.value }))}
                fullWidth
              />

              <TextField
                label="Közösségi adószám"
                value={formData.eu_tax_number}
                onChange={(e) => setFormData(prev => ({ ...prev, eu_tax_number: e.target.value }))}
                fullWidth
              />
            </Box>

            <FormControl fullWidth>
              <InputLabel>Státusz</InputLabel>
              <Select
                value={formData.status}
                label="Státusz"
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              >
                <MenuItem value="active">Aktív</MenuItem>
                <MenuItem value="inactive">Inaktív</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Megjegyzés"
              value={formData.note}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
              fullWidth
              multiline
              rows={4}
              helperText="Opcionális megjegyzés a beszállítóról"
            />

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 2 }}>
              <Button
                variant="outlined"
                onClick={() => router.push('/suppliers')}
                disabled={saving}
              >
                Mégse
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Mentés...' : 'Létrehozás'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
