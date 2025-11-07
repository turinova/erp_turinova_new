'use client'

// React Imports
import React, { useState, useEffect } from 'react'

// Next Imports
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// MUI Imports
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Checkbox from '@mui/material/Checkbox'

// Third-party Imports
import classnames from 'classnames'
import { supabase } from '@/lib/supabase-client'
import { toast } from 'react-toastify'

// Type Imports
import type { Mode } from '@core/types'

// Component Imports
import Squares from '@/components/Squares'

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
  const [smsNotification, setSmsNotification] = useState(true)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

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

  // Phone number formatting helper
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')
    
    // If it starts with 36, keep it as is, otherwise add 36
    let formatted = digits

    if (!digits.startsWith('36') && digits.length > 0) {
      formatted = '36' + digits
    }
    
    // Format: +36 30 999 2800
    if (formatted.length >= 2) {
      const countryCode = formatted.substring(0, 2)
      const areaCode = formatted.substring(2, 4)
      const firstPart = formatted.substring(4, 7)
      const secondPart = formatted.substring(7, 11)
      
      let result = `+${countryCode}`

      if (areaCode) result += ` ${areaCode}`
      if (firstPart) result += ` ${firstPart}`
      if (secondPart) result += ` ${secondPart}`
      
      return result
    }
    
    return value
  }

  // Hungarian tax number (adószám) formatting helper
  const formatTaxNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')
    
    // Format: xxxxxxxx-y-zz (8 digits, 1 digit, 2 digits)
    if (digits.length <= 8) {
      return digits
    } else if (digits.length <= 9) {
      return `${digits.substring(0, 8)}-${digits.substring(8)}`
    } else if (digits.length <= 11) {
      return `${digits.substring(0, 8)}-${digits.substring(8, 9)}-${digits.substring(9)}`
    } else {
      // Limit to 11 digits total
      return `${digits.substring(0, 8)}-${digits.substring(8, 9)}-${digits.substring(9, 11)}`
    }
  }

  // Hungarian company registration number (cégjegyzékszám) formatting helper
  const formatCompanyRegNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')
    
    // Format: xx-yy-zzzzzz (2 digits, 2 digits, 6 digits)
    if (digits.length <= 2) {
      return digits
    } else if (digits.length <= 4) {
      return `${digits.substring(0, 2)}-${digits.substring(2)}`
    } else if (digits.length <= 10) {
      return `${digits.substring(0, 2)}-${digits.substring(2, 4)}-${digits.substring(4)}`
    } else {
      // Limit to 10 digits total
      return `${digits.substring(0, 2)}-${digits.substring(2, 4)}-${digits.substring(4, 10)}`
    }
  }

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
        toast.error('Nem sikerült betölteni a vállalatokat.')
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
        toast.error('Érvénytelen e-mail cím!')
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
    // Validate terms acceptance
    if (!acceptedTerms) {
      toast.error('Kérjük, fogadja el az Általános Szerződési Feltételeket és az Adatkezelési Tájékoztatót!')
      return
    }

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
        toast.error(data.error || 'A regisztráció sikertelen.')
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
                onChange={(e) => setMobile(formatPhoneNumber(e.target.value))}
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
                placeholder='12345678-1-02'
                value={billingTaxNumber}
                onChange={(e) => setBillingTaxNumber(formatTaxNumber(e.target.value))}
              />
              <TextField 
                fullWidth 
                label='Cégjegyzékszám' 
                placeholder='01-09-123456'
                value={billingCompanyRegNumber}
                onChange={(e) => setBillingCompanyRegNumber(formatCompanyRegNumber(e.target.value))}
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
              <FormControlLabel
                control={
                  <Checkbox
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    color='primary'
                    required
                  />
                }
                label={
                  <Typography variant='body2'>
                    Elfogadom az{' '}
                    <Link 
                      href='/terms-and-conditions' 
                      target='_blank' 
                      rel='noopener noreferrer'
                      style={{ color: 'var(--mui-palette-primary-main)', textDecoration: 'underline' }}
                    >
                      Általános Szerződési Feltételeket
                    </Link>
                    {' '}és az{' '}
                    <Link 
                      href='/privacy-policy' 
                      target='_blank' 
                      rel='noopener noreferrer'
                      style={{ color: 'var(--mui-palette-primary-main)', textDecoration: 'underline' }}
                    >
                      Adatkezelési tájékoztatót
                    </Link>
                  </Typography>
                }
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
