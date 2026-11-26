import { NextResponse, type NextRequest } from 'next/server'

import { requireJelenletDevice } from '@/lib/jelenlet/terminal-device'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Pi heartbeat (percenként): { app_version?, pending_count? } */
export async function POST(request: NextRequest) {
  const ctx = await requireJelenletDevice(request)
  if (ctx instanceof NextResponse) return ctx

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    body = {}
  }

  const pending =
    typeof body.pending_count === 'number' && Number.isFinite(body.pending_count)
      ? Math.max(0, Math.min(1_000_000, Math.trunc(body.pending_count)))
      : null
  const version = typeof body.app_version === 'string' ? body.app_version.trim().slice(0, 40) || null : null

  const nowIso = new Date().toISOString()
  const { error } = await ctx.admin
    .from('jelenlet_devices')
    .update({ last_heartbeat_at: nowIso, app_version: version, pending_count: pending, updated_at: nowIso })
    .eq('id', ctx.deviceId)
  if (error) {
    console.error('jelenlet terminal heartbeat', error.message)
    return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, server_time: nowIso })
}
