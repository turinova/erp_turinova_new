import type { Metadata } from 'next'

import { AuthMosaicShell } from '@/components/auth/auth-mosaic-shell'
import { LoginForm } from '@/components/auth/login-form'
import { isDevBypassEnabled, isSupabaseConfigured } from '@/lib/auth/config'

export const metadata: Metadata = {
  title: 'Céges belépés'
}

type SearchParams = Promise<{ reason?: string }>

/** Tenant (staff) login — elérhető partner marketing hoston is (/login = partner). */
export default async function TenantLoginPage({
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
      description="Tenant felület · app.optinova.hu. Csak céges (staff) fiók."
      homeHref="/"
    >
      {sessionReplaced ? (
        <p
          className="mb-3 border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-hint text-warning-ink"
          role="status"
        >
          Ezzel a fiókkal máshol beléptek. Egy fiók egyszerre csak egy gépen
          lehet bejelentkezve. Lépj be újra.
        </p>
      ) : null}
      <LoginForm showDevHint={showDevHint} />
    </AuthMosaicShell>
  )
}
