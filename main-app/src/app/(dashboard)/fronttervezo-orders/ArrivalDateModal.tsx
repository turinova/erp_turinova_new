'use client'

import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress
} from '@mui/material'

interface ArrivalDateModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (arrivalDate: string) => Promise<void> | void
  title?: string
  orderCount?: number
}

function todayIsoDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ArrivalDateModal({
  open,
  onClose,
  onConfirm,
  title = 'Beérkezés rögzítése',
  orderCount = 1
}: ArrivalDateModalProps) {
  const [arrivalDate, setArrivalDate] = useState(todayIsoDate())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setArrivalDate(todayIsoDate())
      setError(null)
      setIsSubmitting(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!arrivalDate) {
      setError('A beérkezés dátuma kötelező')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      await onConfirm(arrivalDate)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mentés sikertelen')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {orderCount > 1 && (
          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
            {orderCount} megrendelés Beérkezett státuszra állítása
          </Alert>
        )}
        <TextField
          fullWidth
          required
          type="date"
          label="Beérkezés dátuma"
          value={arrivalDate}
          onChange={e => setArrivalDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ mt: orderCount > 1 ? 0 : 2 }}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          Mégse
        </Button>
        <Button
          variant="contained"
          color="info"
          onClick={handleSubmit}
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : undefined}
        >
          {isSubmitting ? 'Mentés...' : 'Beérkezett'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
