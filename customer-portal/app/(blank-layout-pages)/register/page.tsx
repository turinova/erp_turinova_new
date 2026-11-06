import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { REGISTRATION_CLOSED } from '@/lib/migration-notice'

export const metadata: Metadata = {
  title: 'Regisztráció szünetel - Turinova',
  description: 'A regisztráció átmenetileg szünetel. November 9-től újra megnyílik.'
}

const RegisterPage = async () => {
  if (REGISTRATION_CLOSED) {
    redirect('/login')
  }

  // Legacy path — only if registration is re-enabled before Nov 9 cutover.
  const { default: Register } = await import('@views/Register')
  const { getServerMode } = await import('@core/utils/serverHelpers')
  const mode = await getServerMode()

  return <Register mode={mode} />
}

export default RegisterPage
