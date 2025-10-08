'use client'

import React, { useState } from 'react'
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
  Typography,
  Box,
  CircularProgress
} from '@mui/material'
import { toast } from 'react-toastify'

interface FeeType {
  id: string
  name: string
  net_price: number
  vat_percent: number
  gross_price: number
}

interface AddFeeModalProps {
  open: boolean
  onClose: () => void
  quoteId: string
  onSuccess: () => void
  feeTypes: FeeType[]
}

export default function AddFeeModal({ open, onClose, quoteId, onSuccess, feeTypes }: AddFeeModalProps) {
  const [selectedFeeTypeId, setSelectedFeeTypeId] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!selectedFeeTypeId) {
      toast.error('Kérjük, válasszon díjtípust!', {
        position: "top-right",
        autoClose: 3000,
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/quotes/${quoteId}/fees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feetype_id: selectedFeeTypeId,
        }),
      })

      if (response.ok) {
        toast.success('Díj sikeresen hozzáadva!', {
          position: "top-right",
          autoClose: 3000,
        })
        setSelectedFeeTypeId('')
        onSuccess()
        onClose()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Hiba történt a díj hozzáadása során!', {
          position: "top-right",
          autoClose: 3000,
        })
      }
    } catch (error) {
      console.error('Error adding fee:', error)
      toast.error('Hiba történt a díj hozzáadása során!', {
        position: "top-right",
        autoClose: 3000,
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedFeeType = feeTypes.find(ft => ft.id === selectedFeeTypeId)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Díj hozzáadása</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 2, mb: 3 }}>
          <InputLabel>Díjtípus</InputLabel>
          <Select
            value={selectedFeeTypeId}
            onChange={(e) => setSelectedFeeTypeId(e.target.value)}
            label="Díjtípus"
          >
            {feeTypes.map((feeType) => (
              <MenuItem key={feeType.id} value={feeType.id}>
                {feeType.name} - {formatCurrency(feeType.net_price)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedFeeType && (
          <Box
            sx={{
              p: 2,
              bgcolor: 'grey.50',
              borderRadius: 1,
              border: 1,
              borderColor: 'grey.300',
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Ár előnézet:
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Nettó ár:</Typography>
              <Typography variant="body2" fontWeight="medium">
                {formatCurrency(selectedFeeType.net_price)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">ÁFA ({selectedFeeType.vat_percent}%):</Typography>
              <Typography variant="body2" fontWeight="medium">
                {formatCurrency(selectedFeeType.gross_price - selectedFeeType.net_price)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'grey.300' }}>
              <Typography variant="body2" fontWeight="bold">
                Bruttó ár:
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="primary">
                {formatCurrency(selectedFeeType.gross_price)}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Mégse
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !selectedFeeTypeId}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? 'Hozzáadás...' : 'Hozzáadás'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
