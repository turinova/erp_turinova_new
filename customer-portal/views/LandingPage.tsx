'use client'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'

// Type Imports
import type { Mode } from '@core/types'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import {
  REGISTRATION_CLOSED,
  REGISTRATION_CLOSED_MESSAGE,
  REGISTRATION_CLOSED_TITLE
} from '@/lib/migration-notice'

const LandingPage = ({ mode }: { mode: Mode }) => {
  // Vars
  const darkImg = '/images/pages/misc-mask-1-dark.png'
  const lightImg = '/images/pages/misc-mask-1-light.png'

  // Hooks
  const miscBackground = useImageVariant(mode, lightImg, darkImg)

  return (
    <div className='flex items-center justify-center bs-full relative p-6 overflow-x-hidden'>
      <div className='flex items-center flex-col text-center gap-10'>
        {/* Logo */}
        <Box sx={{ mb: 2 }}>
          <img
            src='/images/turinova-logo.png'
            alt='Turinova Logo'
            style={{ height: '80px', width: 'auto', objectFit: 'contain' }}
          />
        </Box>

        {/* Welcome Message */}
        <div className='flex flex-col gap-2 is-[90vw] sm:is-[unset]'>
          <Typography variant='h3' className='font-medium' color='text.primary'>
            Turinova Felhasználói Portál
          </Typography>
          <Typography variant='h6' color='text.secondary' sx={{ mt: 2 }}>
            Készítsen árajánlatot és kövesse nyomon rendeléseit
          </Typography>
        </div>

        {REGISTRATION_CLOSED ? (
          <Box sx={{ maxWidth: 480, width: '100%' }}>
            <Alert severity='warning' variant='outlined' sx={{ textAlign: 'left', mb: 3 }}>
              <AlertTitle>{REGISTRATION_CLOSED_TITLE}</AlertTitle>
              {REGISTRATION_CLOSED_MESSAGE}
            </Alert>
            <Button
              href='/login'
              component={Link}
              variant='contained'
              color='primary'
              size='large'
              sx={{
                px: 6,
                py: 2,
                fontSize: '1.1rem',
                fontWeight: 600
              }}
            >
              Bejelentkezés
            </Button>
          </Box>
        ) : (
          <Button
            href='/register'
            component={Link}
            variant='contained'
            color='success'
            size='large'
            sx={{
              px: 6,
              py: 2,
              fontSize: '1.1rem',
              fontWeight: 600
            }}
          >
            Regisztráció
          </Button>
        )}
      </div>
      <img src={miscBackground} className='absolute bottom-0 z-[-1] is-full max-md:hidden' />
    </div>
  )
}

export default LandingPage
