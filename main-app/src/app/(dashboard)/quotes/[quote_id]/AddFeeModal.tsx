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
  CircularProgress,
  TextField,
  Grid
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
  feeTypes: FeeType[] | undefined
  apiPath?: string // Optional API path, defaults to '/api/quotes/'
}

export default function AddFeeModal({ open, onClose, quoteId, onSuccess, feeTypes, apiPath = '/api/quotes/' }: AddFeeModalProps) {
  const [selectedFeeTypeId, setSelectedFeeTypeId] = useState('')
  const [quantity, setQuantity] = useState<number | ''>(1)
  const [unitPrice, setUnitPrice] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (open) {
      setSelectedFeeTypeId('')
      setQuantity(1)
      setUnitPrice(0)
      setComment('')
    }
  }, [open])

  // Auto-fill unit price when fee type is selected
  const handleFeeTypeChange = (feeTypeId: string) => {
    setSelectedFeeTypeId(feeTypeId)
    const feeType = feeTypes?.find(ft => ft.id === feeTypeId)
    if (feeType) {
      setUnitPrice(feeType.gross_price)
    }
  }

  const handleSubmit = async () => {
    if (!selectedFeeTypeId) {
      toast.error('Kérjük, válasszon díjtípust!', {
        position: "top-right",
        autoClose: 3000,
      })
      return
    }

    const finalQuantity = typeof quantity === 'number' ? quantity : parseInt(String(quantity)) || 1
    
    if (finalQuantity < 1) {
      toast.error('A mennyiség legalább 1 kell legyen!', {
        position: "top-right",
        autoClose: 3000,
      })
      return
    }

    // Convert gross price to net price for API
    const vatRate = selectedFeeType ? selectedFeeType.vat_percent / 100 : 0
    const unitPriceNet = unitPrice / (1 + vatRate)

    setLoading(true)
    try {
      const response = await fetch(`${apiPath}${quoteId}/fees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feetype_id: selectedFeeTypeId,
          quantity: finalQuantity,
          unit_price_net: unitPriceNet,
          comment: comment.trim()
        }),
      })

      if (response.ok) {
        toast.success('Díj sikeresen hozzáadva!', {
          position: "top-right",
          autoClose: 3000,
        })
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

  const selectedFeeType = feeTypes?.find(ft => ft.id === selectedFeeTypeId)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Calculate preview
  const previewQuantity = typeof quantity === 'number' ? quantity : (quantity === '' ? 0 : parseInt(String(quantity)) || 0)
  const totalGross = unitPrice * previewQuantity
  const vatRate = selectedFeeType ? selectedFeeType.vat_percent / 100 : 0
  const totalNet = totalGross / (1 + vatRate)
  const totalVat = totalGross - totalNet

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Díj hozzáadása</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* Fee Type Selection */}
          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel>Díjtípus</InputLabel>
              <Select
                value={selectedFeeTypeId}
                onChange={(e) => handleFeeTypeChange(e.target.value)}
                label="Díjtípus"
              >
                {(feeTypes || []).map((feeType) => (
                  <MenuItem key={feeType.id} value={feeType.id}>
                    {feeType.name} - {formatCurrency(feeType.gross_price)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Quantity */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Mennyiség *"
              type="number"
              value={quantity}
              onChange={(e) => {
                const val = e.target.value
                if (val === '' || val === '0') {
                  setQuantity('' as any) // Allow empty for editing
                } else {
                  setQuantity(parseInt(val) || 1)
                }
              }}
              onBlur={(e) => {
                // Set to 1 if empty on blur
                if (e.target.value === '' || parseInt(e.target.value) < 1) {
                  setQuantity(1)
                }
              }}
              inputProps={{ min: 1 }}
              required
            />
          </Grid>

          {/* Unit Price (Editable) */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Egységár (Bruttó) *"
              type="number"
              value={Math.round(unitPrice)}
              onChange={(e) => setUnitPrice(Math.round(parseFloat(e.target.value)) || 0)}
              required
              helperText="Módosítható érték"
              inputProps={{ 
                step: 1,
                min: 0
              }}
            />
          </Grid>

          {/* Comment (Optional) */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Megjegyzés"
              multiline
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Opcionális megjegyzés ehhez a díjhoz..."
            />
          </Grid>

          {/* Price Preview */}
          <Grid item xs={12}>
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
                <Typography variant="body2">Egységár:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(unitPrice)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Mennyiség:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {previewQuantity}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, pt: 1, borderTop: 1, borderColor: 'grey.300' }}>
                <Typography variant="body2">Nettó összesen:</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(totalNet)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">ÁFA ({selectedFeeType ? selectedFeeType.vat_percent : 0}%):</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(totalVat)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: 1, borderColor: 'grey.300' }}>
                <Typography variant="body2" fontWeight="bold">
                  Bruttó összesen:
                </Typography>
                <Typography variant="body2" fontWeight="bold" color="primary">
                  {formatCurrency(totalGross)}
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
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
