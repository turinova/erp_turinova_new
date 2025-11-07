"use client"

// Next Imports
import Link from 'next/link'

// React Imports
import { FormEvent, useMemo, useState } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'

// Third-party Imports
import classnames from 'classnames'

// Styles Imports
import frontCommonStyles from '@views/front-pages/styles.module.css'

// Supabase Client
import { supabase } from '@/lib/supabase-client'

const WAITLIST_TABLE = 'waitlist_signups'
const SOURCE = 'customer-portal-landing'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const GetStarted = () => {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: ''
  })

  const isEmailValid = useMemo(() => emailPattern.test(email.trim()), [email])
  const isSubmitDisabled = isLoading || !isEmailValid

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedEmail = email.trim().toLowerCase()
    if (!emailPattern.test(trimmedEmail)) {
      setStatus({ type: 'error', message: 'Kérjük, érvényes e-mail címet adjon meg.' })
      return
    }

    setIsLoading(true)
    setStatus({ type: null, message: '' })

    try {
      const { error } = await supabase
        .from(WAITLIST_TABLE)
        .insert([{ email: trimmedEmail, source: SOURCE }])

      if (error) {
        if (error.code === '23505') {
          setStatus({ type: 'success', message: 'Már feliratkoztál a várólistára!' })
        } else {
          console.error('Waitlist insert error:', error)
          setStatus({
            type: 'error',
            message: 'Hiba történt a feliratkozás során. Kérjük, próbáld meg később.'
          })
        }
      } else {
        setStatus({ type: 'success', message: 'Sikeresen feliratkoztál a várólistára!' })
        setEmail('')
      }
    } catch (err) {
      console.error('Unexpected waitlist error:', err)
      setStatus({
        type: 'error',
        message: 'Ismeretlen hiba történt a feliratkozás során. Kérjük, próbáld meg később.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className='relative bg-backgroundPaper py-16'>
      <div
        className={classnames(
          'flex flex-col items-center justify-center text-center gap-8',
          frontCommonStyles.layoutSpacing
        )}
      >
        <div className='flex flex-col gap-4 max-w-[600px]'>
          <Typography color='primary.main' className='font-bold text-[32px]'>
            Csatlakozzon a Várólistához
          </Typography>
          <Typography className='font-medium text-lg' color='text.secondary'>
            Legyél az elsők között, akik kipróbálhatják a Turinova ERP rendszert. Iratkozz fel a várólistára és értesítünk, amint elérhetővé válik!
          </Typography>
        </div>

        <form
          onSubmit={handleSubmit}
          className='flex gap-4 items-center max-w-[500px] w-full flex-wrap justify-center'
          noValidate
        >
          <TextField
            size='medium'
            label='E-mail cím *'
            placeholder='pelda@email.hu'
            type='email'
            className='flex-1 min-w-[250px]'
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isLoading}
            required
            error={email.length > 0 && !isEmailValid}
            helperText={email.length > 0 && !isEmailValid ? 'Kérjük, érvényes e-mail címet adjon meg.' : 'A feliratkozással értesítést kap a nyilvános indulásról.'}
          />
          <Button
            variant='contained'
            color='primary'
            size='large'
            type='submit'
            disabled={isSubmitDisabled}
            className='px-8'
          >
            {isLoading ? <CircularProgress size={22} color='inherit' /> : 'Feliratkozás'}
          </Button>
        </form>

        {status.type && (
          <Alert
            severity={status.type}
            variant='outlined'
            className='w-full max-w-[500px]'
          >
            {status.message}
          </Alert>
        )}

        <Typography variant='body2' color='text.secondary' className='max-w-[500px]'>
          Regisztrációval elfogadod az <Link href='/terms-and-conditions' className='text-primary'>Felhasználási feltételeket</Link> és az <Link href='/privacy-policy' className='text-primary'>Adatvédelmi irányelveket</Link>.
        </Typography>
      </div>
    </section>
  )
}

export default GetStarted
