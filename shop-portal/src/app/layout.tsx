// MUI Imports
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript'

// Third-party Imports
import 'react-perfect-scrollbar/dist/css/styles.css'
import { SpeedInsights } from '@vercel/speed-insights/next'
import 'react-toastify/dist/ReactToastify.css'
import 'remixicon/fonts/remixicon.css'

// Type Imports
import type { ChildrenType } from '@core/types'

// Util Imports
import { getSystemMode } from '@core/utils/serverHelpers'

// Style Imports
import '@/app/globals.css'

// Generated Icon CSS Imports
import '@assets/iconify-icons/generated-icons.css'

export const metadata = {
  title: {
    template: '%s | Turinova Shop Portal',
    default: 'Turinova Shop Portal'
  },
  description: 'Turinova Shop Portal - Webshop kezelő rendszer',
}

const RootLayout = async (props: ChildrenType) => {
  const { children } = props

  const systemMode = await getSystemMode()
  const direction = 'ltr'

  return (
    <html id='__next' lang='hu' dir={direction} suppressHydrationWarning>
      <head>
        {/* Preload critical fonts only */}
        <link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" as="style" />
        <link rel="preload" href="https://fonts.googleapis.com/icon?family=Material+Icons" as="style" />
        
        {/* DNS prefetch for external resources */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
      </head>
      <body className='flex is-full min-bs-full flex-auto flex-col'>
        <InitColorSchemeScript attribute='data' defaultMode={systemMode} />
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}

export default RootLayout
