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
import Box from '@mui/material/Box'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'

// Third-party Imports
import classnames from 'classnames'
import { supabase } from '@/lib/supabase-client'
import { toast } from 'react-toastify'

// Type Imports
import type { Mode } from '@core/types'

// Component Imports
import Logo from '@components/layout/shared/Logo'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import { useSettings } from '@core/hooks/useSettings'

interface Company {
  id: string
  name: string
  slug: string
}

const steps = ['Fiók', 'Számlázás', 'Beállítások']

const RegisterV2 = ({ mode }: { mode: Mode }) => {
  // States
  const [activeStep, setActiveStep] = useState(0)
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  
  // Step 1: Account Info
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  
  // Step 2: Billing Details
  const [billingName, setBillingName] = useState('')
  const [billingCountry, setBillingCountry] = useState('Magyarország')
  const [billingCity, setBillingCity] = useState('')
  const [billingPostalCode, setBillingPostalCode] = useState('')
  const [billingStreet, setBillingStreet] = useState('')
  const [billingHouseNumber, setBillingHouseNumber] = useState('')
  const [billingTaxNumber, setBillingTaxNumber] = useState('')
  const [billingCompanyRegNumber, setBillingCompanyRegNumber] = useState('')
  
  // Step 3: Company & Preferences
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [smsNotification, setSmsNotification] = useState(false)

  // Vars
  const darkImg = '/images/pages/auth-v2-mask-1-dark.png'
  const lightImg = '/images/pages/auth-v2-mask-1-light.png'
  const darkIllustration = '/images/illustrations/characters/character-2.png'
  const lightIllustration = '/images/illustrations/characters/character-2.png'

  // Hooks
  const router = useRouter()
  const { settings } = useSettings()
  const authBackground = useImageVariant(mode, lightImg, darkImg)
  const characterIllustration = useImageVariant(mode, lightIllustration, darkIllustration)

  const handleClickShowPassword = () => setIsPasswordShown(show => !show)

  // Fetch companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch('/api/companies')
        if (res.ok) {
          const data = await res.json()
          setCompanies(data)
          if (data.length > 0) {
            setSelectedCompanyId(data[0].id)
          }
        }
      } catch (error) {
        console.error('Error fetching companies:', error)
        toast.error('Nem sikerült betölteni a cégeket.')
      }
    }
    fetchCompanies()
  }, [])

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          router.push('/home')
        }
      } catch (error) {
        console.error('Error checking session:', error)
      }
    }
    checkUser()
  }, [router])

  const handleNext = () => {
    // Validation for each step
    if (activeStep === 0) {
      if (!name || !email || !mobile || !password) {
        toast.error('Kérjük, töltse ki az összes kötelező mezőt!')
        return
      }
      if (!email.includes('@')) {
        toast.error('Érvénytelen email cím!')
        return
      }
      if (password.length < 6) {
        toast.error('A jelszónak legalább 6 karakter hosszúnak kell lennie!')
        return
      }
    }
    
    if (activeStep === 2) {
      if (!selectedCompanyId) {
        toast.error('Kérjük, válasszon vállalatot!')
        return
      }
    }
    
    setActiveStep((prevActiveStep) => prevActiveStep + 1)
  }

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1)
  }

  const handleRegister = async () => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          mobile,
          password,
          billing_name: billingName,
          billing_country: billingCountry,
          billing_city: billingCity,
          billing_postal_code: billingPostalCode,
          billing_street: billingStreet,
          billing_house_number: billingHouseNumber,
          billing_tax_number: billingTaxNumber,
          billing_company_reg_number: billingCompanyRegNumber,
          selected_company_id: selectedCompanyId,
          sms_notification: smsNotification
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Sikeres regisztráció!')
        
        // Auto-login after registration
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })

        if (loginError) {
          console.error('Auto-login error:', loginError)
          toast.info('Kérjük, jelentkezzen be')
          router.push('/login')
        } else if (loginData.user) {
          console.log('Auto-login successful, user:', loginData.user.email)
          toast.success('Automatikus bejelentkezés sikeres!')
          
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
      } else {
        toast.error(data.error || 'Regisztráció sikertelen')
      }
    } catch (error) {
      console.error('Registration exception:', error)
      toast.error('Váratlan hiba történt')
    } finally {
      setIsLoading(false)
    }
  }

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <>
            <Typography variant='h5' className='mbe-1'>
              Fiók adatok
            </Typography>
            <Typography className='mbe-6'>Adja meg a fiók adatait</Typography>
            <div className='flex flex-col gap-5'>
              <TextField 
                autoFocus 
                fullWidth 
                label='Név' 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <TextField 
                fullWidth 
                label='Email cím' 
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <TextField 
                fullWidth 
                label='Telefonszám' 
                placeholder='+36 30 999 2800'
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
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
            </div>
          </>
        )
      case 1:
        return (
          <>
            <Typography variant='h5' className='mbe-1'>
              Számlázási adatok
            </Typography>
            <Typography className='mbe-6'>Adja meg a számlázási adatokat (opcionális)</Typography>
            <div className='flex flex-col gap-5'>
              <TextField 
                fullWidth 
                label='Számlázási név' 
                value={billingName}
                onChange={(e) => setBillingName(e.target.value)}
              />
              <TextField 
                fullWidth 
                label='Ország' 
                value={billingCountry}
                onChange={(e) => setBillingCountry(e.target.value)}
              />
              <div className='flex gap-4'>
                <TextField 
                  fullWidth 
                  label='Város' 
                  value={billingCity}
                  onChange={(e) => setBillingCity(e.target.value)}
                />
                <TextField 
                  fullWidth 
                  label='Irányítószám' 
                  value={billingPostalCode}
                  onChange={(e) => setBillingPostalCode(e.target.value)}
                />
              </div>
              <div className='flex gap-4'>
                <TextField 
                  fullWidth 
                  label='Utca' 
                  value={billingStreet}
                  onChange={(e) => setBillingStreet(e.target.value)}
                />
                <TextField 
                  fullWidth 
                  label='Házszám' 
                  value={billingHouseNumber}
                  onChange={(e) => setBillingHouseNumber(e.target.value)}
                />
              </div>
              <TextField 
                fullWidth 
                label='Adószám' 
                value={billingTaxNumber}
                onChange={(e) => setBillingTaxNumber(e.target.value)}
              />
              <TextField 
                fullWidth 
                label='Cégjegyzékszám' 
                value={billingCompanyRegNumber}
                onChange={(e) => setBillingCompanyRegNumber(e.target.value)}
              />
            </div>
          </>
        )
      case 2:
        return (
          <>
            <Typography variant='h5' className='mbe-1'>
              Vállalat és beállítások
            </Typography>
            <Typography className='mbe-6'>Válassza ki a vállalatot és állítsa be a preferenciákat</Typography>
            <div className='flex flex-col gap-5'>
              <FormControl fullWidth required>
                <InputLabel>Vállalat</InputLabel>
                <Select
                  value={selectedCompanyId}
                  label='Vállalat'
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                >
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={smsNotification}
                    onChange={(e) => setSmsNotification(e.target.checked)}
                    color='primary'
                  />
                }
                label='SMS értesítések küldése'
              />
            </div>
          </>
        )
      default:
        return 'Unknown step'
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
        <Box sx={{ position: 'absolute', top: { xs: 20, sm: 38 }, left: { xs: 24, sm: 38 } }}>
          <Logo />
        </Box>
        <div className='flex flex-col gap-6 is-full sm:is-auto md:is-full sm:max-is-[400px] md:max-is-[unset] mbs-11 sm:mbs-14 md:mbs-0'>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel
                  StepIconProps={{
                    sx: {
                      '&.MuiStepIcon-root': {
                        fontSize: '2rem',
                        '&.Mui-active, &.Mui-completed': {
                          color: 'primary.main'
                        }
                      }
                    }
                  }}
                >
                  <Typography variant="caption" display="block" className="text-xs mbs-1">
                    {label}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          <form
            noValidate
            autoComplete='off'
            onSubmit={(e) => {
              e.preventDefault()
              if (activeStep === steps.length - 1) {
                handleRegister()
              } else {
                handleNext()
              }
            }}
            className='flex flex-col gap-5'
          >
            {getStepContent(activeStep)}

            <div className='flex items-center justify-between gap-4 mbs-4'>
              <Button
                variant='outlined'
                color='secondary'
                disabled={activeStep === 0 || isLoading}
                onClick={handleBack}
                sx={{ minWidth: '100px' }}
              >
                Vissza
              </Button>
              <Button 
                variant='contained' 
                type='submit'
                disabled={isLoading}
                sx={{ minWidth: '100px' }}
              >
                {isLoading 
                  ? 'Feldolgozás...' 
                  : activeStep === steps.length - 1 
                    ? 'Küldés' 
                    : 'Tovább'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default RegisterV2
