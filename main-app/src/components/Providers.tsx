// Type Imports
import { ToastContainer } from 'react-toastify'

import type { ChildrenType, Direction } from '@core/types'

// Context Imports
import { VerticalNavProvider } from '@menu/contexts/verticalNavContext'
import { SettingsProvider } from '@core/contexts/settingsContext'
import { AuthProvider } from '../contexts/AuthContext'
import { PermissionProvider } from '../contexts/PermissionContext'
import ThemeProvider from '@components/theme'

// Third-party Imports
import 'react-toastify/dist/ReactToastify.css'

// Util Imports
import { getMode, getSettingsFromCookie, getSystemMode } from '@core/utils/serverHelpers'

type Props = ChildrenType & {
  direction: Direction
}

const Providers = async (props: Props) => {
  // Props
  const { children, direction } = props

  // Vars
  const mode = await getMode()
  const settingsCookie = await getSettingsFromCookie()
  const systemMode = await getSystemMode()

  return (
    <AuthProvider>
      <PermissionProvider>
        <VerticalNavProvider>
          <SettingsProvider settingsCookie={settingsCookie} mode={mode}>
            <ThemeProvider direction={direction}>
              {children}
              <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
              />
            </ThemeProvider>
          </SettingsProvider>
        </VerticalNavProvider>
      </PermissionProvider>
    </AuthProvider>
  )
}

export default Providers
