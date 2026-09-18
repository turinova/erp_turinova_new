import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { logoutAction } from '@/lib/auth/actions'
import { partnerServerHref } from '@/lib/auth/partner-href-server'
import { getPartnerSession } from '@/lib/auth/partner-session'
import { getSessionUser } from '@/lib/auth/session'
import {
  normalizeHostname,
  PARTNER_HOME_PATH,
  resolveAuthSurface,
  staffLoginPath
} from '@/lib/auth/surface'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Nincs hozzáférés'
}

export default async function NoAccessPage() {
  const partner = await getPartnerSession()
  if (partner) {
    // Path-módban /home = staff ERP — partnerServerHref → /partner/home
    redirect(await partnerServerHref(PARTNER_HOME_PATH))
  }

  const user = await getSessionUser()
  const headerStore = await headers()
  const surface = resolveAuthSurface(
    normalizeHostname(headerStore.get('host'))
  )

  if (!user) {
    redirect(staffLoginPath(surface))
  }

  if (user.hasMembership) {
    redirect('/home')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4">
      <div className="w-full max-w-md border border-border bg-surface p-6">
        <h1 className="text-h1 text-ink">Nincs cég-hozzáférés</h1>
        <p className="mt-2 text-body text-ink-secondary">
          Be vagy jelentkezve mint{' '}
          <span className="font-medium text-ink">{user.email}</span>, de még
          nincs hozzárendelt cég (tenant) a fiókodhoz.
        </p>
        <p className="mt-3 text-body text-ink-secondary">
          Kérj meg egy adminisztrátort, vagy futtasd a seed SQL-t a
          dokumentáció szerint (
          <code className="text-hint">docs/19-supabase-setup.md</code>).
        </p>
        <form action={logoutAction} className="mt-5">
          <Button type="submit" variant="secondary" size="md">
            Kijelentkezés
          </Button>
        </form>
      </div>
    </div>
  )
}
