import { NextResponse, type NextRequest } from 'next/server'

import { normalizeTime } from '@/lib/jelenlet/hours'
import { requireJelenletDevice } from '@/lib/jelenlet/terminal-device'
import {
  computeDayFromEvents,
  parseScanTime,
  parseScanType,
  type ScanBase,
  type ScanSource
} from '@/lib/jelenlet/terminal-v2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_FUTURE_MS = 10 * 60 * 1000
const MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000

/**
 * Pi scan rögzítése (online vagy offline sorból, valódi idővel).
 * Body: { employee_id, scan_time, scan_type, card_id?, pin_used?, client_event_id? }
 * Idempotens: ugyanaz a client_event_id (vagy dolgozó+típus+idő) → ugyanaz a válasz.
 * 4xx = végleges (Pi eldobja), 5xx = újrapróbálandó.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireJelenletDevice(request)
  if (ctx instanceof NextResponse) return ctx

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Érvénytelen JSON' }, { status: 400 })
  }

  const employeeId = typeof body.employee_id === 'string' ? body.employee_id.trim() : ''
  const scanTime = parseScanTime(body.scan_time)
  const scanType = parseScanType(body.scan_type)
  if (!employeeId || !scanTime || !scanType) {
    return NextResponse.json({ error: 'employee_id, scan_time és scan_type kötelező' }, { status: 400 })
  }

  const ts = new Date(scanTime.utcIso).getTime()
  const now = Date.now()
  if (ts > now + MAX_FUTURE_MS || ts < now - MAX_AGE_MS) {
    return NextResponse.json({ error: 'A scan idő kívül esik az elfogadott ablakon' }, { status: 422 })
  }

  const scanSource: ScanSource = scanType.pin || body.pin_used === true ? 'pin' : 'rfid'
  const clientEventId =
    typeof body.client_event_id === 'string' && body.client_event_id.trim()
      ? body.client_event_id.trim().slice(0, 200)
      : `${employeeId}|${scanType.base}|${scanTime.utcIso}`

  const { data: employee, error: empErr } = await ctx.admin
    .from('hr_employees')
    .select('id, lunch_start, lunch_end')
    .eq('tenant_id', ctx.tenantId)
    .eq('id', employeeId)
    .is('deleted_at', null)
    .maybeSingle()
  if (empErr) {
    console.error('jelenlet terminal logs employee', empErr.message)
    return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 })
  }
  if (!employee) {
    return NextResponse.json({ error: 'Ismeretlen dolgozó' }, { status: 404 })
  }

  const { error: insErr } = await ctx.admin.from('hr_attendance_events').upsert(
    {
      tenant_id: ctx.tenantId,
      employee_id: employeeId,
      device_id: ctx.deviceId,
      client_event_id: clientEventId,
      scan_time: scanTime.utcIso,
      work_date: scanTime.workDate,
      scan_type: scanType.base,
      scan_source: scanSource,
      card_id: typeof body.card_id === 'string' ? body.card_id.trim().slice(0, 64) || null : null
    },
    { onConflict: 'tenant_id,client_event_id', ignoreDuplicates: true }
  )
  if (insErr) {
    console.error('jelenlet terminal logs insert', insErr.message)
    return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 })
  }

  const [eventsRes, dayRes] = await Promise.all([
    ctx.admin
      .from('hr_attendance_events')
      .select('scan_time, scan_type, scan_source')
      .eq('tenant_id', ctx.tenantId)
      .eq('employee_id', employeeId)
      .eq('work_date', scanTime.workDate)
      .limit(500),
    ctx.admin
      .from('hr_attendance_days')
      .select('id, arrival_time, departure_time, arrival_source, departure_source, lunch_start, lunch_end, manually_edited, source')
      .eq('tenant_id', ctx.tenantId)
      .eq('employee_id', employeeId)
      .eq('work_date', scanTime.workDate)
      .maybeSingle()
  ])
  if (eventsRes.error || dayRes.error) {
    console.error('jelenlet terminal logs reload', eventsRes.error?.message ?? dayRes.error?.message)
    return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 })
  }

  const day = dayRes.data
  const computed = computeDayFromEvents(
    day
      ? {
          arrival_time: day.arrival_time as string | null,
          departure_time: day.departure_time as string | null,
          arrival_source: day.arrival_source as string | null,
          departure_source: day.departure_source as string | null
        }
      : null,
    (eventsRes.data ?? []).map(e => ({
      scan_type: e.scan_type as ScanBase,
      scan_source: e.scan_source as ScanSource,
      hm: parseScanTime(e.scan_time as string)?.hm ?? '00:00'
    }))
  )

  const lunchStart =
    normalizeTime(day?.lunch_start as string | null) ?? normalizeTime(employee.lunch_start as string | null)
  const lunchEnd =
    normalizeTime(day?.lunch_end as string | null) ?? normalizeTime(employee.lunch_end as string | null)

  const { error: upErr } = await ctx.admin.from('hr_attendance_days').upsert(
    {
      tenant_id: ctx.tenantId,
      employee_id: employeeId,
      work_date: scanTime.workDate,
      ...computed,
      lunch_start: lunchStart,
      lunch_end: lunchEnd,
      source: (day?.source as string | undefined) ?? 'terminal',
      manually_edited: (day?.manually_edited as boolean | undefined) ?? false,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'employee_id,work_date' }
  )
  if (upErr) {
    console.error('jelenlet terminal logs day upsert', upErr.message)
    return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 })
  }

  const nowIso = new Date().toISOString()
  await ctx.admin
    .from('jelenlet_devices')
    .update({ last_seen_at: nowIso, updated_at: nowIso })
    .eq('id', ctx.deviceId)

  return NextResponse.json(
    {
      ok: true,
      employee_id: employeeId,
      work_date: scanTime.workDate,
      arrival_time: computed.arrival_time,
      departure_time: computed.departure_time
    },
    { status: 201 }
  )
}
