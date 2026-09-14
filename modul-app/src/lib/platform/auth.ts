import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import {
  createServiceClient,
  isServiceRoleConfigured
} from '@/lib/supabase/service'
import { getSessionUser, type SessionUser } from '@/lib/auth/session'

export async function isPlatformAdminUser(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle()

  if (error) {
    console.error('isPlatformAdminUser', error.message)
    return false
  }
  return Boolean(data)
}

export type PlatformContext =
  | {
      ok: true
      user: SessionUser
      admin: SupabaseClient
    }
  | { ok: false; message: string }

export async function requirePlatformAdmin(): Promise<PlatformContext> {
  const user = await getSessionUser()
  if (!user) {
    return { ok: false, message: 'Nincs bejelentkezve.' }
  }

  if (user.isDevSession) {
    if (!isServiceRoleConfigured()) {
      return {
        ok: false,
        message:
          'Dev módban a platformhoz SUPABASE_SERVICE_ROLE_KEY kell (és éles DB).'
      }
    }
    const admin = createServiceClient()
    if (!admin) {
      return { ok: false, message: 'Service role nem elérhető.' }
    }
    return { ok: true, user: { ...user, isPlatformAdmin: true }, admin }
  }

  if (!user.isPlatformAdmin) {
    return { ok: false, message: 'Nincs platform admin jogosultságod.' }
  }

  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      message: 'Hiányzik a SUPABASE_SERVICE_ROLE_KEY.'
    }
  }

  const admin = createServiceClient()
  if (!admin) {
    return { ok: false, message: 'Service role nem elérhető.' }
  }

  return { ok: true, user, admin }
}

/** Session bővítéshez: user JWT klienssel. */
export async function checkPlatformAdminForSession(
  userId: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false
  return isPlatformAdminUser(supabase, userId)
}
