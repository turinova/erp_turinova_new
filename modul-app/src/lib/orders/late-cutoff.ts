import type { SupabaseClient } from '@supabase/supabase-js'

import { addDaysYmd } from '@/lib/home/date'

const REST_TYPES = new Set(['national', 'company', 'relocated_rest'])

function isWeekendYmd(ymd: string): boolean {
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay()
  return dow === 0 || dow === 6
}

/** Munkanap: hétköznap, kivéve ünnep / áthelyezett pihenőnap; áthelyezett munkanap szombaton is. */
export function previousWorkdayYmd(
  todayYmd: string,
  calendar: Map<string, string> = new Map()
): string {
  let d = addDaysYmd(todayYmd, -1)
  for (let i = 0; i < 30; i++) {
    const type = calendar.get(d)
    const workday = type === 'relocated_work' || (!isWeekendYmd(d) && !REST_TYPES.has(type ?? ''))
    if (workday) return d
    d = addDaysYmd(d, -1)
  }
  return d
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
  const { data, error } = await supabase
    .from('hr_work_calendar')
    .select('work_date, day_type')
    .eq('tenant_id', tenantId)
    .gte('work_date', addDaysYmd(todayYmd, -30))
    .lt('work_date', todayYmd)
  const calendar = new Map<string, string>()
  if (!error) {
    for (const r of data ?? []) calendar.set(String(r.work_date).slice(0, 10), String(r.day_type))
  }
  return previousWorkdayYmd(todayYmd, calendar)
}
