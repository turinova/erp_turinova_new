'use client'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

// Type Imports
import type { Mode } from '@core/types'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

const UnderMaintenance = ({ mode }: { mode: Mode }) => {
  // Vars
  const darkImg = '/images/pages/misc-mask-1-dark.png'
  const lightImg = '/images/pages/misc-mask-1-light.png'

  // Hooks
  const miscBackground = useImageVariant(mode, lightImg, darkImg)

  return (
    <div className='flex items-center justify-center min-bs-[100dvh] relative p-6 overflow-x-hidden'>
      <div className='flex items-center flex-col text-center gap-10'>
        <div className='flex flex-col gap-2 is-[90vw] sm:is-[unset]'>
          <Typography className='font-medium text-8xl' color='text.primary'>
            🚧
          </Typography>
          <Typography variant='h4'>Under Maintenance!</Typography>
          <Typography variant='h6' color='text.secondary'>
            Sorry for the inconvenience but we're performing some maintenance at the moment
          </Typography>
        </div>
        <img
          alt='error-illustration'
          src='/images/illustrations/characters/3.png'
          className='object-cover bs-[400px] md:bs-[450px] lg:bs-[500px]'
        />
        <Box className='flex flex-col gap-4'>
          <Button href='/' component={Link} variant='contained' size='large'>
            Back to Home
          </Button>
          <Typography variant='body2' color='text.secondary'>
            We'll be back online shortly. Thank you for your patience!
          </Typography>
        </Box>
      </div>
      <img src={miscBackground} className='absolute bottom-0 z-[-1] is-full max-md:hidden' />
    </div>
  )
}

export default UnderMaintenance
