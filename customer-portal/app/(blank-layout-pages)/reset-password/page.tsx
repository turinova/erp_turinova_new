// Next Imports
import type { Metadata } from 'next'

// Component Imports
import ResetPassword from '@views/ResetPassword'

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers'

export const metadata: Metadata = {
  title: 'Jelszó visszaállítás',
  description: 'Új jelszó megadása'
}

const ResetPasswordPage = async () => {
  // Vars
  const mode = await getServerMode()

  return <ResetPassword mode={mode} />
}

export default ResetPasswordPage

