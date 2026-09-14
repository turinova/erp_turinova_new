import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { UsersClient } from '@/components/users/users-client'
import { getSessionUser } from '@/lib/auth/session'
import { isServiceRoleConfigured } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getTenantSeatInfo } from '@/lib/tenancy/seats'
import { listTenantUsers } from '@/lib/users/actions'

export const metadata: Metadata = {
  title: 'Felhasználók'
}

export default async function FelhasznalokPage() {
  const user = await getSessionUser()
  if (!user?.canManageUsers) {
    redirect('/nincs-hozzaferes')
  }

  const { rows, error } = await listTenantUsers()
  const admin = isServiceRoleConfigured()
    ? (await import('@/lib/supabase/service')).createServiceClient()
    : null
  const supabase = admin ?? (await createClient())
  const seats =
    supabase && user.tenantId
      ? await getTenantSeatInfo(supabase, user.tenantId)
      : { maxSeats: null, usedSeats: rows.length, atLimit: false }

  return (
    <UsersClient
      rows={rows}
      loadError={error}
      serviceRoleMissing={!isServiceRoleConfigured()}
      entitledPages={user.entitledPages}
      seats={seats}
    />
  )
}
