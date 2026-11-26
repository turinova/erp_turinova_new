import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { hashJelenletToken, tenantHasJelenlet } from '@/lib/jelenlet/entitlement'
import { createServiceClient } from '@/lib/supabase/service'

export type JelenletDeviceContext = {
  admin: SupabaseClient
  deviceId: string
  tenantId: string
}

export function getJelenletBearer(request: Request): string | null {
  const h = request.headers.get('authorization')
  if (h?.startsWith('Bearer ')) return h.slice(7).trim() || null
  return request.headers.get('x-jelenlet-secret')?.trim() || null
}

/** Eszköztoken → tenant; Jelenlét add-on + aktív tenant. Hiba esetén kész válasz. */
export async function requireJelenletDevice(
  request: Request
): Promise<JelenletDeviceContext | NextResponse> {
  const admin = createServiceClient()
  if (!admin) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 503 })
  }
  const token = getJelenletBearer(request)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: device, error } = await admin
    .from('jelenlet_devices')
    .select('id, tenant_id')
    .eq('sync_token_hash', hashJelenletToken(token))
    .maybeSingle()
  if (error || !device?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = device.tenant_id as string
  const [hasAddon, tenantRes] = await Promise.all([
    tenantHasJelenlet(admin, tenantId),
    admin.from('tenants').select('status').eq('id', tenantId).maybeSingle()
  ])
  if (!hasAddon) {
    return NextResponse.json({ error: 'Jelenlét add-on nincs bekapcsolva.' }, { status: 403 })
  }
  if (tenantRes.data?.status !== 'active') {
    return NextResponse.json({ error: 'Tenant inactive' }, { status: 403 })
  }

  return { admin, deviceId: device.id as string, tenantId }
}
