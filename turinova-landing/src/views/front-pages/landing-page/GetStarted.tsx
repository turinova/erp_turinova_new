// Next Imports
import Link from 'next/link'

// MUI Imports
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'

// Third-party Imports
import classnames from 'classnames'

// Styles Imports
import frontCommonStyles from '@views/front-pages/styles.module.css'

const GetStarted = () => {
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
        
        <div className='flex gap-4 items-center max-w-[500px] w-full flex-wrap justify-center'>
          <TextField
            size='medium'
            label='Email cím'
            placeholder='pelda@email.hu'
            type='email'
            className='flex-1 min-w-[250px]'
          />
          <Button
            variant='contained'
            color='primary'
            size='large'
          >
            Feliratkozás
          </Button>
        </div>

        <Typography variant='body2' color='text.secondary' className='max-w-[500px]'>
          Regisztrációval elfogadod az <Link href='http://localhost:3001/terms-and-conditions' className='text-primary'>Felhasználási feltételeket</Link> és az <Link href='http://localhost:3001/privacy-policy' className='text-primary'>Adatvédelmi irányelveket</Link>.
        </Typography>
      </div>
    </section>
  )
}

export default GetStarted
