import type { Metadata } from 'next'

import { AuthMosaicShell } from '@/components/auth/auth-mosaic-shell'
import { LoginForm } from '@/components/auth/login-form'
import { SessionKickBanner } from '@/components/auth/session-kick-banner'
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

  return (
    <AuthMosaicShell
      variant="staff"
      title="Céges belépés"
      description="Tenant felület · app.optinova.hu. Csak céges (staff) fiók."
      homeHref="/"
    >
      <SessionKickBanner reason={params.reason} />
      <LoginForm showDevHint={showDevHint} />
    </AuthMosaicShell>
  )
}
