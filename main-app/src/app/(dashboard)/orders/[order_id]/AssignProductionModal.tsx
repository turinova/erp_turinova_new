'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material'
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { hu } from 'date-fns/locale'
import { toast } from 'react-toastify'

interface Machine {
  id: string
  machine_name: string
  comment: string | null
  usage_limit_per_day: number
}

interface AssignProductionModalProps {
  open: boolean
  onClose: () => void
  quoteId: string
  orderNumber: string
  machines: Machine[]
  existingAssignment?: {
    production_machine_id: string | null
    production_date: string | null
    barcode: string | null
  } | null
  onSuccess: () => void
}

export default function AssignProductionModal({
  open,
  onClose,
  quoteId,
  orderNumber,
  machines,
  existingAssignment,
  onSuccess
}: AssignProductionModalProps) {
  
  const [machineId, setMachineId] = useState<string>('')
  const [productionDate, setProductionDate] = useState<Date | null>(null)
  const [barcode, setBarcode] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate next business day (skip weekends)
  const getNextBusinessDay = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const dayOfWeek = tomorrow.getDay()
    
    // If Saturday (6), add 2 days to get Monday
    if (dayOfWeek === 6) {
      tomorrow.setDate(tomorrow.getDate() + 2)
    }
    // If Sunday (0), add 1 day to get Monday
    else if (dayOfWeek === 0) {
      tomorrow.setDate(tomorrow.getDate() + 1)
    }
    // If Friday (5), add 3 days to get Monday
    else if (dayOfWeek === 5) {
      tomorrow.setDate(tomorrow.getDate() + 3)
    }
    
    return tomorrow
  }

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      if (existingAssignment && existingAssignment.production_machine_id) {
        // Edit mode: populate with existing values
        setMachineId(existingAssignment.production_machine_id)
        setProductionDate(existingAssignment.production_date ? new Date(existingAssignment.production_date) : getNextBusinessDay())
        setBarcode(existingAssignment.barcode || '')
      } else {
        // New assignment: default values
        setMachineId('')
        setProductionDate(getNextBusinessDay())
        setBarcode('')
      }
      setError(null)
    }
  }, [open, existingAssignment])

  const isEditMode = existingAssignment && existingAssignment.production_machine_id

  // Normalize barcode input (fix keyboard layout issues from scanner)
  // Some scanners send US key codes but the OS layout maps '-' -> 'ü', '0' -> 'ö'
  // Normalize barcode input (fix keyboard layout issues from scanner)
  // Some scanners send US key codes but the OS layout maps '-' -> 'ü', '0' -> 'ö', 'Z' -> 'Y'
  const normalizeBarcode = (input: string): string => {
    const charMap: Record<string, string> = {
      'ü': '-',
      'ö': '0',
      'Y': 'Z'  // Hungarian keyboard: scanner sends Z but OS shows Y
    }
    return input
      .split('')
      .map(char => charMap[char] || char)
      .join('')
  }

  const handleSubmit = async () => {
    // Validation
    if (!machineId) {
      setError('Kérjük, válassz gépet!')
      return
    }

    if (!productionDate) {
      setError('Kérjük, válassz gyártási dátumot!')
      return
    }

    if (!barcode || !barcode.trim()) {
      setError('Kérjük, add meg a vonalkódot!')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/quotes/${quoteId}/production`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          production_machine_id: machineId,
          production_date: productionDate.toISOString().split('T')[0], // YYYY-MM-DD
          barcode: barcode.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba történt a gyártásba adás során')
      }

      toast.success(isEditMode ? 'Gyártás sikeresen módosítva!' : 'Megrendelés sikeresen gyártásba adva!')
      onSuccess()
      onClose()
      
    } catch (err) {
      console.error('Production assignment error:', err)
      setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt')
      toast.error('Hiba a gyártásba adás során!')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Biztosan törölni szeretnéd a gyártás hozzárendelést?')) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/quotes/${quoteId}/production`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba történt a gyártás törlése során')
      }

      toast.success('Gyártás hozzárendelés törölve!')
      onSuccess()
      onClose()
      
    } catch (err) {
      console.error('Production delete error:', err)
      setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt')
      toast.error('Hiba a gyártás törlése során!')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog 
      open={open} 
      onClose={isSubmitting || isDeleting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {isEditMode ? 'Gyártás módosítása' : 'Gyártásba adás'}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {/* Order Info */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Megrendelés: <strong>{orderNumber}</strong>
            </Typography>
          </Box>

          {/* Machine Selection */}
          <FormControl fullWidth sx={{ mb: 2 }} required>
            <InputLabel>Gép</InputLabel>
            <Select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              label="Gép"
            >
              {machines.map((machine) => (
                <MenuItem key={machine.id} value={machine.id}>
                  {machine.machine_name}
                  {machine.comment && ` (${machine.comment})`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Production Date */}
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={hu}>
            <DatePicker
              label="Gyártás dátuma *"
              value={productionDate}
              onChange={(newValue) => setProductionDate(newValue)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  sx: { mb: 2 }
                }
              }}
            />
          </LocalizationProvider>

          {/* Barcode */}
          <TextField
            fullWidth
            label="Vonalkód"
            value={barcode}
            onChange={(e) => setBarcode(normalizeBarcode(e.target.value))}
            placeholder="Vonalkód beolvasása vagy megadása"
            required
            sx={{ mb: 2 }}
            helperText="Fizikai vonalkód leolvasó használata ajánlott"
            autoFocus
          />

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Box>
          {isEditMode && (
            <Button
              onClick={handleDelete}
              disabled={isSubmitting || isDeleting}
              color="error"
              startIcon={isDeleting && <CircularProgress size={16} />}
            >
              {isDeleting ? 'Törlés...' : 'Gyártás törlése'}
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            onClick={onClose}
            disabled={isSubmitting || isDeleting}
          >
            Mégse
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting || isDeleting}
            startIcon={isSubmitting && <CircularProgress size={16} />}
            color="warning"
          >
            {isSubmitting ? 'Mentés...' : isEditMode ? 'Módosítás' : 'Gyártásba adás'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  )
}

