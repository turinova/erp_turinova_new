'use client'

// React Imports
import type { ReactNode } from 'react'

// Context Imports
import { SettingsProvider } from '@core/contexts/settingsContext'
import { IntersectionProvider } from '@/contexts/intersectionContext'
import ThemeProvider from '@components/theme'

// Styled Component Imports
import AppReactToastify from '@/libs/styles/AppReactToastify'

type Props = {
  children: ReactNode
  direction: 'ltr' | 'rtl'
  systemMode: 'light' | 'dark' | 'system'
  mode?: 'light' | 'dark' | 'system'
  settingsCookie?: any
  demoName?: string
}

const Providers = (props: Props) => {
  // Props
  const { children, direction, systemMode, mode, settingsCookie, demoName } = props

  return (
    <SettingsProvider 
      settingsCookie={settingsCookie || null} 
      mode={mode || systemMode} 
      demoName={demoName || undefined}
    >
      <IntersectionProvider>
        <ThemeProvider direction={direction} systemMode={systemMode}>
          {children}
          <AppReactToastify position='top-right' hideProgressBar />
        </ThemeProvider>
      </IntersectionProvider>
    </SettingsProvider>
  )
}

export default Providers

