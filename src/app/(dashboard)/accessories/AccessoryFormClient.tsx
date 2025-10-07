'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Alert,
  CircularProgress,
  Grid
} from '@mui/material'
import { toast } from 'react-toastify'

interface AccessoryFormData {
  id?: string
  name: string
  sku: string
  net_price: number
  vat_id: string
  currency_id: string
  units_id: string
  partners_id: string
}

interface VatRate {
  id: string
  name: string
  kulcs: number
}

interface Currency {
  id: string
  name: string
}

interface Unit {
  id: string
  name: string
  shortform: string
}

interface Partner {
  id: string
  name: string
}

interface AccessoryFormClientProps {
  initialData?: AccessoryFormData
  vatRates: VatRate[]
  currencies: Currency[]
  units: Unit[]
  partners: Partner[]
}

export default function AccessoryFormClient({ 
  initialData, 
  vatRates, 
  currencies, 
  units, 
  partners 
}: AccessoryFormClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<AccessoryFormData>({
    name: '',
    sku: '',
    net_price: 0,
    vat_id: '',
    currency_id: '',
    units_id: '',
    partners_id: ''
  })

  const [calculatedPrices, setCalculatedPrices] = useState({
    vat_amount: 0,
    gross_price: 0
  })

  // Initialize form data if editing
  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    }
  }, [initialData])

  // Calculate prices when form data changes
  useEffect(() => {
    const selectedVat = vatRates.find(vat => vat.id === formData.vat_id)
    if (selectedVat && formData.net_price > 0) {
      const vatAmount = (formData.net_price * selectedVat.kulcs) / 100
      const grossPrice = formData.net_price + vatAmount
      
      setCalculatedPrices({
        vat_amount: vatAmount,
        gross_price: grossPrice
      })
    } else {
      setCalculatedPrices({
        vat_amount: 0,
        gross_price: formData.net_price
      })
    }
  }, [formData.net_price, formData.vat_id, vatRates])

  const handleInputChange = (field: keyof AccessoryFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    if (!formData.name.trim() || !formData.sku.trim() || formData.net_price <= 0 || 
        !formData.vat_id || !formData.currency_id || !formData.units_id || !formData.partners_id) {
      toast.error('Minden mező kitöltése kötelező', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
      return
    }

    setLoading(true)
    try {
      const url = initialData?.id ? `/api/accessories/${initialData.id}` : '/api/accessories'
      const method = initialData?.id ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(initialData?.id ? 'Termék sikeresen frissítve' : 'Termék sikeresen létrehozva', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        router.push('/accessories')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Hiba a mentés során', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
      }
    } catch (error) {
      console.error('Submit error:', error)
      toast.error('Hiba a mentés során', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {initialData?.id ? 'Termék szerkesztése' : 'Új termék'}
      </Typography>

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Name */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Termék neve"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                disabled={loading}
              />
            </Grid>

            {/* SKU */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="SKU"
                value={formData.sku}
                onChange={(e) => handleInputChange('sku', e.target.value)}
                required
                disabled={loading}
                helperText="Egyedi termékszám"
              />
            </Grid>

            {/* Net Price */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nettó ár"
                type="number"
                value={formData.net_price}
                onChange={(e) => handleInputChange('net_price', parseFloat(e.target.value) || 0)}
                required
                disabled={loading}
                inputProps={{ min: 0, step: 1 }}
              />
            </Grid>

            {/* VAT */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required disabled={loading}>
                <InputLabel>ÁFA</InputLabel>
                <Select
                  value={formData.vat_id}
                  onChange={(e) => handleInputChange('vat_id', e.target.value)}
                  label="ÁFA"
                >
                  {vatRates.map((vat) => (
                    <MenuItem key={vat.id} value={vat.id}>
                      {vat.name} ({vat.kulcs}%)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Currency */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required disabled={loading}>
                <InputLabel>Pénznem</InputLabel>
                <Select
                  value={formData.currency_id}
                  onChange={(e) => handleInputChange('currency_id', e.target.value)}
                  label="Pénznem"
                >
                  {currencies.map((currency) => (
                    <MenuItem key={currency.id} value={currency.id}>
                      {currency.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Units */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required disabled={loading}>
                <InputLabel>Mértékegység</InputLabel>
                <Select
                  value={formData.units_id}
                  onChange={(e) => handleInputChange('units_id', e.target.value)}
                  label="Mértékegység"
                >
                  {units.map((unit) => (
                    <MenuItem key={unit.id} value={unit.id}>
                      {unit.name} ({unit.shortform})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Partners */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required disabled={loading}>
                <InputLabel>Partner</InputLabel>
                <Select
                  value={formData.partners_id}
                  onChange={(e) => handleInputChange('partners_id', e.target.value)}
                  label="Partner"
                >
                  {partners.map((partner) => (
                    <MenuItem key={partner.id} value={partner.id}>
                      {partner.name}
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
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Nettó ár:
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrency(formData.net_price)}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      ÁFA összeg:
                    </Typography>
                    <Typography variant="h6" color="text.secondary">
                      {formatCurrency(calculatedPrices.vat_amount)}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Bruttó ár:
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary">
                      {formatCurrency(calculatedPrices.gross_price)}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* Actions */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Vissza
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : undefined}
                >
                  {loading ? 'Mentés...' : (initialData?.id ? 'Frissítés' : 'Mentés')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  )
}
