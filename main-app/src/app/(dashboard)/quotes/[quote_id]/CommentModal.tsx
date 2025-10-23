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
import { Save as SaveIcon } from '@mui/icons-material'

interface CommentModalProps {
  open: boolean
  onClose: () => void
  onSave: (comment: string) => Promise<void>
  initialComment: string | null
  quoteNumber: string
}

export default function CommentModal({ 
  open, 
  onClose, 
  onSave, 
  initialComment,
  quoteNumber 
}: CommentModalProps) {
  const [comment, setComment] = useState(initialComment || '')
  const [isSaving, setIsSaving] = useState(false)

  // Update comment when modal opens with new initial value
  useEffect(() => {
    if (open) {
      setComment(initialComment || '')
    }
  }, [open, initialComment])

  const handleSave = async () => {
    console.log('[MODAL] handleSave clicked!')
    console.log('[MODAL] Comment to save:', comment)
    setIsSaving(true)
    try {
      console.log('[MODAL] Calling onSave...')
      await onSave(comment)
      console.log('[MODAL] onSave completed successfully')
      onClose()
    } catch (error) {
      console.error('[MODAL] Error saving comment:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    if (!isSaving) {
      onClose()
    }
  }

  const charCount = comment.length
  const maxChars = 250
  const isOverLimit = charCount > maxChars

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h6" component="div">
          Megjegyzés
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {quoteNumber}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={6}
            label="Megjegyzés"
            placeholder="Írj megjegyzést az árajánlathoz/megrendeléshez..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            error={isOverLimit}
            disabled={isSaving}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5, px: 1.75 }}>
            <Typography variant="caption" color={isOverLimit ? 'error' : 'text.secondary'}>
              {isOverLimit && 'Túl hosszú megjegyzés! '}
              Maximum 250 karakter
            </Typography>
            <Typography variant="caption" color={isOverLimit ? 'error' : 'text.secondary'}>
              {charCount}/{maxChars}
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button 
          onClick={handleClose} 
          disabled={isSaving}
        >
          Mégse
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={isSaving || isOverLimit}
          startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
        >
          {isSaving ? 'Mentés...' : 'Mentés'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

