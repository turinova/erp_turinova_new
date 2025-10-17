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
import Divider from '@mui/material/Divider'

// Third-party Imports
import classnames from 'classnames'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-toastify'

// Type Imports
import type { Mode } from '@core/types'

// Component Imports
import Link from '@components/Link'
import Logo from '@components/layout/shared/Logo'

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
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setUser(user)
        // Let middleware handle the redirect to avoid conflicts
        // router.push('/home')
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
          'flex bs-full items-center justify-center flex-1 min-bs-[100dvh] relative p-6 max-md:hidden',
          {
            'border-ie': settings.skin === 'bordered'
          }
        )}
      >
        <div className='pli-6 max-lg:mbs-40 lg:mbe-24'>
          <img
            src={characterIllustration}
            alt='character-illustration'
            className='max-bs-[673px] max-is-full bs-auto'
          />
        </div>
        <img src={authBackground} className='absolute bottom-[4%] z-[-1] is-full max-md:hidden' />
      </div>
      <div className='flex justify-center items-center bs-full bg-backgroundPaper !min-is-full p-6 md:!min-is-[unset] md:p-12 md:is-[480px]'>
        <Link className='absolute block-start-5 sm:block-start-[38px] inline-start-6 sm:inline-start-[38px]'>
          <Logo />
        </Link>
        <div className='flex flex-col gap-5 is-full sm:is-auto md:is-full sm:max-is-[400px] md:max-is-[unset] mbs-11 sm:mbs-14 md:mbs-0'>
          <div>
            <Typography variant='h4'>{`Welcome to ${themeConfig.templateName}! 👋🏻`}</Typography>
            <Typography className='mbs-1'>Please sign-in to your account and start the adventure</Typography>
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
              label='Email' 
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label='Password'
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
              <FormControlLabel control={<Checkbox />} label='Remember me' />
              <Typography className='text-end' color='primary.main' component={Link}>
                Forgot password?
              </Typography>
            </div>
            <Button 
              fullWidth 
              variant='contained' 
              type='submit'
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Log In'}
            </Button>
            <div className='flex justify-center items-center flex-wrap gap-2'>
              <Typography>New on our platform?</Typography>
              <Typography component={Link} color='primary.main'>
                Create an account
              </Typography>
            </div>
            <Divider className='gap-3 text-textPrimary'>or</Divider>
            <div className='flex justify-center items-center gap-2'>
              <IconButton size='small' className='text-facebook'>
                <i className='ri-facebook-fill' />
              </IconButton>
              <IconButton size='small' className='text-twitter'>
                <i className='ri-twitter-fill' />
              </IconButton>
              <IconButton size='small' className='text-textPrimary'>
                <i className='ri-github-fill' />
              </IconButton>
              <IconButton size='small' className='text-googlePlus'>
                <i className='ri-google-fill' />
              </IconButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginV2
