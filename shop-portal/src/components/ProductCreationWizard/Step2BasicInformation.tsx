'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
  Grid,
  CircularProgress,
  Paper
} from '@mui/material'
import { Info as InfoIcon } from '@mui/icons-material'
import { toast } from 'react-toastify'

interface Step2BasicInformationProps {
  data: {
    sku: string
    name: string
    model_number: string
    gtin: string
  }
  connectionId: string | null
  onChange: (field: string, value: string) => void
}

export default function Step2BasicInformation({
  data,
  connectionId,
  onChange
}: Step2BasicInformationProps) {
  const [validatingSku, setValidatingSku] = useState(false)
  const [skuError, setSkuError] = useState<string | null>(null)
  const [skuValidated, setSkuValidated] = useState(false)

  // Validate SKU when it changes
  useEffect(() => {
    if (data.sku.trim() && connectionId) {
      const timeoutId = setTimeout(() => {
        validateSku(data.sku.trim(), connectionId)
      }, 500) // Debounce 500ms

      return () => clearTimeout(timeoutId)
    } else {
      setSkuError(null)
      setSkuValidated(false)
    }
  }, [data.sku, connectionId])

  const validateSku = async (sku: string, connId: string) => {
    if (!sku.trim()) {
      setSkuError(null)
      setSkuValidated(false)
      return
    }

    setValidatingSku(true)
    setSkuError(null)
    setSkuValidated(false)

    try {
      const response = await fetch(`/api/products/validate-sku?sku=${encodeURIComponent(sku)}&connection_id=${connId}`)
      const result = await response.json()

      if (result.available) {
        setSkuError(null)
        setSkuValidated(true)
      } else {
        setSkuError(result.message || 'A SKU már létezik')
        setSkuValidated(false)
      }
    } catch (error) {
      console.error('Error validating SKU:', error)
      setSkuError('Hiba a SKU ellenőrzésekor')
      setSkuValidated(false)
    } finally {
      setValidatingSku(false)
    }
  }

  // Note: URL slug will be auto-generated in Step 7

  return (
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
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Termék neve *"
            value={data.name}
            onChange={(e) => onChange('name', e.target.value)}
            required
            helperText="A termék teljes neve"
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
            label="Cikkszám (SKU) *"
            value={data.sku}
            onChange={(e) => onChange('sku', e.target.value.toUpperCase())}
            required
            error={!!skuError}
            helperText={
              validatingSku
                ? 'Ellenőrzés...'
                : skuError
                ? skuError
                : skuValidated
                ? 'A SKU elérhető'
                : 'Egyedi termékszám (kis- és nagybetűk nem számítanak)'
            }
            InputProps={{
              endAdornment: validatingSku ? <CircularProgress size={20} /> : null
            }}
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
            label="Gyártói cikkszám"
            value={data.model_number}
            onChange={(e) => onChange('model_number', e.target.value)}
            helperText="Opcionális"
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

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Vonalkód (GTIN)"
            value={data.gtin}
            onChange={(e) => onChange('gtin', e.target.value)}
            helperText="Opcionális - EAN, UPC vagy más vonalkód"
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
      </Grid>
    </Paper>
  )
}
