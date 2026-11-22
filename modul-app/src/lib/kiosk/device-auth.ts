import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

import { hashKioskToken } from '@/lib/kiosk/device-token'

export function isKioskDevBypassEnabled(): boolean {
  return (
    process.env.KIOSK_DEV_BYPASS === '1' ||
    process.env.KIOSK_DEV_BYPASS === 'true'
  )
}

export function readKioskBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (header?.toLowerCase().startsWith('bearer ')) {
    const t = header.slice(7).trim()
    return t || null
  }
  const cookie = request.cookies.get('kiosk_device_token')?.value
  return cookie?.trim() || null
}

export type KioskDeviceAuthResult =
  | { ok: true; deviceId: string | null; bypass: boolean }
  | { ok: false; message: string; status: number }

/**
 * P1b: ha KIOSK_DEV_BYPASS → OK.
 * Ha van aktív eszköz a tenantnál → token kötelező.
 * Ha nincs eszköz → OK (beállítás / első teszt).
 */
export async function authorizeKioskDevice(
  admin: SupabaseClient,
  tenantId: string,
  request: NextRequest
): Promise<KioskDeviceAuthResult> {
  if (isKioskDevBypassEnabled()) {
    return { ok: true, deviceId: null, bypass: true }
  }

  const { count, error: countError } = await admin
    .from('kiosk_devices')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('revoked_at', null)

  if (countError) {
    // Tábla hiány / migráció előtt — engedd bypass nélkül is a readot? Price-nál fail safe.
    if (
      countError.message.includes('kiosk_devices') ||
      countError.code === '42P01' ||
      countError.code === 'PGRST205'
    ) {
      return { ok: true, deviceId: null, bypass: true }
    }
    console.error('authorizeKioskDevice count', countError.message)
    return { ok: false, message: 'Eszköz ellenőrzés sikertelen.', status: 500 }
  }

  if (!count || count === 0) {
    return { ok: true, deviceId: null, bypass: true }
  }

  const token = readKioskBearerToken(request)
  if (!token) {
    return {
      ok: false,
      message: 'Ez a gép nincs beállítva kiosknak. Szólj a pultnál.',
      status: 401
    }
  }

  const tokenHash = hashKioskToken(token)
  const { data, error } = await admin
    .from('kiosk_devices')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle()

  if (error) {
    console.error('authorizeKioskDevice lookup', error.message)
    return { ok: false, message: 'Eszköz ellenőrzés sikertelen.', status: 500 }
  }
  if (!data?.id) {
    return {
      ok: false,
      message: 'Ez a gép már nem kiosk. Szólj a pultnál.',
      status: 401
    }
  }

  void admin
    .from('kiosk_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id)

  return { ok: true, deviceId: data.id as string, bypass: false }
}
