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
import Checkbox from '@mui/material/Checkbox'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'

// Third-party Imports
import classnames from 'classnames'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-toastify'

// Type Imports
import type { Mode } from '@core/types'

// Component Imports
import Link from '@components/Link'
import Logo from '@components/layout/shared/Logo'
import Squares from '@/components/Squares'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import { useSettings } from '@core/hooks/useSettings'

const LoginV2 = ({ mode }: { mode: Mode }) => {
  // States
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState(null)

  // Vars
  const darkImg = '/images/pages/auth-v2-mask-1-dark.png'
  const lightImg = '/images/pages/auth-v2-mask-1-light.png'
  const darkIllustration = '/images/illustrations/auth/v2-login-dark.png'
  const lightIllustration = '/images/illustrations/auth/v2-login-light.png'
  const borderedDarkIllustration = '/images/illustrations/auth/v2-login-dark-border.png'
  const borderedLightIllustration = '/images/illustrations/auth/v2-login-light-border.png'

  // Hooks
  const router = useRouter()
  const { settings } = useSettings()
  const authBackground = useImageVariant(mode, lightImg, darkImg)
  // Using the shared supabase instance

  const characterIllustration = useImageVariant(
    mode,
    lightIllustration,
    darkIllustration,
    borderedLightIllustration,
    borderedDarkIllustration
  )

  const handleClickShowPassword = () => setIsPasswordShown(show => !show)

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          setUser(session.user)
          // Let middleware handle the redirect to avoid conflicts
          // router.push('/home')
        }
      } catch (error) {
        console.error('Error checking session:', error)
        // Don't set user if there's an error
      }
    }

    checkUser()
  }, [supabase.auth, router])

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent multiple simultaneous login attempts
    if (isLoading) return
    
    setIsLoading(true)

    try {
      // Add a small delay to prevent rapid-fire requests
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        console.error('Login error:', error)
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          toast.error('Túl sok bejelentkezési kísérlet. Kérjük, várjon egy kicsit és próbálja újra.')
        } else {
          toast.error(error.message)
        }
      } else if (data.user) {
        console.log('Login successful, user:', data.user.email)
        toast.success('Sikeres bejelentkezés!')
        setUser(data.user)
        
        // Redirect to home after successful login
        // Verify session exists before redirecting to ensure middleware compatibility
        const verifyAndRedirect = async () => {
          try {
            // Wait a moment for session to be established
            await new Promise(resolve => setTimeout(resolve, 200))
            
            // Verify session exists
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
              // Session confirmed, redirect with fast client-side navigation
              router.push('/home')
            } else {
              // Fallback: force page reload if session not found
              window.location.href = '/home'
            }
          } catch (error) {
            console.error('Session verification error:', error)
            // Fallback: force page reload on error
            window.location.href = '/home'
          }
        }
        
        verifyAndRedirect()
      }
    } catch (error) {
      console.error('Login exception:', error)
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
            transform: 'translate(-50%, -50%) scale(3.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            pointerEvents: 'none'
          }}
        >
          <Logo />
        </div>
      </div>
      <div className='flex justify-center items-center bs-full bg-backgroundPaper !min-is-full p-6 md:!min-is-[unset] md:p-12 md:is-[480px]'>
        <div className='flex flex-col gap-5 is-full sm:is-auto md:is-full sm:max-is-[400px] md:max-is-[unset] mbs-11 sm:mbs-14 md:mbs-0'>
          <div>
            <Typography variant='h4'>{`Üdvözöljük a ${themeConfig.templateName} rendszerben! 👋🏻`}</Typography>
            <Typography className='mbs-1'>Kérjük, jelentkezzen be a fiókjába</Typography>
          </div>
          <form
            noValidate
            autoComplete='off'
            onSubmit={handleLogin}
            className='flex flex-col gap-5'
          >
            <TextField 
              autoFocus 
              fullWidth 
              label='Email cím' 
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label='Jelszó'
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
            <div className='flex justify-between items-center flex-wrap gap-x-3 gap-y-1'>
              <FormControlLabel control={<Checkbox />} label='Emlékezz rám' />
              <Typography className='text-end' color='primary.main' component={Link}>
                Elfelejtett jelszó?
              </Typography>
            </div>
            <Button 
              fullWidth 
              variant='contained' 
              type='submit'
              disabled={isLoading}
            >
              {isLoading ? 'Bejelentkezés...' : 'Bejelentkezés'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginV2
