'use client'

// React Imports
import React, { useState } from 'react'

// Next Imports
import { useRouter } from 'next/navigation'

// MUI Imports
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'

// Third-party Imports
import classnames from 'classnames'
import { supabase } from '@/lib/supabase-client'
import { toast } from 'react-toastify'

// Type Imports
import type { Mode } from '@core/types'

// Component Imports
import Link from '@components/Link'
import Squares from '@/components/Squares'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

const ForgotPasswordV2 = ({ mode }: { mode: Mode }) => {
  // States
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Hooks
  const router = useRouter()
  const { settings } = useSettings()

  // Validate email format
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Handle forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      toast.error('Kérjük, adja meg az e-mail címét')
      return
    }

    if (!isValidEmail(email.trim())) {
      toast.error('Kérjük, adjon meg egy érvényes e-mail címet')
      return
    }

    if (isLoading) return
    
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/reset-password`
        }
      )

      if (error) {
        console.error('Password reset error:', error)
        toast.error('Hiba történt. Kérjük, próbálja újra!')
      } else {
        toast.success('Jelszó visszaállítási link elküldve! Kérjük, ellenőrizze az e-mail fiókját.')
        // Redirect to login after success
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      }
    } catch (error) {
      console.error('Password reset exception:', error)
      toast.error('Váratlan hiba történt')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='flex bs-full justify-center'>
      <div
        className={classnames(
          'flex bs-full items-center justify-center flex-1 min-bs-[100dvh] relative max-md:hidden',
          {
            'border-ie': settings.skin === 'bordered'
          }
        )}
        style={{ padding: 0, overflow: 'hidden' }}
      >
        <Squares
          squareSize={40}
          borderColor='#666'
          hoverFillColor='#333'
        />
        {/* Full-section overlay with vignette */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.65)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            WebkitMaskImage: 'radial-gradient(ellipse 60% 70% at center, black 20%, transparent 75%)',
            maskImage: 'radial-gradient(ellipse 60% 70% at center, black 20%, transparent 75%)',
            pointerEvents: 'none',
            zIndex: 5
          }}
        />
        {/* Logo centered on top */}
        <div 
          className="absolute"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            pointerEvents: 'none'
          }}
        >
          <img 
            src='/images/turinova-logo.png' 
            alt='Turinova Logo' 
            style={{ height: '112px', width: 'auto', objectFit: 'contain' }}
          />
        </div>
      </div>
      <div className='flex justify-center items-center bs-full bg-backgroundPaper !min-is-full p-6 md:!min-is-[unset] md:p-12 md:is-[480px]'>
        <div className='flex flex-col gap-5 is-full sm:is-auto md:is-full sm:max-is-[400px] md:max-is-[unset] mbs-11 sm:mbs-14 md:mbs-0'>
          <div>
            <Typography variant='h4'>Elfelejtett jelszó</Typography>
            <Typography className='mbs-1'>
              Kérjük, adja meg az e-mail címét, ahova elküldjük a jelszó visszaállítási linket
            </Typography>
          </div>
          <form
            noValidate
            autoComplete='off'
            onSubmit={handleForgotPassword}
            className='flex flex-col gap-5'
          >
            <TextField 
              autoFocus 
              fullWidth 
              label='E-mail cím' 
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder='pelda@email.hu'
            />
            <Button 
              fullWidth 
              variant='contained' 
              type='submit'
              disabled={isLoading}
            >
              {isLoading ? 'Küldés...' : 'Visszaállítási link küldése'}
            </Button>
            <Button 
              fullWidth 
              variant='outlined' 
              component={Link}
              href='/login'
            >
              Vissza a bejelentkezéshez
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordV2

