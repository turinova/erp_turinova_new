import type { SupabaseClient } from '@supabase/supabase-js'

/** Bolt szintű napi POS eladás cél (default). */
export const DEFAULT_DAILY_POS_SALES_GOAL = 60

export type PosScanSource =
  | 'barcode'
  | 'typeahead'
  | 'quick'
  | 'recent'
  | 'frequent'

export type PosAdoptionUserRow = {
  user_label: string
  user_id: string | null
  sales_count: number
  sales_sum: number
}

export type PosAdoptionStats = {
  daily_sales_target: number
  sales_count: number
  sales_sum: number
  barcode_scans: number
  typeahead_picks: number
  other_picks: number
  shifts_open: number
  shifts_closed: number
  by_user: PosAdoptionUserRow[]
}

export type PosAdoptionAward = {
  id: string
  week_start: string
  user_label: string
  user_id: string | null
  metric_value: number
  reward_note: string
  awarded_by_label: string | null
  created_at: string
}

export type PosAdoptionRange = 'today' | 'week' | 'month'

function startOfLocalDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Hétfő 00:00 local. */
export function startOfWeekMonday(d = new Date()) {
  const x = startOfLocalDay(d)
  const day = x.getDay() // 0 Sun
  const diff = day === 0 ? -6 : 1 - day
  return addDays(x, diff)
}

export function toLocalDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function rangeBounds(range: PosAdoptionRange): {
  from: Date
  to: Date
} {
  const now = new Date()
  const today = startOfLocalDay(now)
  if (range === 'today') {
    return { from: today, to: addDays(today, 1) }
  }
  if (range === 'week') {
    const from = startOfWeekMonday(now)
    return { from, to: addDays(from, 7) }
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { from, to }
}

export async function logPosScanEvent(
  supabase: SupabaseClient,
  input: {
    tenantId: string
    warehouseId: string | null
    registerId: string | null
    shiftId?: string | null
    userId: string | null
    source: PosScanSource
    accessoryId?: string | null
  }
): Promise<void> {
  const { error } = await supabase.from('pos_scan_events').insert({
    tenant_id: input.tenantId,
    warehouse_id: input.warehouseId,
    register_id: input.registerId,
    shift_id: input.shiftId ?? null,
    user_id: input.userId,
    source: input.source,
    accessory_id: input.accessoryId ?? null
  })
  if (error && !/pos_scan_events|schema cache|does not exist/i.test(error.message)) {
    console.error('logPosScanEvent', error.message)
  }
}

function mapStats(raw: unknown): PosAdoptionStats {
  const o = (raw ?? {}) as Record<string, unknown>
  const byUserRaw = Array.isArray(o.by_user) ? o.by_user : []
  return {
    daily_sales_target:
      Number(o.daily_sales_target) || DEFAULT_DAILY_POS_SALES_GOAL,
    sales_count: Number(o.sales_count) || 0,
    sales_sum: Number(o.sales_sum) || 0,
    barcode_scans: Number(o.barcode_scans) || 0,
    typeahead_picks: Number(o.typeahead_picks) || 0,
    other_picks: Number(o.other_picks) || 0,
    shifts_open: Number(o.shifts_open) || 0,
    shifts_closed: Number(o.shifts_closed) || 0,
    by_user: byUserRaw.map((row) => {
      const r = row as Record<string, unknown>
      return {
        user_label: String(r.user_label ?? 'Ismeretlen'),
        user_id: (r.user_id as string | null) ?? null,
        sales_count: Number(r.sales_count) || 0,
        sales_sum: Number(r.sales_sum) || 0
      }
    })
  }
}

export async function loadPosAdoptionStats(
  supabase: SupabaseClient,
  tenantId: string,
  range: PosAdoptionRange,
  warehouseId?: string | null
): Promise<PosAdoptionStats> {
  const { from, to } = rangeBounds(range)
  const { data, error } = await supabase.rpc('pos_adoption_stats', {
    p_tenant_id: tenantId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_warehouse_id: warehouseId || null
  })
  if (error) {
    if (/pos_adoption_stats|schema cache|does not exist/i.test(error.message)) {
      return {
        daily_sales_target: DEFAULT_DAILY_POS_SALES_GOAL,
        sales_count: 0,
        sales_sum: 0,
        barcode_scans: 0,
        typeahead_picks: 0,
        other_picks: 0,
        shifts_open: 0,
        shifts_closed: 0,
        by_user: []
      }
    }
    console.error('loadPosAdoptionStats', error.message)
    throw new Error('Nem sikerült betölteni a POS használati adatokat.')
  }
  return mapStats(data)
}

export async function getDailySalesTarget(
  supabase: SupabaseClient,
  tenantId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('pos_adoption_goals')
    .select('daily_sales_target')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) {
    if (/pos_adoption_goals|does not exist/i.test(error.message)) {
      return DEFAULT_DAILY_POS_SALES_GOAL
    }
    console.error('getDailySalesTarget', error.message)
    return DEFAULT_DAILY_POS_SALES_GOAL
  }
  return Number(data?.daily_sales_target) || DEFAULT_DAILY_POS_SALES_GOAL
}

export async function upsertDailySalesTarget(
  supabase: SupabaseClient,
  tenantId: string,
  target: number,
  userId: string | null
): Promise<void> {
  const safe = Math.max(1, Math.min(5000, Math.floor(target)))
  const { error } = await supabase.from('pos_adoption_goals').upsert(
    {
      tenant_id: tenantId,
      daily_sales_target: safe,
      updated_at: new Date().toISOString(),
      updated_by: userId
    },
    { onConflict: 'tenant_id' }
  )
  if (error) {
    console.error('upsertDailySalesTarget', error.message)
    throw new Error('Nem sikerült menteni a napi célt.')
  }
}

export async function listPosAdoptionAwards(
  supabase: SupabaseClient,
  tenantId: string,
  limit = 8
): Promise<PosAdoptionAward[]> {
  const { data, error } = await supabase
    .from('pos_adoption_awards')
    .select(
      'id, week_start, user_label, user_id, metric_value, reward_note, awarded_by_label, created_at'
    )
    .eq('tenant_id', tenantId)
    .order('week_start', { ascending: false })
    .limit(limit)
  if (error) {
    if (/pos_adoption_awards|does not exist/i.test(error.message)) return []
    console.error('listPosAdoptionAwards', error.message)
    throw new Error('Nem sikerült betölteni a heti díjazottakat.')
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    week_start: String(r.week_start),
    user_label: String(r.user_label),
    user_id: (r.user_id as string | null) ?? null,
    metric_value: Number(r.metric_value) || 0,
    reward_note: String(r.reward_note ?? ''),
    awarded_by_label: (r.awarded_by_label as string | null) ?? null,
    created_at: String(r.created_at)
  }))
}

export async function upsertPosAdoptionAward(
  supabase: SupabaseClient,
  input: {
    tenantId: string
    weekStart: string
    userId: string | null
    userLabel: string
    metricValue: number
    rewardNote: string
    awardedBy: string | null
    awardedByLabel: string | null
  }
): Promise<void> {
  const { error } = await supabase.from('pos_adoption_awards').upsert(
    {
      tenant_id: input.tenantId,
      week_start: input.weekStart,
      user_id: input.userId,
      user_label: input.userLabel.trim() || 'Ismeretlen',
      metric_value: input.metricValue,
      reward_note: input.rewardNote.trim(),
      awarded_by: input.awardedBy,
      awarded_by_label: input.awardedByLabel
    },
    { onConflict: 'tenant_id,week_start' }
  )
  if (error) {
    console.error('upsertPosAdoptionAward', error.message)
    throw new Error('Nem sikerült menteni a heti győztest.')
  }
}
