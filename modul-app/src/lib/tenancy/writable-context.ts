'use server'

import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export type WritableTenantContext =
  | {
      ok: true
      user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>
      supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>
    }
  | { ok: false; message: string }

export async function requireWritableTenant(): Promise<WritableTenantContext> {
  const user = await getSessionUser()
  if (!user?.tenantId || !user.hasMembership) {
    return { ok: false, message: 'Nincs aktív céged.' }
  }
  if (user.role === 'viewer') {
    return {
      ok: false,
      message: 'Csak megtekintési jogod van — nem módosíthatsz.'
    }
  }
  if (user.isDevSession) {
    return {
      ok: false,
      message:
        'Dev bypass módban nincs adatbázis. Kapcsold be a Supabase env-et.'
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return { ok: false, message: 'Az adatbázis kapcsolat nem elérhető.' }
  }

  return { ok: true, user, supabase }
}
