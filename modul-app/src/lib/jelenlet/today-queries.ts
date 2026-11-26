import type { SupabaseClient } from '@supabase/supabase-js'

import { parseScanTime } from '@/lib/jelenlet/terminal-v2'
import { createServiceClient } from '@/lib/supabase/service'

export type TodayScanEvent = {
  employeeId: string
  hm: string
  type: 'arrival' | 'departure'
  source: 'rfid' | 'pin'
}

export type TerminalStatus = {
  name: string
  online: boolean
  lastContactAt: string | null
  appVersion: string | null
  pendingCount: number | null
}

export type JelenletTodayData = {
  events: TodayScanEvent[]
  terminals: TerminalStatus[]
}

const ONLINE_MS = 3 * 60 * 1000

export async function getJelenletToday(
  supabase: SupabaseClient,
  input: { tenantId: string; workDate: string }
): Promise<JelenletTodayData> {
  const evPromise = supabase
    .from('hr_attendance_events')
    .select('employee_id, scan_time, scan_type, scan_source')
    .eq('tenant_id', input.tenantId)
    .eq('work_date', input.workDate)
    .order('scan_time')
    .limit(1000)

  // Eszköztábla platform-only RLS — csak státusz mezők, a saját tenantra.
  const service = createServiceClient()
  const devPromise = service
    ? service
        .from('jelenlet_devices')
        .select('name, slug, last_seen_at, last_heartbeat_at, app_version, pending_count')
        .eq('tenant_id', input.tenantId)
        .limit(10)
    : Promise.resolve({ data: [], error: null })

  const [evRes, devRes] = await Promise.all([evPromise, devPromise])

  const events: TodayScanEvent[] = (evRes.data ?? []).flatMap((e) => {
    const parsed = parseScanTime(e.scan_time as string)
    if (!parsed) return []
    return [
      {
        employeeId: e.employee_id as string,
        hm: parsed.hm,
        type: e.scan_type as TodayScanEvent['type'],
        source: e.scan_source as TodayScanEvent['source']
      }
    ]
  })

  const now = Date.now()
  const terminals: TerminalStatus[] = ((devRes.data ?? []) as Record<string, unknown>[]).map((d) => {
    const hb = (d.last_heartbeat_at as string | null) ?? null
    const seen = (d.last_seen_at as string | null) ?? null
    const last = [hb, seen].filter(Boolean).sort().pop() ?? null
    return {
      name: ((d.name as string) || (d.slug as string)) ?? 'Terminál',
      online: Boolean(hb && now - Date.parse(hb) < ONLINE_MS),
      lastContactAt: last,
      appVersion: (d.app_version as string | null) ?? null,
      pendingCount: (d.pending_count as number | null) ?? null
    }
  })

  return { events, terminals }
}
