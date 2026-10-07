import type { Metadata } from 'next'

import { AuthMosaicShell } from '@/components/auth/auth-mosaic-shell'
import { LoginForm } from '@/components/auth/login-form'
import { SessionKickBanner } from '@/components/auth/session-kick-banner'
import { isDevBypassEnabled, isSupabaseConfigured } from '@/lib/auth/config'

export const metadata: Metadata = {
  title: 'Belépés'
}

type SearchParams = Promise<{ reason?: string; next?: string }>

function safeNext(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (!raw.startsWith('/') || raw.startsWith('//')) return undefined
  if (raw.startsWith('/auth/')) return undefined
  return raw.slice(0, 200)
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const showDevHint = !isSupabaseConfigured() && isDevBypassEnabled()
  const params = await searchParams

  return (
    <AuthMosaicShell variant="staff" title="Belépés" homeHref="/login">
      <SessionKickBanner reason={params.reason} />
      <LoginForm showDevHint={showDevHint} nextPath={safeNext(params.next)} />
    </AuthMosaicShell>
  )
}
