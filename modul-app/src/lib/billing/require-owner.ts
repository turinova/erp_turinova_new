import { redirect } from 'next/navigation'

import { getSessionUser, type SessionUser } from '@/lib/auth/session'

/** Előfizetés / SMS napló — csak tenant owner; egyébként nincs-hozzáférés. */
export async function requireTenantOwnerPage(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.role !== 'owner') {
    redirect('/nincs-hozzaferes')
  }
  return user
}
