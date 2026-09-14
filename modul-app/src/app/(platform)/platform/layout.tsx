import { redirect } from 'next/navigation'

import { PlatformShell } from '@/components/platform/platform-shell'
import { getSessionUser } from '@/lib/auth/session'

export default async function PlatformLayout({
  children
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.isPlatformAdmin && !user.isDevSession) {
    redirect('/home')
  }

  return <PlatformShell user={user}>{children}</PlatformShell>
}
