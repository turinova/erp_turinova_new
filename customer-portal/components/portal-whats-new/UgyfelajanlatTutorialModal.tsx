'use client'

import React, { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import Link from 'next/link'

import { UGYFELAJANLAT_TUTORIAL_STEPS } from './UgyfelajanlatMocks'

type Props = {
  open: boolean
  onClose: () => void
  initialStep?: number
}

export default function UgyfelajanlatTutorialModal({
  open,
  onClose,
  initialStep = 0
}: Props) {
  const [step, setStep] = useState(0)
  const total = UGYFELAJANLAT_TUTORIAL_STEPS.length
  const current = UGYFELAJANLAT_TUTORIAL_STEPS[step]
  const Mock = current.Mock
  const isLast = step === total - 1

  useEffect(() => {
    if (open) {
      setStep(Math.min(Math.max(0, initialStep), total - 1))
    }
  }, [open, initialStep, total])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ pr: 6, pb: 1 }}>
        <Typography variant="overline" color="success.main" sx={{ fontWeight: 700 }}>
          Egyszerű útmutató · {step + 1} / {total}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
          {current.title}
        </Typography>
        <IconButton
          aria-label="Bezárás"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.55 }}>
          {current.caption}
        </Typography>
        <Box sx={{ maxWidth: 560, mx: 'auto' }}>
          <Mock />
        </Box>
        <Stack direction="row" justifyContent="center" spacing={0.75} sx={{ mt: 2 }}>
          {UGYFELAJANLAT_TUTORIAL_STEPS.map((_, i) => (
            <Box
              key={i}
              sx={{
                width: i === step ? 18 : 8,
                height: 8,
                borderRadius: 99,
                bgcolor: i === step ? 'success.main' : 'action.disabledBackground',
                transition: 'width 0.2s'
              }}
            />
          ))}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          disabled={step === 0}
          onClick={() => setStep(s => s - 1)}
        >
          Előző
        </Button>
        <Box sx={{ flex: 1 }} />
        {!isLast ? (
          <Button
            variant="contained"
            color="success"
            endIcon={<ArrowForwardIcon />}
            onClick={() => setStep(s => s + 1)}
          >
            Következő
          </Button>
        ) : (
          <Button
            component={Link}
            href="/saved"
            variant="contained"
            color="success"
            onClick={onClose}
          >
            Mentett ajánlatok megnyitása
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
