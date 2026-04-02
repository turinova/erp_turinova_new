// MUI Imports
import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

// Third-party Imports
import classnames from 'classnames'

// Component Imports
import Link from '@components/Link'
import Logo from '@components/layout/shared/Logo'

// Util Imports
import { frontLayoutClasses } from '@layouts/utils/layoutClasses'

// Styles Imports
import frontCommonStyles from '@views/front-pages/styles.module.css'

const navLinks = [
  { href: '/', label: 'Főoldal' },
  { href: '/#features', label: 'Funkciók' },
] as const

const Footer = () => {
  return (
    <footer className={frontLayoutClasses.footer}>
      <div className="relative bg-gray-50 border-b border-gray-100/80">
        <div className={classnames('plb-10 sm:plb-12', frontCommonStyles.layoutSpacing)}>
          <Grid container columnSpacing={{ xs: 0, lg: 10 }} rowSpacing={{ xs: 8, lg: 6 }} alignItems="flex-start">
            <Grid size={{ xs: 12, lg: 5 }}>
              <div className="flex flex-col items-start gap-4 max-w-xl">
                <Link href="/">
                  <Logo />
                </Link>
                <Typography color="text.secondary" variant="body2" className="leading-relaxed">
                  ERP webshop- és bolti értékesítéshez: készlet, rendelés, integrációk egy platformon. Segítünk a
                  versenytárs-elemzésben és az AI-alapú tartalom- és adatgenerálásban, ami az organikus elérést segíti —
                  magyar vállalkozásoknak.
                </Typography>
              </div>
            </Grid>
            <Grid size={{ xs: 12, lg: 7 }}>
              <div className="flex flex-col gap-6 lg:items-end lg:text-right">
                <nav aria-label="Lábléc navigáció és kapcsolat" className="flex flex-col gap-6 w-full lg:max-w-xl lg:ml-auto">
                  <div className="flex flex-wrap gap-x-6 gap-y-2.5">
                    {navLinks.map(({ href, label }) => (
                      <Typography
                        key={href}
                        component={Link}
                        href={href}
                        color="text.secondary"
                        variant="body2"
                        className="hover:text-primary transition-colors"
                      >
                        {label}
                      </Typography>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-1.5 pt-2 border-t border-gray-200/90">
                    <Typography
                      component="a"
                      href="mailto:info@turinova.hu"
                      color="text.secondary"
                      variant="body2"
                      className="no-underline hover:text-primary transition-colors"
                    >
                      info@turinova.hu
                    </Typography>
                    <Typography
                      component="a"
                      href="tel:+36309992800"
                      color="text.secondary"
                      variant="body2"
                      className="no-underline hover:text-primary transition-colors"
                    >
                      +36 30 999 2800
                    </Typography>
                  </div>
                </nav>
              </div>
            </Grid>
          </Grid>
        </div>
      </div>
      <div className="bg-white">
        <div
          className={classnames(
            'flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 sm:gap-4 plb-[14px]',
            frontCommonStyles.layoutSpacing
          )}
        >
          <Typography color="text.secondary" variant="body2" component="p" className="shrink-0">
            © {new Date().getFullYear()} Turinova. Minden jog fenntartva.
          </Typography>
          <div className="flex flex-wrap gap-x-4 gap-y-1 items-center text-sm">
            <Typography component={Link} href="/terms-and-conditions" color="text.secondary" variant="body2" className="hover:text-primary">
              Felhasználási feltételek
            </Typography>
            <Typography component={Link} href="/privacy-policy" color="text.secondary" variant="body2" className="hover:text-primary">
              Adatvédelmi irányelvek
            </Typography>
            <Typography component={Link} href="/cookie-policy" color="text.secondary" variant="body2" className="hover:text-primary">
              Cookie szabályzat
            </Typography>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
