'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress
} from '@mui/material'
import { toast } from 'react-toastify'

interface EditDiscountModalProps {
  open: boolean
  onClose: () => void
  quoteId: string
  currentDiscountPercent: number
  onSuccess: () => void
}

export default function EditDiscountModal({ 
  open, 
  onClose, 
  quoteId, 
  currentDiscountPercent,
  onSuccess 
}: EditDiscountModalProps) {
  const [discountPercent, setDiscountPercent] = useState<number | ''>(currentDiscountPercent)
  const [loading, setLoading] = useState(false)

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setDiscountPercent(currentDiscountPercent)
    }
  }, [open, currentDiscountPercent])

  const handleSubmit = async () => {
    const finalDiscount = typeof discountPercent === 'number' ? discountPercent : parseFloat(String(discountPercent)) || 0

    if (finalDiscount < 0 || finalDiscount > 100) {
      toast.error('A kedvezmény 0 és 100% között kell legyen!', {
        position: "top-right",
        autoClose: 3000,
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          discount_percent: finalDiscount
        }),
      })

      if (response.ok) {
        toast.success('Kedvezmény sikeresen frissítve!', {
          position: "top-right",
          autoClose: 3000,
        })
        onSuccess()
        onClose()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Hiba történt a kedvezmény frissítése során!', {
          position: "top-right",
          autoClose: 3000,
        })
      }
    } catch (error) {
      console.error('Error updating discount:', error)
      toast.error('Hiba történt a kedvezmény frissítése során!', {
        position: "top-right",
        autoClose: 3000,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Kedvezmény szerkesztése</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Kedvezmény százalék"
            type="number"
            value={discountPercent}
            onChange={(e) => {
              const val = e.target.value
              if (val === '') {
                setDiscountPercent('')
              } else {
                setDiscountPercent(parseFloat(val) || 0)
              }
            }}
            onBlur={(e) => {
              // Set to 0 if empty on blur
              if (e.target.value === '') {
                setDiscountPercent(0)
              }
            }}
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            helperText="0 és 100% között"
            required
            autoFocus
          />

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            A kedvezmény az anyagokra, díjakra és termékekre is vonatkozik.
            Negatív értékű díjak és termékek nem kapnak kedvezményt.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Mégse
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? 'Mentés...' : 'Mentés'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

