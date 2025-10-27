'use client'

// React Imports
import React, { useState, useEffect } from 'react'

// Next Imports
import { useRouter } from 'next/navigation'

// MUI Imports
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'

// Third-party Imports
import classnames from 'classnames'
import { supabase } from '@/lib/supabase-client'
import { toast } from 'react-toastify'

// Type Imports
import type { Mode } from '@core/types'

// Component Imports
import Squares from '@/components/Squares'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

const ResetPasswordV2 = ({ mode }: { mode: Mode }) => {
  // States
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [isConfirmPasswordShown, setIsConfirmPasswordShown] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isValidToken, setIsValidToken] = useState(false)

  // Hooks
  const router = useRouter()
  const { settings } = useSettings()

  const handleClickShowPassword = () => setIsPasswordShown(show => !show)
  const handleClickShowConfirmPassword = () => setIsConfirmPasswordShown(show => !show)

  // Check if user has valid reset token
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setIsValidToken(true)
        } else {
          toast.error('Érvénytelen vagy lejárt visszaállítási link')
          setTimeout(() => {
            router.push('/login')
          }, 2000)
        }
      } catch (error) {
        console.error('Error checking session:', error)
        toast.error('Hiba történt')
        router.push('/login')
      }
    }
    checkSession()
  }, [router])

  // Handle password reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!password.trim()) {
      toast.error('Kérjük, adjon meg egy új jelszót')
      return
    }

    if (password.length < 8) {
      toast.error('A jelszónak legalább 8 karakter hosszúnak kell lennie')
      return
    }

    if (password !== confirmPassword) {
      toast.error('A két jelszó nem egyezik')
      return
    }

    if (isLoading) return
    
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        console.error('Password update error:', error)
        toast.error('Hiba történt a jelszó módosítása során')
      } else {
        toast.success('Jelszó sikeresen megváltoztatva!')
        // Sign out and redirect to login
        await supabase.auth.signOut()
        setTimeout(() => {
          router.push('/login')
        }, 1500)
      }
    } catch (error) {
      console.error('Password reset exception:', error)
      toast.error('Váratlan hiba történt')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isValidToken) {
    return (
      <div className='flex bs-full justify-center items-center'>
        <Typography>Ellenőrzés...</Typography>
      </div>
    )
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
            <Typography variant='h4'>Új jelszó megadása</Typography>
            <Typography className='mbs-1'>
              Kérjük, adja meg az új jelszavát
            </Typography>
          </div>
          <form
            noValidate
            autoComplete='off'
            onSubmit={handleResetPassword}
            className='flex flex-col gap-5'
          >
            <TextField
              autoFocus
              fullWidth
              label='Új jelszó'
              type={isPasswordShown ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton
                        size='small'
                        edge='end'
                        onClick={handleClickShowPassword}
                        onMouseDown={e => e.preventDefault()}
                      >
                        <i className={isPasswordShown ? 'ri-eye-off-line' : 'ri-eye-line'} />
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />
            <TextField
              fullWidth
              label='Jelszó megerősítése'
              type={isConfirmPasswordShown ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton
                        size='small'
                        edge='end'
                        onClick={handleClickShowConfirmPassword}
                        onMouseDown={e => e.preventDefault()}
                      >
                        <i className={isConfirmPasswordShown ? 'ri-eye-off-line' : 'ri-eye-line'} />
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />
            <Typography variant='caption' color='text.secondary'>
              A jelszónak legalább 8 karakter hosszúnak kell lennie
            </Typography>
            <Button 
              fullWidth 
              variant='contained' 
              type='submit'
              disabled={isLoading}
            >
              {isLoading ? 'Mentés...' : 'Jelszó mentése'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordV2

