// MUI Imports
import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'

// Third-party Imports
import classnames from 'classnames'

// Component Imports
import Link from '@components/Link'
import Logo from '@components/layout/shared/Logo'

// Util Imports
import { frontLayoutClasses } from '@layouts/utils/layoutClasses'

// Styles Imports
import styles from './styles.module.css'
import frontCommonStyles from '@views/front-pages/styles.module.css'

const Footer = () => {
  return (
    <footer className={frontLayoutClasses.footer}>
      <div className='relative bg-gray-50'>
        <div className={classnames('plb-12', frontCommonStyles.layoutSpacing)}>
          <Grid container rowSpacing={10} columnSpacing={12}>
            <Grid size={{ xs: 12, lg: 5 }}>
              <div className='flex flex-col items-start gap-6'>
                <Link href='/'>
                  <Logo />
                </Link>
                <Typography color='text.secondary' className='lg:max-is-[390px]'>
                  Professzionális ERP rendszer vállalkozások számára. Hatékony termelésirányítás, készletkezelés és ügyfélkapcsolat-menedzsment egy helyen.
                </Typography>
              </div>
            </Grid>
            <Grid size={{ xs: 12, sm: 4, lg: 3 }}>
              <Typography color='text.primary' className='font-medium mbe-6'>
                Linkek
              </Typography>
              <div className='flex flex-col gap-4'>
                <Typography component={Link} href='/' color='text.secondary' className='hover:text-primary'>
                  Főoldal
                </Typography>
                <Typography component={Link} href='/#features' color='text.secondary' className='hover:text-primary'>
                  Funkciók
                </Typography>
                <Typography component={Link} href='/login' color='text.secondary' className='hover:text-primary'>
                  Bejelentkezés
                </Typography>
                <Typography component={Link} href='/register' color='text.secondary' className='hover:text-primary'>
                  Regisztráció
                </Typography>
              </div>
            </Grid>
            <Grid size={{ xs: 12, sm: 4, lg: 4 }}>
              <Typography color='text.primary' className='font-medium mbe-6'>
                Kapcsolat
              </Typography>
              <div className='flex flex-col gap-4'>
                <Typography color='text.secondary'>
                  Email: info@turinova.hu
                </Typography>
                <Typography color='text.secondary'>
                  Telefon: +36 30 999 2800
                </Typography>
              </div>
            </Grid>
          </Grid>
        </div>
      </div>
      <div className='bg-white border-t border-gray-200'>
        <div
          className={classnames(
            'flex flex-wrap items-center justify-center sm:justify-between gap-4 plb-[15px]',
            frontCommonStyles.layoutSpacing
          )}
        >
          <Typography color='text.secondary' variant='body2'>
            <span>{`© ${new Date().getFullYear()} Turinova. Minden jog fenntartva.`}</span>
          </Typography>
          <div className='flex flex-wrap gap-4 items-center'>
            <Typography 
              component={Link} 
              href='/terms-and-conditions' 
              color='text.secondary' 
              className='hover:text-primary'
              variant='body2'
            >
              Felhasználási feltételek
            </Typography>
            <Typography 
              component={Link} 
              href='/privacy-policy' 
              color='text.secondary' 
              className='hover:text-primary'
              variant='body2'
            >
              Adatvédelmi irányelvek
            </Typography>
            <Typography 
              component={Link} 
              href='/cookie-policy' 
              color='text.secondary' 
              className='hover:text-primary'
              variant='body2'
            >
              Cookie szabályzat
            </Typography>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
