import type { SupabaseClient } from '@supabase/supabase-js'

import { addDaysYmd } from '@/lib/home/date'

const REST_TYPES = new Set(['national', 'company', 'relocated_rest'])

function isWeekendYmd(ymd: string): boolean {
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay()
  return dow === 0 || dow === 6
}

/** Munkanap: hétköznap, kivéve ünnep / áthelyezett pihenőnap; áthelyezett munkanap szombaton is. */
export function isWorkdayYmd(ymd: string, calendar: Map<string, string> = new Map()): boolean {
  const type = calendar.get(ymd)
  return type === 'relocated_work' || (!isWeekendYmd(ymd) && !REST_TYPES.has(type ?? ''))
}

export function previousWorkdayYmd(
  todayYmd: string,
  calendar: Map<string, string> = new Map()
): string {
  let d = addDaysYmd(todayYmd, -1)
  for (let i = 0; i < 30; i++) {
    if (isWorkdayYmd(d, calendar)) return d
    d = addDaysYmd(d, -1)
  }
  return d
}

/** hr_work_calendar [fromYmd, toYmd) → work_date → day_type; hibánál üres (csak hétvége számít). */
export async function loadWorkCalendar(
  supabase: SupabaseClient,
  tenantId: string,
  fromYmd: string,
  toYmd: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('hr_work_calendar')
    .select('work_date, day_type')
    .eq('tenant_id', tenantId)
    .gte('work_date', fromYmd)
    .lt('work_date', toYmd)
  const calendar = new Map<string, string>()
  if (!error) {
    for (const r of data ?? []) calendar.set(String(r.work_date).slice(0, 10), String(r.day_type))
  }
  return calendar
}

/**
 * Csúszásban: ordered|in_production és production_date < előző munkanap.
 * A Jelenlét munkanaptárát (hr_work_calendar) használja, ha van; nélküle csak a hétvégét ugorja.
 */
export async function lateCutoffYmd(
  supabase: SupabaseClient,
  tenantId: string,
  todayYmd: string
): Promise<string> {
  const calendar = await loadWorkCalendar(supabase, tenantId, addDaysYmd(todayYmd, -30), todayYmd)
  return previousWorkdayYmd(todayYmd, calendar)
}
