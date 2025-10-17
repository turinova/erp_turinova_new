'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Alert,
  InputAdornment,
  CircularProgress
} from '@mui/material'
import { toast } from 'react-toastify'

interface CreateOrderModalProps {
  open: boolean
  onClose: () => void
  quoteId: string
  quoteNumber: string
  finalTotal: number
  onSuccess: (orderId: string, orderNumber: string) => void
}

export default function CreateOrderModal({
  open,
  onClose,
  quoteId,
  quoteNumber,
  finalTotal,
  onSuccess
}: CreateOrderModalProps) {
  
  const [amount, setAmount] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [comment, setComment] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      console.log('[CREATE ORDER MODAL] Opening with finalTotal:', finalTotal, 'type:', typeof finalTotal)
      setAmount('')
      setPaymentMethod('cash')
      setComment('')
      setError(null)
    }
  }, [open, finalTotal])

  // Calculate payment status
  const getPaymentStatus = () => {
    const paidAmount = parseFloat(amount) || 0
    const validFinalTotal = finalTotal || 0
    
    if (paidAmount === 0) {
      return { status: 'not_paid', label: 'Nincs fizetve', color: 'error' }
    } else if (paidAmount >= validFinalTotal) {
      return { status: 'paid', label: 'Kifizetve', color: 'success' }
    } else {
      return { status: 'partial', label: 'Részben fizetve', color: 'warning' }
    }
  }

  const paymentStatus = getPaymentStatus()
  const validFinalTotal = finalTotal || 0
  const remaining = validFinalTotal - (parseFloat(amount) || 0)

  const handleSubmit = async () => {
    // Validation
    const paidAmount = parseFloat(amount)
    
    if (isNaN(paidAmount) || paidAmount < 0) {
      setError('Kérjük, adj meg egy érvényes összeget (0 vagy pozitív)!')
      return
    }

    if (paidAmount > validFinalTotal) {
      setError(`A befizetett összeg nem lehet nagyobb, mint a végösszeg (${formatCurrency(validFinalTotal)})!`)
      return
    }

    if (!paymentMethod) {
      setError('Kérjük, válassz fizetési módot!')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quote_id: quoteId,
          initial_payment: {
            amount: paidAmount,
            payment_method: paymentMethod,
            comment: comment || null
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba történt a megrendelés létrehozása során')
      }

      const data = await response.json()
      
      toast.success(`Megrendelés létrehozva: ${data.order_number}`)
      onSuccess(data.quote_id, data.order_number)
      onClose()
      
    } catch (err) {
      console.error('Order creation error:', err)
      setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt')
      toast.error('Hiba a megrendelés létrehozása során!')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value) + ' Ft'
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow empty, numbers, and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
    }
  }

  return (
    <Dialog 
      open={open} 
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Megrendelés létrehozása
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {/* Quote Info */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Árajánlat: <strong>{quoteNumber}</strong>
            </Typography>
            <Typography variant="h6" sx={{ mt: 1 }}>
              Végösszeg: <strong>{formatCurrency(validFinalTotal)}</strong>
            </Typography>
          </Box>

          {/* Payment Amount */}
          <TextField
            fullWidth
            label="Befizetett összeg"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0"
            required
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: <InputAdornment position="end">Ft</InputAdornment>
            }}
            helperText="Adj meg 0-t, ha nincs előleg"
          />

          {/* Payment Method */}
          <FormControl fullWidth sx={{ mb: 2 }} required>
            <InputLabel>Fizetési mód</InputLabel>
            <Select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              label="Fizetési mód"
            >
              <MenuItem value="cash">Készpénz</MenuItem>
              <MenuItem value="transfer">Utalás</MenuItem>
              <MenuItem value="card">Bankkártya</MenuItem>
            </Select>
          </FormControl>

          {/* Comment */}
          <TextField
            fullWidth
            label="Megjegyzés"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Opcionális megjegyzés..."
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />

          {/* Payment Status Info */}
          <Alert 
            severity={paymentStatus.color as any}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2">
              <strong>Fizetési állapot:</strong> {paymentStatus.label}
            </Typography>
            {remaining > 0 && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Hátralék: <strong>{formatCurrency(remaining)}</strong>
              </Typography>
            )}
            {remaining < 0 && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Túlfizetés: <strong>{formatCurrency(Math.abs(remaining))}</strong>
              </Typography>
            )}
          </Alert>

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button 
          onClick={onClose}
          disabled={isSubmitting}
        >
          Mégse
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting}
          startIcon={isSubmitting && <CircularProgress size={16} />}
          color="success"
        >
          {isSubmitting ? 'Létrehozás...' : 'Megrendelés'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

