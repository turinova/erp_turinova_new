import { NextResponse, type NextRequest } from 'next/server'

import { budapestTodayYmd } from '@/lib/jelenlet/hours'
import { requireJelenletDevice } from '@/lib/jelenlet/terminal-device'
import { buildTerminalLogs, parseScanTime, type ScanBase, type ScanSource } from '@/lib/jelenlet/terminal-v2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Nap eseményei a Pi resolver formátumában (`?date=YYYY-MM-DD`, default ma;
 * opcionális `?employee_id=`). Kézi mezők `manually_edited: true` sorként.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireJelenletDevice(request)
  if (ctx instanceof NextResponse) return ctx

  const dateParam = request.nextUrl.searchParams.get('date')?.trim()
  const workDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : budapestTodayYmd()
  const employeeId = request.nextUrl.searchParams.get('employee_id')?.trim() || null

  let evQuery = ctx.admin
    .from('hr_attendance_events')
    .select('employee_id, scan_time, scan_type, scan_source')
    .eq('tenant_id', ctx.tenantId)
    .eq('work_date', workDate)
    .order('scan_time')
    .limit(2000)
  let dayQuery = ctx.admin
    .from('hr_attendance_days')
    .select('employee_id, arrival_time, departure_time, arrival_source, departure_source')
    .eq('tenant_id', ctx.tenantId)
    .eq('work_date', workDate)
    .limit(1000)
  if (employeeId) {
    evQuery = evQuery.eq('employee_id', employeeId)
    dayQuery = dayQuery.eq('employee_id', employeeId)
  }

  const [evRes, dayRes] = await Promise.all([evQuery, dayQuery])
  if (evRes.error || dayRes.error) {
    console.error('jelenlet terminal today', evRes.error?.message ?? dayRes.error?.message)
    return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 })
  }

  const events = (evRes.data ?? []).map(e => ({
    employee_id: e.employee_id as string,
    scan_time_hms: parseScanTime(e.scan_time as string)?.hms ?? '00:00:00',
    scan_type: e.scan_type as ScanBase,
    scan_source: e.scan_source as ScanSource
  }))

  const logs = buildTerminalLogs(workDate, events, (dayRes.data ?? []) as never)
  return NextResponse.json({ date: workDate, logs })
}
