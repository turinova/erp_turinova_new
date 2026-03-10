'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material'
import { Payment as PaymentIcon } from '@mui/icons-material'

interface PaymentSettingsCardProps {
  supplierId: string
  initialPaymentMethodId: string | null
  initialPaymentTermsDays: number | null
  initialVatId: string | null
  initialCurrencyId: string | null
  vatRates: Array<{ id: string; name: string; rate: number }>
  onUpdate: (data: {
    default_payment_method_id: string | null
    default_payment_terms_days: number | null
    default_vat_id: string | null
    default_currency_id: string | null
  }) => void
}

export default function PaymentSettingsCard({
  supplierId,
  initialPaymentMethodId,
  initialPaymentTermsDays,
  initialVatId,
  initialCurrencyId,
  vatRates,
  onUpdate
}: PaymentSettingsCardProps) {
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; name: string }>>([])
  const [currencies, setCurrencies] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    payment_method_id: initialPaymentMethodId || '',
    payment_terms_days: initialPaymentTermsDays?.toString() || '',
    vat_id: initialVatId || '',
    currency_id: initialCurrencyId || ''
  })

  // Initialize onUpdate when component mounts
  useEffect(() => {
    onUpdate({
      default_payment_method_id: formData.payment_method_id || null,
      default_payment_terms_days: formData.payment_terms_days ? parseInt(formData.payment_terms_days) : null,
      default_vat_id: formData.vat_id || null,
      default_currency_id: formData.currency_id || null
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  // Common payment terms presets
  const paymentTermsPresets = [
    { value: '8', label: '8 nap' },
    { value: '14', label: '14 nap' },
    { value: '30', label: '30 nap' },
    { value: '60', label: '60 nap' },
    { value: '90', label: '90 nap' }
  ]

  // Fetch payment methods and currencies
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [paymentMethodsRes, currenciesRes] = await Promise.all([
          fetch('/api/payment-methods'),
          fetch('/api/currencies')
        ])

        if (paymentMethodsRes.ok) {
          const paymentData = await paymentMethodsRes.json()
          setPaymentMethods(
            (paymentData.payment_methods || [])
              .filter((pm: any) => pm.active)
              .map((pm: any) => ({ id: pm.id, name: pm.name }))
          )
        }

        if (currenciesRes.ok) {
          const currencyData = await currenciesRes.json()
          setCurrencies(
            (currencyData.currencies || []).map((c: any) => ({
              id: c.id,
              name: c.name,
              code: c.code
            }))
          )
        }
      } catch (error) {
        console.error('Error fetching payment data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])


  const handlePaymentTermsChange = (value: string) => {
    const newFormData = { ...formData, payment_terms_days: value }
    setFormData(newFormData)
    onUpdate({
      default_payment_method_id: newFormData.payment_method_id || null,
      default_payment_terms_days: newFormData.payment_terms_days ? parseInt(newFormData.payment_terms_days) : null,
      default_vat_id: newFormData.vat_id || null,
      default_currency_id: newFormData.currency_id || null
    })
  }

  const handleFieldChange = (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value }
    setFormData(newFormData)
    onUpdate({
      default_payment_method_id: newFormData.payment_method_id || null,
      default_payment_terms_days: newFormData.payment_terms_days ? parseInt(newFormData.payment_terms_days) : null,
      default_vat_id: newFormData.vat_id || null,
      default_currency_id: newFormData.currency_id || null
    })
  }

  return (
    <Paper 
      elevation={0}
      sx={{ 
        p: 3,
        bgcolor: 'white',
        border: '2px solid',
        borderColor: '#f44336',
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
        <Box sx={{ 
          p: 1, 
          borderRadius: '50%', 
          bgcolor: '#f44336',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)'
        }}>
          <PaymentIcon sx={{ color: 'white', fontSize: '24px' }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#c62828' }}>
          Fizetési beállítások
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* First row: Fizetési mód + Fizetési határidő */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Fizetési mód</InputLabel>
            <Select
              value={formData.payment_method_id}
              label="Fizetési mód"
              onChange={(e) => handleFieldChange('payment_method_id', e.target.value)}
              disabled={loading}
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
              <MenuItem value="">
                <em>Nincs kiválasztva</em>
              </MenuItem>
              {paymentMethods.map((method) => (
                <MenuItem key={method.id} value={method.id}>
                  {method.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <InputLabel sx={{ mb: 1 }}>Fizetési határidő (nap)</InputLabel>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', flex: 1 }}>
                {paymentTermsPresets.map((preset) => (
                  <Box
                    key={preset.value}
                    onClick={() => handlePaymentTermsChange(preset.value)}
                    sx={{
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: formData.payment_terms_days === preset.value ? '#f44336' : '#e0e0e0',
                      bgcolor: formData.payment_terms_days === preset.value ? '#ffebee' : 'transparent',
                      color: formData.payment_terms_days === preset.value ? '#c62828' : 'inherit',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: formData.payment_terms_days === preset.value ? 600 : 400,
                      '&:hover': {
                        borderColor: '#f44336',
                        bgcolor: '#ffebee'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {preset.label}
                  </Box>
                ))}
              </Box>
              <TextField
                type="number"
                value={formData.payment_terms_days}
                onChange={(e) => handlePaymentTermsChange(e.target.value)}
                placeholder="Egyedi"
                size="small"
                sx={{
                  width: 110,
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
                inputProps={{ min: 0, step: 1 }}
              />
            </Box>
          </Box>
        </Box>

        {/* Second row: ÁFA + Pénznem */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>ÁFA</InputLabel>
            <Select
              value={formData.vat_id}
              label="ÁFA"
              onChange={(e) => handleFieldChange('vat_id', e.target.value)}
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
              <MenuItem value="">
                <em>Nincs kiválasztva</em>
              </MenuItem>
              {vatRates.map((vat) => (
                <MenuItem key={vat.id} value={vat.id}>
                  {vat.name} ({vat.rate}%)
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Pénznem</InputLabel>
            <Select
              value={formData.currency_id}
              label="Pénznem"
              onChange={(e) => handleFieldChange('currency_id', e.target.value)}
              disabled={loading}
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
              <MenuItem value="">
                <em>Nincs kiválasztva</em>
              </MenuItem>
              {currencies.map((currency) => (
                <MenuItem key={currency.id} value={currency.id}>
                  {currency.name} ({currency.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>
    </Paper>
  )
}
