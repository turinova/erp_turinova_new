import type { Metadata } from 'next'

import { AuthMosaicShell } from '@/components/auth/auth-mosaic-shell'
import { LoginForm } from '@/components/auth/login-form'
import { isDevBypassEnabled, isSupabaseConfigured } from '@/lib/auth/config'
import { STAFF_HOST_LABEL } from '@/lib/auth/surface'

export const metadata: Metadata = {
  title: 'Céges belépés'
}

type SearchParams = Promise<{ reason?: string }>

export default async function LoginPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const showDevHint = !isSupabaseConfigured() && isDevBypassEnabled()
  const params = await searchParams
  const sessionReplaced = params.reason === 'session_replaced'

  return (
    <AuthMosaicShell
      variant="staff"
      title="Céges belépés"
      description={`Tenant felület · ${STAFF_HOST_LABEL}. Csak céges (staff) fiók.`}
      homeHref="/login"
    >
      {sessionReplaced ? (
        <p
          className="mb-3 border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-hint text-warning-ink"
          role="status"
        >
          Ezzel a fiókkal máshol jelentkeztek be — ez a munkamenet lezárult.
          Lépj be újra.
        </p>
      ) : null}
      <LoginForm showDevHint={showDevHint} />
    </AuthMosaicShell>
  )
}
