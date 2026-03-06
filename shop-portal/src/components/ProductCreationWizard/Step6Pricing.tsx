'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  CircularProgress
} from '@mui/material'
import { AttachMoney as AttachMoneyIcon } from '@mui/icons-material'

interface Step6PricingProps {
  data: {
    cost: string
    multiplier: string
    vat_id: string | null
  }
  onChange: (field: string, value: string) => void
}

interface VatRate {
  id: string
  name: string
  kulcs: number
}

export default function Step6Pricing({
  data,
  onChange
}: Step6PricingProps) {
  const [vatRates, setVatRates] = useState<VatRate[]>([])
  const [loading, setLoading] = useState(false)
  const [netPrice, setNetPrice] = useState<number | null>(null)
  const [grossPrice, setGrossPrice] = useState<number | null>(null)

  useEffect(() => {
    loadVatRates()
  }, [])

  useEffect(() => {
    // Calculate net and gross price
    const cost = parseFloat(data.cost) || 0
    const multiplier = parseFloat(data.multiplier) || 1.0
    const calculatedNet = cost * multiplier
    setNetPrice(calculatedNet)

    if (data.vat_id && vatRates.length > 0) {
      const vatRate = vatRates.find(v => v.id === data.vat_id)
      if (vatRate) {
        setGrossPrice(calculatedNet * (1 + vatRate.kulcs / 100))
      } else {
        setGrossPrice(null)
      }
    } else {
      setGrossPrice(null)
    }
  }, [data.cost, data.multiplier, data.vat_id, vatRates])

  const loadVatRates = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/vat-rates')
      if (response.ok) {
        const data = await response.json()
        setVatRates(data.vatRates || [])
      }
    } catch (error) {
      console.error('Error loading VAT rates:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: 'white',
        border: '2px solid',
        borderColor: '#9c27b0',
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          p: 1,
          borderRadius: '50%',
          bgcolor: '#9c27b0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)'
        }}>
          <AttachMoneyIcon sx={{ color: 'white', fontSize: '24px' }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#7b1fa2' }}>
          Árazás
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Beszerzési ár *"
            type="number"
            inputProps={{ step: '0.01', min: '0' }}
            value={data.cost}
            onChange={(e) => onChange('cost', e.target.value)}
            required
            helperText="A termék beszerzési ára"
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

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Árazási szorzó"
            type="number"
            inputProps={{ step: '0.001', min: '0' }}
            value={data.multiplier}
            onChange={(e) => onChange('multiplier', e.target.value || '1.0')}
            helperText="Alapértelmezett: 1.0"
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

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required>
            <InputLabel>ÁFA *</InputLabel>
            <Select
              value={data.vat_id || ''}
              onChange={(e) => onChange('vat_id', e.target.value)}
              label="ÁFA *"
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
              {vatRates.map((vat) => (
                <MenuItem key={vat.id} value={vat.id}>
                  {vat.name} ({vat.kulcs}%)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: 'grey.50',
              border: '1px solid',
              borderColor: 'grey.200',
              borderRadius: 1
            }}
          >
            <Typography variant="caption" color="text.secondary" display="block">
              Számított árak
            </Typography>
            <Typography variant="h6" sx={{ mt: 1, fontWeight: 600 }}>
              Nettó ár: {netPrice !== null ? `${netPrice.toFixed(2)} Ft` : '-'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Bruttó ár: {grossPrice !== null ? `${grossPrice.toFixed(2)} Ft` : '-'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Paper>
  )
}
