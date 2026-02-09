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
  CircularProgress,
  Divider
} from '@mui/material'
import { toast } from 'react-toastify'

interface AddPaymentModalProps {
  open: boolean
  onClose: () => void
  quoteId: string
  orderNumber: string
  finalTotal: number
  totalPaid: number // Sum of existing payments
  onSuccess: () => void
  apiPath?: string // Optional API path, defaults to '/api/quotes/[id]/payments'
}

export default function AddPaymentModal({
  open,
  onClose,
  quoteId,
  orderNumber,
  finalTotal,
  totalPaid,
  onSuccess,
  apiPath
}: AddPaymentModalProps) {
  
  const [amount, setAmount] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [comment, setComment] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate remaining balance (round to nearest integer to avoid floating point precision issues)
  // Round each value first, then subtract to match API calculation
  const roundedFinalTotal = Math.round(finalTotal)
  const roundedTotalPaid = Math.round(totalPaid)
  const remainingBalance = roundedFinalTotal - roundedTotalPaid

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setAmount('')
      setPaymentMethod('cash')
      setComment('')
      setError(null)
    }
  }, [open])

  // Auto-format amount to max remaining if user enters more
  useEffect(() => {
    const numAmount = parseFloat(amount)
    // remainingBalance is already rounded to nearest integer
    if (!isNaN(numAmount) && numAmount > remainingBalance && remainingBalance > 0) {
      // Allow up to 1 Ft over for rounding tolerance
      const maxAmount = remainingBalance + 1
      if (numAmount > maxAmount) {
        setAmount(remainingBalance.toString())
      }
    }
  }, [amount, remainingBalance])

  // Calculate what payment status will be after this payment
  const getNewPaymentStatus = () => {
    const paidAmount = parseFloat(amount) || 0
    // Round to nearest integer to avoid floating point precision issues
    const roundedPaidAmount = Math.round(paidAmount)
    const roundedTotalPaid = Math.round(totalPaid)
    const roundedFinalTotal = Math.round(finalTotal)
    const newTotal = roundedTotalPaid + roundedPaidAmount
    
    // Add 1 Ft tolerance for rounding differences
    const TOLERANCE = 1.0
    
    if (newTotal === 0) {
      return { status: 'not_paid', label: 'Nincs fizetve', color: 'error' }
    } else if (newTotal >= roundedFinalTotal - TOLERANCE) {
      return { status: 'paid', label: 'Kifizetve', color: 'success' }
    } else {
      return { status: 'partial', label: 'Részben fizetve', color: 'warning' }
    }
  }

  const newPaymentStatus = getNewPaymentStatus()

  const handleSubmit = async () => {
    // Validation
    const paidAmount = parseFloat(amount)
    
    if (isNaN(paidAmount)) {
      setError('Kérjük, adj meg egy érvényes összeget!')
      return
    }

    // Recalculate remaining balance with proper rounding to ensure accuracy
    // Use the same calculation as the component-level remainingBalance to ensure consistency
    const roundedFinalTotal = Math.round(finalTotal)
    const roundedTotalPaid = Math.round(totalPaid)
    const calculatedRemainingBalance = roundedFinalTotal - roundedTotalPaid
    
    // Round paid amount to nearest integer to avoid floating point precision issues
    const roundedPaidAmount = Math.round(paidAmount)

    // Allow negative amounts (refunds)
    // But positive amounts cannot exceed remaining balance (allow up to 1 Ft over due to rounding)
    if (roundedPaidAmount > 0 && roundedPaidAmount > calculatedRemainingBalance + 1) {
      // Double-check rounding for display
      const displayRemainingBalance = Math.round(calculatedRemainingBalance)
      setError(`Az összeg nem lehet nagyobb, mint a hátralék (${formatCurrency(displayRemainingBalance)})!`)
      return
    }

    if (!paymentMethod) {
      setError('Kérjük, válassz fizetési módot!')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      // Use apiPath if provided, otherwise default to quotes payments endpoint
      const endpoint = apiPath || `/api/quotes/${quoteId}/payments`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: roundedPaidAmount,
          payment_method: paymentMethod,
          comment: comment || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Hiba történt a fizetés rögzítése során')
      }

      toast.success('Fizetés sikeresen rögzítve!')
      onSuccess()
      onClose()
      
    } catch (err) {
      console.error('Payment error:', err)
      setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt')
      toast.error('Hiba a fizetés rögzítése során!')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatCurrency = (value: number | string) => {
    // Ensure value is a number and round to nearest integer to avoid decimal display issues
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(numValue)) return '0 Ft'
    const roundedValue = Math.round(numValue)
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(roundedValue) + ' Ft'
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow empty, numbers, decimal point, and minus sign (for refunds)
    if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
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
        Fizetés hozzáadása
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {/* Order Info */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Megrendelés: <strong>{orderNumber}</strong>
            </Typography>
            
            <Divider sx={{ my: 1 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">
                Végösszeg:
              </Typography>
              <Typography variant="body2">
                <strong>{formatCurrency(finalTotal)}</strong>
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">
                Eddig fizetve:
              </Typography>
              <Typography variant="body2" color="info.main">
                <strong>{formatCurrency(totalPaid)}</strong>
              </Typography>
            </Box>
            
            <Divider sx={{ my: 1 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body1">
                <strong>Hátralék:</strong>
              </Typography>
              <Typography variant="body1" color={remainingBalance > 0 ? 'error.main' : 'success.main'}>
                <strong>{formatCurrency(remainingBalance)}</strong>
              </Typography>
            </Box>
          </Box>

          {/* Payment Amount */}
          <TextField
            fullWidth
            label="Összeg"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0"
            required
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: <InputAdornment position="end">Ft</InputAdornment>
            }}
            helperText="Pozitív összeg fizetéshez, negatív visszatérítéshez"
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

          {/* New Payment Status Preview */}
          {amount && parseFloat(amount) !== 0 && (
            <Alert 
              severity={newPaymentStatus.color as any}
              sx={{ mb: 2 }}
            >
              <Typography variant="body2">
                <strong>Új fizetési állapot:</strong> {newPaymentStatus.label}
              </Typography>
              {parseFloat(amount) > 0 && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Új hátralék: <strong>{formatCurrency(Math.round(remainingBalance - parseFloat(amount)))}</strong>
                </Typography>
              )}
            </Alert>
          )}

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
          color="primary"
        >
          {isSubmitting ? 'Mentés...' : 'Mentés'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

