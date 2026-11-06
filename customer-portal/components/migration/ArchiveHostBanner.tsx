'use client'

import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import {
  ARCHIVE_HOST_BANNER_BODY,
  ARCHIVE_HOST_BANNER_TITLE,
  NEW_SYSTEM_LABEL,
  NEW_SYSTEM_URL
} from '@/lib/archive-host'

/** Shown when the app is served on archiv.turinova.hu (Phase 1+). */
export function ArchiveHostBanner() {
  return (
    <Alert severity='info' variant='outlined' role='region' aria-label='Archívum felület'>
      <AlertTitle>{ARCHIVE_HOST_BANNER_TITLE}</AlertTitle>
      <Stack spacing={1.5}>
        <Typography variant='body2' color='inherit'>
          {ARCHIVE_HOST_BANNER_BODY}
        </Typography>
        <Button
          component='a'
          href={NEW_SYSTEM_URL}
          target='_blank'
          rel='noopener noreferrer'
          variant='contained'
          size='small'
          sx={{ alignSelf: 'flex-start' }}
        >
          Új rendszer ({NEW_SYSTEM_LABEL})
        </Button>
      </Stack>
    </Alert>
  )
}
