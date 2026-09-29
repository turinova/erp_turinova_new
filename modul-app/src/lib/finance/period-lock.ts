import type { SupabaseClient } from '@supabase/supabase-js'

/** YYYY-MM soft-lock — teljesítés dátum hónapja. */
export async function isFinancePeriodLocked(
  supabase: SupabaseClient,
  tenantId: string,
  fulfillmentDate: string | null | undefined
): Promise<{ locked: boolean; periodYm: string | null }> {
  if (!fulfillmentDate || fulfillmentDate.length < 7) {
    return { locked: false, periodYm: null }
  }
  const periodYm = fulfillmentDate.slice(0, 7)
  const { data } = await supabase
    .from('finance_period_locks')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('period_ym', periodYm)
    .maybeSingle()
  return { locked: Boolean(data), periodYm }
}

export async function listFinancePeriodLocks(
  supabase: SupabaseClient,
  tenantId: string
) {
  const { data, error } = await supabase
    .from('finance_period_locks')
    .select('id, period_ym, locked_at, note')
    .eq('tenant_id', tenantId)
    .order('period_ym', { ascending: false })
    .limit(36)
  if (error) {
    console.error('listFinancePeriodLocks', error.message)
    return []
  }
  return data ?? []
}

export async function lockFinancePeriod(
  supabase: SupabaseClient,
  tenantId: string,
  periodYm: string,
  userId: string | null,
  note?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!/^\d{4}-\d{2}$/.test(periodYm)) {
    return { ok: false, message: 'Érvénytelen időszak (YYYY-MM).' }
  }
  const { error } = await supabase.from('finance_period_locks').upsert(
    {
      tenant_id: tenantId,
      period_ym: periodYm,
      locked_by: userId,
      note: note?.trim() || null,
      locked_at: new Date().toISOString()
    },
    { onConflict: 'tenant_id,period_ym' }
  )
  if (error) {
    console.error('lockFinancePeriod', error.message)
    return { ok: false, message: 'Nem sikerült lezárni az időszakot.' }
  }
  return { ok: true }
}

export async function unlockFinancePeriod(
  supabase: SupabaseClient,
  tenantId: string,
  periodYm: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('finance_period_locks')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('period_ym', periodYm)
  if (error) {
    console.error('unlockFinancePeriod', error.message)
    return { ok: false, message: 'Nem sikerült feloldani.' }
  }
  return { ok: true }
}
