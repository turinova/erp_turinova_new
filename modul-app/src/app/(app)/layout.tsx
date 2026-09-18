import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/shell/app-shell'
import { getSessionUser } from '@/lib/auth/session'
import {
  normalizeHostname,
  resolveAuthSurface,
  staffLoginPath
} from '@/lib/auth/surface'
import { pathIsAllowed } from '@/lib/permissions/pages'

export default async function AppLayout({
  children
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  const headerStore = await headers()
  const surface = resolveAuthSurface(
    normalizeHostname(headerStore.get('host'))
  )

  if (!user) {
    redirect(staffLoginPath(surface))
  }

  if (!user.hasMembership) {
    redirect('/no-access')
  }

  const pathname = headerStore.get('x-pathname') ?? '/home'

  if (!pathIsAllowed(pathname, user.allowedPages)) {
    redirect('/nincs-hozzaferes')
  }

  return <AppShell user={user}>{children}</AppShell>
}
