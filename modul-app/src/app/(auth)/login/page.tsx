import type { Metadata } from 'next'
import Link from 'next/link'

import { AuthMosaicShell } from '@/components/auth/auth-mosaic-shell'
import { LoginForm } from '@/components/auth/login-form'
import { isDevBypassEnabled, isSupabaseConfigured } from '@/lib/auth/config'
import { PARTNER_LOGIN_PATH } from '@/lib/auth/surface'

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
    <AuthMosaicShell
      title="Belépés"
      description="Jelentkezz be a céged felületére."
      homeHref="/login"
      footer={
        <p className="mt-4 text-center text-hint text-ink-secondary">
          Asztalos vagy?{' '}
          <Link
            href={PARTNER_LOGIN_PATH}
            className="font-medium text-ink no-underline hover:underline"
          >
            Partner belépés
          </Link>
        </p>
      }
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
