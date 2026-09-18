import type { Metadata } from 'next'

import { AuthMosaicShell } from '@/components/auth/auth-mosaic-shell'
import { LoginForm } from '@/components/auth/login-form'
import { isDevBypassEnabled, isSupabaseConfigured } from '@/lib/auth/config'

export const metadata: Metadata = {
  title: 'Belépés'
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
    <AuthMosaicShell variant="staff" title="Belépés" homeHref="/login">
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
