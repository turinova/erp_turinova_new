'use client'

import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert
} from '@mui/material'
import { Delete as DeleteIcon } from '@mui/icons-material'

interface DeleteConfirmationModalProps {
  open: boolean
  orderCount: number
  onConfirm: () => void
  onClose: () => void
}

export default function DeleteConfirmationModal({
  open,
  orderCount,
  onConfirm,
  onClose
}: DeleteConfirmationModalProps) {
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Megrendelések törlése
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Ez a művelet visszavonhatatlan!
        </Alert>

        <Typography variant="body1" gutterBottom>
          Biztosan törölni szeretnéd a kijelölt <strong>{orderCount} megrendelést</strong>?
        </Typography>

        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            A megrendelések státusza <strong>"Törölve"</strong> állapotra változik, és a gyártási adatok (vonalkód, gép, dátum) törlődnek.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button 
          onClick={onClose} 
          variant="outlined"
          size="large"
        >
          Mégse
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained"
          color="error"
          size="large"
          startIcon={<DeleteIcon />}
        >
          Törlés
        </Button>
      </DialogActions>
    </Dialog>
  )
}

