import { NextResponse, type NextRequest } from 'next/server'

import {
  hashFootcounterToken,
  tenantHasFootcounter
} from '@/lib/footcounter/entitlement'
import type { FootcounterSyncEvent } from '@/lib/footcounter/types'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getBearerSecret(request: NextRequest): string | null {
  const h = request.headers.get('authorization')
  if (h?.startsWith('Bearer ')) return h.slice(7).trim()
  const x = request.headers.get('x-footcounter-secret')
  return x?.trim() ?? null
}

/**
 * Pi → cloud sync (no user session).
 * Auth: per-device token (platform-generated), hashed in footcounter_devices.
 * POST { device_slug?: string, events: SyncEvent[] }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = createServiceClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'Service role not configured' },
        { status: 503 }
      )
    }

    const sent = getBearerSecret(request)
    if (!sent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tokenHash = hashFootcounterToken(sent)
    const { data: device, error: devErr } = await admin
      .from('footcounter_devices')
      .select('id, tenant_id, slug')
      .eq('sync_token_hash', tokenHash)
      .maybeSingle()

    if (devErr || !device?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entitled = await tenantHasFootcounter(
      admin,
      device.tenant_id as string
    )
    if (!entitled) {
      return NextResponse.json(
        { error: 'Footcounter add-on not enabled' },
        { status: 403 }
      )
    }

    const { data: tenant } = await admin
      .from('tenants')
      .select('status')
      .eq('id', device.tenant_id)
      .maybeSingle()

    if (!tenant || tenant.status !== 'active') {
      return NextResponse.json({ error: 'Tenant inactive' }, { status: 403 })
    }

    const body = await request.json()
    const bodySlug =
      typeof body.device_slug === 'string' ? body.device_slug.trim() : ''
    if (bodySlug && bodySlug !== device.slug) {
      return NextResponse.json({ error: 'device_slug mismatch' }, { status: 400 })
    }

    const events: FootcounterSyncEvent[] = Array.isArray(body.events)
      ? body.events
      : []

    if (events.length === 0) {
      return NextResponse.json(
        { error: 'non-empty events required' },
        { status: 400 }
      )
    }
    if (events.length > 500) {
      return NextResponse.json(
        { error: 'Max 500 events per request' },
        { status: 400 }
      )
    }

    const rows = events
      .map((e) => {
        const id = e.client_event_id
        const dir = e.direction
        if (!id || (dir !== 'in' && dir !== 'out')) return null
        const ts = e.occurred_at
        if (!ts || Number.isNaN(Date.parse(ts))) return null
        return {
          device_id: device.id as string,
          client_event_id: id,
          occurred_at: new Date(ts).toISOString(),
          direction: dir,
          confidence: e.confidence ?? null
        }
      })
      .filter(Boolean) as Array<{
      device_id: string
      client_event_id: string
      occurred_at: string
      direction: 'in' | 'out'
      confidence: number | null
    }>

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid events' }, { status: 400 })
    }

    const { error: insErr } = await admin.from('footcounter_crossings').upsert(
      rows,
      {
        onConflict: 'device_id,client_event_id',
        ignoreDuplicates: true
      }
    )

    if (insErr) {
      console.error('footcounter sync insert', insErr.message)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    await admin
      .from('footcounter_devices')
      .update({
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', device.id)

    return NextResponse.json({
      ok: true,
      accepted: rows.length,
      device_id: device.id
    })
  } catch (e) {
    console.error('footcounter sync', e)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
