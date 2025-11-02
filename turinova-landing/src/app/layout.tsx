// MUI Imports
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript'

// Third-party Imports
import 'react-perfect-scrollbar/dist/css/styles.css'

// Component Imports
import Providers from '@/components/Providers'

// Style Imports
import '@/app/globals.css'

export const metadata = {
  title: 'Turinova - Professional ERP Solution',
  description: 'Turinova ERP rendszer - Vállalkozásirányítási megoldás'
}

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html id='__next' lang='hu' dir='ltr' suppressHydrationWarning>
      <head>
        <link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" as="style" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" />
        <link rel="preload" href="https://fonts.googleapis.com/icon?family=Material+Icons" as="style" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />
      </head>
      <body className='flex is-full min-bs-full flex-auto flex-col'>
        <InitColorSchemeScript attribute='data' defaultMode='light' />
        <Providers direction='ltr' systemMode='light' mode='light' settingsCookie={{}} demoName='demo-1'>
          {children}
        </Providers>
      </body>
    </html>
  )
}

export default RootLayout
