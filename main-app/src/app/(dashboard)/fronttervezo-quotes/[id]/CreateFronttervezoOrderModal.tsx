'use client'

import React, { useEffect, useState } from 'react'
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

interface CreateFronttervezoOrderModalProps {
  open: boolean
  onClose: () => void
  quoteId: string
  quoteNumber: string
  finalTotal: number
  onSuccess: (orderId: string, orderNumber: string) => void
}

export default function CreateFronttervezoOrderModal({
  open,
  onClose,
  quoteId,
  quoteNumber,
  finalTotal,
  onSuccess
}: CreateFronttervezoOrderModalProps) {
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [comment, setComment] = useState('')
  const [expectedArrivalDate, setExpectedArrivalDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount('')
      setPaymentMethod('cash')
      setComment('')
      setExpectedArrivalDate('')
      setError(null)
    }
  }, [open, finalTotal])

  const getPaymentStatus = () => {
    const paidAmount = parseFloat(amount) || 0
    const validFinalTotal = finalTotal || 0

    if (paidAmount === 0) {
      return { status: 'not_paid', label: 'Nincs fizetve', color: 'error' as const }
    }
    if (paidAmount >= validFinalTotal) {
      return { status: 'paid', label: 'Kifizetve', color: 'success' as const }
    }
    return { status: 'partial', label: 'Részben fizetve', color: 'warning' as const }
  }

  const paymentStatus = getPaymentStatus()
  const validFinalTotal = finalTotal || 0
  const remaining = validFinalTotal - (parseFloat(amount) || 0)

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value) + ' Ft'

  const handleSubmit = async () => {
    const paidAmount = parseFloat(amount)

    if (isNaN(paidAmount) || paidAmount < 0) {
      setError('Kérjük, adj meg egy érvényes összeget (0 vagy pozitív)!')
      return
    }

    if (paidAmount > validFinalTotal) {
      setError(
        `A befizetett összeg nem lehet nagyobb, mint a végösszeg (${formatCurrency(validFinalTotal)})!`
      )
      return
    }

    if (!paymentMethod) {
      setError('Kérjük, válassz fizetési módot!')
      return
    }

    if (!expectedArrivalDate) {
      setError('A várható szállítási dátum kötelező!')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/fronttervezo-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote_id: quoteId,
          expected_arrival_date: expectedArrivalDate,
          initial_payment: {
            amount: paidAmount,
            payment_method: paymentMethod,
            comment: comment || null
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Hiba történt a megrendelés létrehozása során'
        const errorDetails = errorData.details ? ` (${errorData.details})` : ''
        throw new Error(errorMessage + errorDetails)
      }

      const data = await response.json()
      toast.success(`Megrendelés létrehozva: ${data.order_number}`)
      onSuccess(data.quote_id, data.order_number)
      onClose()
    } catch (err) {
      console.error('Fronttervezo order creation error:', err)
      setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt')
      toast.error('Hiba a megrendelés létrehozása során!')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
    }
  }

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Megrendelés létrehozása</DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Árajánlat: <strong>{quoteNumber}</strong>
            </Typography>
            <Typography variant="h6" sx={{ mt: 1 }}>
              Végösszeg: <strong>{formatCurrency(validFinalTotal)}</strong>
            </Typography>
          </Box>

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

          <FormControl fullWidth sx={{ mb: 2 }} required>
            <InputLabel>Fizetési mód</InputLabel>
            <Select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              label="Fizetési mód"
            >
              <MenuItem value="cash">Készpénz</MenuItem>
              <MenuItem value="transfer">Utalás</MenuItem>
              <MenuItem value="card">Bankkártya</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            required
            type="date"
            label="Várható szállítási dátum"
            value={expectedArrivalDate}
            onChange={e => setExpectedArrivalDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Megjegyzés"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Opcionális megjegyzés..."
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />

          <Alert severity={paymentStatus.color} sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Fizetési állapot:</strong> {paymentStatus.label}
            </Typography>
            {remaining > 0 && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Hátralék: <strong>{formatCurrency(remaining)}</strong>
              </Typography>
            )}
          </Alert>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          Mégse
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : undefined}
          color="success"
        >
          {isSubmitting ? 'Létrehozás...' : 'Megrendelés'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
