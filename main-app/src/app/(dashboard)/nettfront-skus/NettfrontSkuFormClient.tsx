'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Paper,
  Button,
  TextField,
  MenuItem,
  FormControlLabel,
  Switch,
  CircularProgress,
  Divider
} from '@mui/material'
import {
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon
} from '@mui/icons-material'
import { toast } from 'react-toastify'

import {
  NETTFRONT_FINISHES,
  NETTFRONT_FRONT_TYPES,
  sellGrossFromNet,
  type NettfrontSkuFormData
} from '@/lib/nettfront-sku-constants'

const emptyForm: NettfrontSkuFormData = {
  front_type: 'inomat',
  sku_code: '',
  display_name: '',
  finish: 'matt',
  swatch_hex: '#CCCCCC',
  cost_net_per_sqm: 25000,
  sell_net_per_sqm: 35000,
  is_active: true,
  sort_order: 0
}

export default function NettfrontSkuFormClient({
  initialSku,
  isEdit
}: {
  initialSku: NettfrontSkuFormData | null
  isEdit: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<NettfrontSkuFormData>(initialSku || emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  const grossSell = useMemo(
    () => sellGrossFromNet(Number(form.sell_net_per_sqm) || 0),
    [form.sell_net_per_sqm]
  )

  const setField = <K extends keyof NettfrontSkuFormData>(
    field: K,
    value: NettfrontSkuFormData[K]
  ) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.sku_code.trim()) next.sku_code = 'Kötelező'
    if (!form.display_name.trim()) next.display_name = 'Kötelező'
    if (!form.front_type) next.front_type = 'Kötelező'
    if (
      form.swatch_hex &&
      form.swatch_hex.trim() &&
      !/^#[0-9A-Fa-f]{6}$/.test(form.swatch_hex.trim())
    ) {
      next.swatch_hex = 'Formátum: #RRGGBB'
    }
    if (form.cost_net_per_sqm < 0 || Number.isNaN(form.cost_net_per_sqm)) {
      next.cost_net_per_sqm = 'Érvénytelen'
    }
    if (form.sell_net_per_sqm < 0 || Number.isNaN(form.sell_net_per_sqm)) {
      next.sell_net_per_sqm = 'Érvénytelen'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setIsSaving(true)
    try {
      const url = isEdit ? `/api/nettfront-skus/${form.id}` : '/api/nettfront-skus'
      const method = isEdit ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          front_type: form.front_type,
          sku_code: form.sku_code.trim(),
          display_name: form.display_name.trim(),
          finish: form.finish || null,
          swatch_hex: form.swatch_hex?.trim() || null,
          cost_net_per_sqm: Number(form.cost_net_per_sqm),
          sell_net_per_sqm: Number(form.sell_net_per_sqm),
          is_active: form.is_active,
          sort_order: Number(form.sort_order) || 0
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Mentés sikertelen')
      }
      toast.success(isEdit ? 'Mentve' : 'Létrehozva')
      if (isEdit) {
        router.refresh()
      } else {
        router.push(`/nettfront-skus/${data.id}/edit`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mentés sikertelen')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Link underline="hover" color="inherit" href="/nettfront-skus">
          Nettfront anyagok
        </Link>
        <Typography color="text.primary">
          {isEdit ? form.display_name || 'Szerkesztés' : 'Új anyag'}
        </Typography>
      </Breadcrumbs>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        <Typography variant="h4" component="h1">
          {isEdit ? 'Nettfront anyag szerkesztése' : 'Új Nettfront anyag'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Mentés...' : 'Mentés'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/nettfront-skus')}
          >
            Vissza
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 3, width: '100%' }}>
        <Typography variant="h6" gutterBottom color="primary">
          Alapadatok
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
            width: '100%'
          }}
        >
          <TextField
            select
            fullWidth
            label="Front típus"
            value={form.front_type}
            onChange={e => setField('front_type', e.target.value)}
            error={!!errors.front_type}
            helperText={errors.front_type}
          >
            {NETTFRONT_FRONT_TYPES.map(t => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            fullWidth
            label="Finish"
            value={form.finish || ''}
            onChange={e => setField('finish', e.target.value || null)}
          >
            <MenuItem value="">—</MenuItem>
            {NETTFRONT_FINISHES.map(f => (
              <MenuItem key={f.value} value={f.value}>
                {f.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            label="SKU kód"
            value={form.sku_code}
            onChange={e => setField('sku_code', e.target.value)}
            error={!!errors.sku_code}
            helperText={errors.sku_code || 'pl. dune-beige'}
          />

          <TextField
            fullWidth
            label="Megjelenő név"
            value={form.display_name}
            onChange={e => setField('display_name', e.target.value)}
            error={!!errors.display_name}
            helperText={errors.display_name}
          />

          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', width: '100%' }}>
            <TextField
              fullWidth
              label="Swatch hex"
              value={form.swatch_hex || ''}
              onChange={e => setField('swatch_hex', e.target.value)}
              error={!!errors.swatch_hex}
              helperText={errors.swatch_hex || '#RRGGBB'}
            />
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: form.swatch_hex || '#eee',
                flexShrink: 0,
                mt: 0.5
              }}
            />
          </Box>

          <TextField
            fullWidth
            type="number"
            label="Sorrend"
            value={form.sort_order}
            onChange={e => setField('sort_order', Number(e.target.value) || 0)}
          />
        </Box>

        <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 4 }}>
          Árazás
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
            gap: 3,
            width: '100%'
          }}
        >
          <TextField
            fullWidth
            type="number"
            label="Bekerülés nettó Ft/m²"
            value={form.cost_net_per_sqm}
            onChange={e => setField('cost_net_per_sqm', Number(e.target.value))}
            error={!!errors.cost_net_per_sqm}
            helperText={errors.cost_net_per_sqm}
          />
          <TextField
            fullWidth
            type="number"
            label="Eladás nettó Ft/m²"
            value={form.sell_net_per_sqm}
            onChange={e => setField('sell_net_per_sqm', Number(e.target.value))}
            error={!!errors.sell_net_per_sqm}
            helperText={errors.sell_net_per_sqm}
          />
          <TextField
            fullWidth
            label="Eladás bruttó Ft/m²"
            value={grossSell}
            slotProps={{ input: { readOnly: true } }}
            helperText="Számított (ÁFA 27%)"
          />
        </Box>

        <Box sx={{ mt: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={form.is_active}
                onChange={e => setField('is_active', e.target.checked)}
              />
            }
            label="Aktív (látszik a Fronttervezőben)"
          />
        </Box>
      </Paper>
    </Box>
  )
}
