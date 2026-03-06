'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Paper
} from '@mui/material'
import { Label as LabelIcon } from '@mui/icons-material'

interface Step5AttributesProps {
  connectionId: string | null
  attributes: any | null
  onChange: (attributes: any) => void
}

interface Attribute {
  name: string
  display_name: string
  type: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT'
  prefix?: string | null
  postfix?: string | null
  values?: Array<{ id: string; value: string }>
}

export default function Step5Attributes({
  connectionId,
  attributes,
  onChange
}: Step5AttributesProps) {
  const [availableAttributes, setAvailableAttributes] = useState<Attribute[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attributeValues, setAttributeValues] = useState<Record<string, any>>({})

  useEffect(() => {
    if (connectionId) {
      loadAttributes()
    } else {
      setAvailableAttributes([])
    }
  }, [connectionId])

  useEffect(() => {
    // Initialize attribute values from props
    if (attributes) {
      setAttributeValues(attributes)
    }
  }, [])

  const loadAttributes = async () => {
    if (!connectionId) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/connections/${connectionId}/attributes`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAvailableAttributes(data.attributes || [])
        } else {
          setError(data.error || 'Hiba az attribútumok betöltésekor')
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Hiba az attribútumok betöltésekor')
      }
    } catch (error) {
      console.error('Error loading attributes:', error)
      setError('Hiba az attribútumok betöltésekor')
    } finally {
      setLoading(false)
    }
  }

  const handleAttributeChange = (attrName: string, value: any) => {
    const newValues = { ...attributeValues, [attrName]: value }
    setAttributeValues(newValues)
    
    // Convert to ShopRenter format
    const formattedAttributes = availableAttributes
      .filter(attr => newValues[attr.name] !== undefined && newValues[attr.name] !== null && newValues[attr.name] !== '')
      .map(attr => ({
        name: attr.name,
        type: attr.type,
        display_name: attr.display_name,
        prefix: attr.prefix,
        postfix: attr.postfix,
        value: newValues[attr.name]
      }))
    
    onChange(formattedAttributes.length > 0 ? formattedAttributes : null)
  }

  if (!connectionId) {
    return (
      <Alert severity="info">
        Először válasszon kapcsolatot az 1. lépésben.
      </Alert>
    )
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          bgcolor: 'white',
          border: '2px solid',
          borderColor: '#4caf50',
          borderRadius: 2
        }}
      >
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
          <Typography variant="body2" sx={{ mt: 1 }}>
            Az attribútumok kihagyhatók. Később is hozzáadhatók a termék szerkesztése oldalon.
          </Typography>
        </Alert>
      </Paper>
    )
  }

  if (availableAttributes.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          bgcolor: 'white',
          border: '2px solid',
          borderColor: '#4caf50',
          borderRadius: 2
        }}
      >
        <Alert severity="info">
          Nincs elérhető attribútum ezen a kapcsolaton. Az attribútumok opcionálisak.
        </Alert>
      </Paper>
    )
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
        border: '2px solid',
        borderColor: '#4caf50',
        borderRadius: 2,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: '100px',
          height: '100px',
          background: 'radial-gradient(circle, rgba(76, 175, 80, 0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          transform: 'translate(30px, -30px)'
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          p: 1,
          borderRadius: '50%',
          bgcolor: '#4caf50',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
        }}>
          <LabelIcon sx={{ color: 'white', fontSize: '24px' }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
          Attribútumok
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {availableAttributes.map((attr) => {
          const displayLabel = attr.display_name || attr.name
          return (
            <Grid item xs={12} sm={6} key={attr.name}>
              {attr.type === 'LIST' && attr.values && attr.values.length > 0 ? (
                <FormControl fullWidth>
                  <InputLabel>{displayLabel}</InputLabel>
                  <Select
                    value={attributeValues[attr.name] || ''}
                    onChange={(e) => handleAttributeChange(attr.name, e.target.value)}
                    label={displayLabel}
                    multiple={false}
                    sx={{
                      bgcolor: 'rgba(255, 255, 255, 0.9)',
                      '&:hover': {
                        bgcolor: 'white'
                      }
                    }}
                  >
                  {attr.values.map((val: any) => (
                    <MenuItem key={val.id} value={val.id}>
                      {val.value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : attr.type === 'INTEGER' ? (
              <TextField
                fullWidth
                label={attr.display_name || attr.name}
                type="number"
                value={attributeValues[attr.name] || ''}
                onChange={(e) => handleAttributeChange(attr.name, parseInt(e.target.value) || null)}
                InputProps={{
                  startAdornment: attr.prefix ? <Typography sx={{ mr: 1 }}>{attr.prefix}</Typography> : null,
                  endAdornment: attr.postfix ? <Typography sx={{ ml: 1 }}>{attr.postfix}</Typography> : null
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    '&:hover': {
                      bgcolor: 'white'
                    },
                    '&.Mui-focused': {
                      bgcolor: 'white'
                    }
                  }
                }}
              />
            ) : attr.type === 'FLOAT' ? (
              <TextField
                fullWidth
                label={displayLabel}
                type="number"
                inputProps={{ step: '0.01' }}
                value={attributeValues[attr.name] || ''}
                onChange={(e) => handleAttributeChange(attr.name, parseFloat(e.target.value) || null)}
                InputProps={{
                  startAdornment: attr.prefix ? <Typography sx={{ mr: 1 }}>{attr.prefix}</Typography> : null,
                  endAdornment: attr.postfix ? <Typography sx={{ ml: 1 }}>{attr.postfix}</Typography> : null
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    '&:hover': {
                      bgcolor: 'white'
                    },
                    '&.Mui-focused': {
                      bgcolor: 'white'
                    }
                  }
                }}
              />
            ) : (
              <TextField
                fullWidth
                label={displayLabel}
                value={attributeValues[attr.name] || ''}
                onChange={(e) => handleAttributeChange(attr.name, e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    '&:hover': {
                      bgcolor: 'white'
                    },
                    '&.Mui-focused': {
                      bgcolor: 'white'
                    }
                  }
                }}
              />
            )}
          </Grid>
          )
        })}
      </Grid>

      {Object.keys(attributeValues).length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
            Beállított attribútumok:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {Object.entries(attributeValues).map(([name, value]) => {
              const attr = availableAttributes.find(a => a.name === name)
              if (!attr || !value) return null
              const displayName = attr.display_name || attr.name
              // For LIST attributes, find the value label
              let valueLabel = value
              if (attr.type === 'LIST' && attr.values) {
                const selectedValue = attr.values.find((v: any) => v.id === value)
                valueLabel = selectedValue?.value || value
              }
              return (
                <Chip
                  key={name}
                  label={`${displayName}: ${valueLabel}`}
                  size="small"
                  sx={{
                    bgcolor: '#4caf50',
                    color: 'white',
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': {
                      color: 'white'
                    }
                  }}
                  onDelete={() => handleAttributeChange(name, null)}
                />
              )
            })}
          </Box>
        </Box>
      )}
    </Paper>
  )
}
