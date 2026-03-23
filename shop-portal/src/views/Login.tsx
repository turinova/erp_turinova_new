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
import { resolveLandingPageFromPermissions } from '@/lib/auth-redirect'

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
  const [isRedirecting, setIsRedirecting] = useState(false)

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
    // Check for forced logout parameter
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('logout') === 'true') {
      // Clear all client-side storage
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
        // Clear tenant context specifically
        localStorage.removeItem('tenant_context')
        // Remove the logout parameter from URL
        window.history.replaceState({}, '', '/login')
      }
    }

    const checkUser = async () => {
      try {
        // Use tenant-aware client if available
        const { getTenantSupabaseBrowser } = await import('@/lib/tenant-supabase')
        const tenantSupabase = getTenantSupabaseBrowser()
        const { data: { session } } = await tenantSupabase.auth.getSession()

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
  }, [router])

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent multiple simultaneous login attempts
    if (isLoading) return
    
    setIsLoading(true)

    try {
      // Add a small delay to prevent rapid-fire requests
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Use new two-step authentication API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        const errorMessage = data.error || 'Bejelentkezési hiba történt'
        
        // Only show error if it's a real authentication failure
        // Don't show errors for network issues or temporary failures
        if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
          toast.error('Túl sok bejelentkezési kísérlet. Kérjük, várjon egy kicsit és próbálja újra.')
        } else if (errorMessage.includes('Invalid') || errorMessage.includes('credentials') || errorMessage.includes('invalid_credentials')) {
          // Only show error if response status is 401 (unauthorized)
          // This prevents showing errors for temporary network issues
          if (response.status === 401) {
            toast.error('Hibás e-mail cím vagy jelszó!')
          }
        } else if (errorMessage.includes('not found')) {
          toast.error('Felhasználó nem található!')
        } else if (response.status !== 500 && response.status !== 0) {
          // Don't show errors for server errors or network failures
          toast.error(errorMessage)
        }
        setIsLoading(false)
        return
      }

      // Login successful
      console.log('Login successful, user:', data.user.email, 'Type:', data.type)
      
      // Set redirecting flag immediately to prevent any error toasts during redirect
      setIsRedirecting(true)
      
      toast.success('Sikeres bejelentkezés!')
      
      // Store user info
      setUser(data.user)
      
      // For tenant users, store tenant context in localStorage for client-side access
      if (data.type === 'tenant' && data.tenant) {
        try {
          localStorage.setItem('tenant_context', JSON.stringify(data.tenant))
        } catch (error) {
          console.warn('Failed to store tenant context in localStorage:', error)
        }
        
        // Note: The API route already signs in to the tenant database and establishes the session
        // No need to sign in again here - this was causing duplicate sign-in attempts and errors
      }
      
      // Redirect to first permitted page after successful login
      const verifyAndRedirect = async () => {
        try {
          // Wait a moment for session to be established
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // For tenant users, use tenant-aware client to verify session
          if (data.type === 'tenant' && data.tenant) {
            const { getTenantSupabaseBrowser } = await import('@/lib/tenant-supabase')
            const tenantSupabase = getTenantSupabaseBrowser()
            
            // Verify session exists in tenant database
            const { data: { session } } = await tenantSupabase.auth.getSession()
            if (session) {
              // Fetch user permissions to find first accessible page
              const permissionsResponse = await fetch(`/api/permissions/user/${data.user.id}`)
              if (permissionsResponse.ok) {
                const permissions = await permissionsResponse.json()
                const redirectPath = resolveLandingPageFromPermissions(permissions)
                
                console.log('Redirecting to first permitted page:', redirectPath)
                router.push(redirectPath)
              } else {
                // Fallback: force page reload to let middleware handle redirect
                window.location.href = '/'
              }
            } else {
              // Fallback: force page reload if session not found
              window.location.href = '/'
            }
          } else {
            // For non-tenant users, use default client
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
              window.location.href = '/'
            } else {
              window.location.href = '/'
            }
          }
        } catch (error) {
          console.error('Session verification error:', error)
          // Fallback: let middleware handle redirect
          window.location.href = '/'
        }
      }
      
      verifyAndRedirect()
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
              {isLoading ? 'Bejelentkezés...' : 'Bejelentkezés vállalkozásoknak'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginV2
