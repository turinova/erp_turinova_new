'use client'

import React from 'react'
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Paper,
  Alert
} from '@mui/material'
import { Store as StoreIcon } from '@mui/icons-material'
import type { WebshopConnection } from '@/lib/connections-server'

interface Step1ConnectionSelectionProps {
  connections: WebshopConnection[]
  loading: boolean
  selectedConnectionId: string | null
  onSelect: (connectionId: string) => void
}

export default function Step1ConnectionSelection({
  connections,
  loading,
  selectedConnectionId,
  onSelect
}: Step1ConnectionSelectionProps) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (connections.length === 0) {
    return (
      <Alert severity="warning">
        Nincs aktív ShopRenter kapcsolat. Kérjük, hozzon létre egy kapcsolatot a Kapcsolatok oldalon.
      </Alert>
    )
  }

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
          <StoreIcon sx={{ color: 'white', fontSize: '24px' }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565c0' }}>
          Webshop kapcsolat kiválasztása
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Válassza ki, hogy melyik webshop kapcsolathoz szeretné hozzáadni a terméket.
      </Typography>

      <FormControl fullWidth>
        <InputLabel>Kapcsolat *</InputLabel>
        <Select
          value={selectedConnectionId || ''}
          onChange={(e) => onSelect(e.target.value)}
          label="Kapcsolat *"
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
          {connections.map((connection) => (
            <MenuItem key={connection.id} value={connection.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StoreIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {connection.name || connection.shop_name || 'Névtelen kapcsolat'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {connection.api_url}
                  </Typography>
                </Box>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {selectedConnectionId && (
        <Paper
          elevation={0}
          sx={{
            mt: 3,
            p: 2,
            bgcolor: 'primary.50',
            border: '1px solid',
            borderColor: 'primary.200',
            borderRadius: 1
          }}
        >
          <Typography variant="body2" color="primary.main" sx={{ fontWeight: 500 }}>
            Kiválasztott kapcsolat: {connections.find(c => c.id === selectedConnectionId)?.name || 'Ismeretlen'}
          </Typography>
        </Paper>
      )}
    </Paper>
  )
}
