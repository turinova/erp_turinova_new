import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/shell/app-shell'
import { getSessionUser } from '@/lib/auth/session'
import { pathIsAllowed } from '@/lib/permissions/pages'

export default async function AppLayout({
  children
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.hasMembership) {
    redirect('/no-access')
  }

  const headerStore = await headers()
  const pathname = headerStore.get('x-pathname') ?? '/home'

  if (!pathIsAllowed(pathname, user.allowedPages)) {
    redirect('/nincs-hozzaferes')
  }

  return <AppShell user={user}>{children}</AppShell>
}
