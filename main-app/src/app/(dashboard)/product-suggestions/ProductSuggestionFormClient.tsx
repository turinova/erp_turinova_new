'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box, Breadcrumbs, Button, FormControl, InputLabel, Link, MenuItem, Paper, Select, Stack, TextField, Typography, Grid, CircularProgress
} from '@mui/material'
import { Home as HomeIcon, Save as SaveIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'
import NextLink from 'next/link'
import { usePagePermission } from '@/hooks/usePagePermission'

type VatRate = { id: string; name?: string; kulcs: number }
type Currency = { id: string; name: string }
type Unit = { id: string; name: string; shortform: string }
type Partner = { id: string; name: string }

interface ProductSuggestionFormClientProps {
  initialData: any
  vatRates: VatRate[]
  currencies: Currency[]
  units: Unit[]
  partners: Partner[]
}

export default function ProductSuggestionFormClient({
  initialData,
  vatRates,
  currencies,
  units,
  partners
}: ProductSuggestionFormClientProps) {
  const router = useRouter()
  const { hasAccess, loading } = usePagePermission('/product-suggestions')

  const [form, setForm] = useState({
    raw_product_name: initialData.raw_product_name || '',
    raw_sku: initialData.raw_sku || '',
    raw_base_price: initialData.raw_base_price || 0,
    raw_multiplier: initialData.raw_multiplier || 1.38,
    raw_quantity: initialData.raw_quantity || 1,
    raw_units_id: initialData.raw_units_id || '',
    raw_partner_id: initialData.raw_partner_id || '',
    raw_vat_id: initialData.raw_vat_id || '',
    raw_currency_id: initialData.raw_currency_id || '',
    admin_note: initialData.admin_note || ''
  })

  useEffect(() => {
    if (!loading && !hasAccess) {
      toast.error('Nincs jogosultsága a Termék javaslatok oldal megtekintéséhez!', {
        position: 'top-right'
      })
      router.push('/home')
    }
  }, [hasAccess, loading, router])

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const [loadingSave, setLoadingSave] = useState(false)
  const [computedNet, setComputedNet] = useState<number>(0)
  const [computedGross, setComputedGross] = useState<number>(0)
  const selectedVatPercent = useMemo(() => {
    const v = vatRates.find(v => v.id === form.raw_vat_id)
    return v?.kulcs ?? 0
  }, [form.raw_vat_id, vatRates])

  useEffect(() => {
    const net = Math.round((form.raw_base_price || 0) * (form.raw_multiplier || 0))
    setComputedNet(net)
  }, [form.raw_base_price, form.raw_multiplier])

  useEffect(() => {
    const gross = Math.round(computedNet * (1 + (selectedVatPercent / 100)))
    setComputedGross(gross)
  }, [computedNet, selectedVatPercent])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

  const handleSave = async () => {
    try {
      setLoadingSave(true)
      const res = await fetch(`/api/product-suggestions/${initialData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Mentés sikertelen')
      toast.success('Javaslat frissítve')
    } catch (e) {
      console.error(e)
      toast.error('Hiba történt a mentés során')
    } finally {
      setLoadingSave(false)
    }
  }

  // Approve action intentionally removed from UI as requested

  if (loading || !hasAccess) return null

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link
          component={NextLink}
          underline="hover"
          color="inherit"
          href="/home"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary">Termék javaslatok</Typography>
      </Breadcrumbs>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 3 }}>
          Termék javaslat szerkesztése
        </Typography>
        <Grid container spacing={3}>
          {/* Row 1: Partner, Termék neve, SKU */}
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Partner</InputLabel>
              <Select
                value={form.raw_partner_id}
                onChange={(e) => handleChange('raw_partner_id', e.target.value)}
                label="Partner"
                required
              >
                {partners.map((partner) => (
                  <MenuItem key={partner.id} value={partner.id}>
                    {partner.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Termék neve"
              value={form.raw_product_name}
              onChange={(e) => handleChange('raw_product_name', e.target.value)}
              required
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="SKU"
              value={form.raw_sku}
              onChange={(e) => handleChange('raw_sku', e.target.value)}
              helperText="Egyedi termékszám"
              required
            />
          </Grid>

          {/* Row 2: Beszerzési ár, Árrés szorzó, ÁFA, Pénznem, Mértékegység */}
          <Grid item xs={12} md={2.4}>
            <TextField
              fullWidth
              label="Beszerzési ár (Ft)"
              type="number"
              value={form.raw_base_price}
              onChange={(e) => handleChange('raw_base_price', parseFloat(e.target.value) || 0)}
              inputProps={{ min: 0, step: 1 }}
              helperText="Szorzó előtti beszerzési ár"
              required
            />
          </Grid>
          <Grid item xs={12} md={2.4}>
            <TextField
              fullWidth
              label="Árrés szorzó"
              type="number"
              value={form.raw_multiplier}
              onChange={(e) => handleChange('raw_multiplier', parseFloat(e.target.value) || 1.38)}
              inputProps={{ min: 1.0, max: 5.0, step: 0.01 }}
              helperText="1.00 - 5.00 közötti érték"
              required
            />
          </Grid>
          <Grid item xs={12} md={2.4}>
            <FormControl fullWidth>
              <InputLabel>ÁFA *</InputLabel>
              <Select
                value={form.raw_vat_id}
                onChange={(e) => handleChange('raw_vat_id', e.target.value)}
                label="ÁFA *"
                required
              >
                {vatRates.map((vat) => (
                  <MenuItem key={vat.id} value={vat.id}>
                    {vat.kulcs}%
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2.4}>
            <FormControl fullWidth>
              <InputLabel>Pénznem *</InputLabel>
              <Select
                value={form.raw_currency_id}
                onChange={(e) => handleChange('raw_currency_id', e.target.value)}
                label="Pénznem *"
                required
              >
                {currencies.map((currency) => (
                  <MenuItem key={currency.id} value={currency.id}>
                    {currency.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2.4}>
            <FormControl fullWidth>
              <InputLabel>Mértékegység *</InputLabel>
              <Select
                value={form.raw_units_id}
                onChange={(e) => handleChange('raw_units_id', e.target.value)}
                label="Mértékegység *"
                required
              >
                {units.map((unit) => (
                  <MenuItem key={unit.id} value={unit.id}>
                    {unit.name} ({unit.shortform})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Price Calculation Display */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="h6" gutterBottom>
                Ár számítás
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <Typography variant="body2" color="text.secondary">
                    Beszerzési ár:
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(form.raw_base_price || 0)}
                  </Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="body2" color="text.secondary">
                    Árrés szorzó:
                  </Typography>
                  <Typography variant="h6" color="info.main">
                    {form.raw_multiplier}x
                  </Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="body2" color="text.secondary">
                    Nettó ár:
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(computedNet)}
                  </Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="body2" color="text.secondary">
                    Bruttó ár:
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    {formatCurrency(computedGross)}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Admin note */}
          <Grid item xs={12}>
            <TextField
              label="Megjegyzés (admin)"
              value={form.admin_note}
              onChange={(e) => handleChange('admin_note', e.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
          </Grid>

          {/* Actions */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => router.back()}
              >
                Vissza
              </Button>
              <Button
                variant="contained"
                startIcon={loadingSave ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={async () => {
                  // Basic required validation
                  if (!form.raw_product_name?.trim() || !form.raw_sku?.trim() || !form.raw_base_price || !form.raw_multiplier || !form.raw_vat_id || !form.raw_currency_id || !form.raw_units_id || !form.raw_partner_id) {
                    toast.error('Minden mező kitöltése kötelező')
                    return
                  }
                  // SKU uniqueness check
                  try {
                    const resp = await fetch(`/api/accessories/validate-sku?sku=${encodeURIComponent(form.raw_sku.trim())}`)
                    const data = await resp.json()
                    if (!resp.ok || !data.ok) {
                      toast.error('Nem sikerült ellenőrizni az SKU egyediségét')
                      return
                    }
                    if (!data.unique) {
                      toast.error('Ez az SKU már létezik a termékek között')
                      return
                    }
                  } catch {
                    toast.error('Nem sikerült ellenőrizni az SKU egyediségét')
                    return
                  }
                  await handleSave()
                }}
                disabled={loadingSave}
              >
                {loadingSave ? 'Mentés...' : 'Mentés'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}


