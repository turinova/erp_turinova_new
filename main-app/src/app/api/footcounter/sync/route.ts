import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SyncEvent = {
  client_event_id: string
  occurred_at: string
  direction: 'in' | 'out'
  confidence?: number | null
}

function getBearerSecret(request: NextRequest): string | null {
  const h = request.headers.get('authorization')
  if (h?.startsWith('Bearer ')) return h.slice(7).trim()
  const x = request.headers.get('x-footcounter-secret')
  return x?.trim() ?? null
}

/**
 * Pi → cloud sync (no user session). Protect with FOOTCOUNTER_SYNC_SECRET.
 * POST body: { device_slug: string, events: SyncEvent[] }
 * Supports per-event sync: events may contain a single element (immediate POST from the Pi preview).
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.FOOTCOUNTER_SYNC_SECRET?.trim()
    if (!secret) {
      return NextResponse.json({ error: 'FOOTCOUNTER_SYNC_SECRET not configured' }, { status: 503 })
    }

    const sent = getBearerSecret(request)
    if (!sent || sent !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const deviceSlug = typeof body.device_slug === 'string' ? body.device_slug.trim() : ''
    const events: SyncEvent[] = Array.isArray(body.events) ? body.events : []

    if (!deviceSlug || events.length === 0) {
      return NextResponse.json({ error: 'device_slug and non-empty events required' }, { status: 400 })
    }

    if (events.length > 500) {
      return NextResponse.json({ error: 'Max 500 events per request' }, { status: 400 })
    }

    let deviceId: string | undefined
    const { data: existingDev } = await supabaseServer
      .from('footcounter_devices')
      .select('id')
      .eq('slug', deviceSlug)
      .maybeSingle()

    if (existingDev?.id) {
      deviceId = existingDev.id as string
    } else {
      const { data: inserted, error: insDevErr } = await supabaseServer
        .from('footcounter_devices')
        .insert({ slug: deviceSlug, name: deviceSlug })
        .select('id')
        .single()

      if (insDevErr || !inserted?.id) {
        console.error('footcounter sync device insert:', insDevErr)
        return NextResponse.json({ error: 'Device create failed' }, { status: 500 })
      }
      deviceId = inserted.id as string
    }

    const rows = events.map(e => {
      const id = e.client_event_id
      const dir = e.direction
      if (!id || (dir !== 'in' && dir !== 'out')) {
        return null
      }
      const ts = e.occurred_at
      if (!ts || Number.isNaN(Date.parse(ts))) {
        return null
      }
      return {
        device_id: deviceId,
        client_event_id: id,
        occurred_at: new Date(ts).toISOString(),
        direction: dir,
        confidence: e.confidence ?? null
      }
    }).filter(Boolean) as Array<{
      device_id: string
      client_event_id: string
      occurred_at: string
      direction: 'in' | 'out'
      confidence: number | null
    }>

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid events' }, { status: 400 })
    }

    const { error: insErr } = await supabaseServer.from('footcounter_crossings').upsert(rows, {
      onConflict: 'client_event_id',
      ignoreDuplicates: true
    })

    if (insErr) {
      console.error('footcounter sync insert:', insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    const { error: seenErr } = await supabaseServer
      .from('footcounter_devices')
      .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', deviceId)

    if (seenErr) {
      console.warn('footcounter sync last_seen update:', seenErr)
    }

    return NextResponse.json({
      ok: true,
      device_id: deviceId,
      accepted: rows.length
    })
  } catch (e) {
    console.error('footcounter sync:', e)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
