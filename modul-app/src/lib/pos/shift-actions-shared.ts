import type { SupabaseClient } from '@supabase/supabase-js'

import type { PosShiftExpected } from '@/lib/pos/shifts'

export type { PosShiftExpected }

export async function computePosShiftExpectedRpc(
  supabase: SupabaseClient,
  shiftId: string
): Promise<{ ok: true; data: PosShiftExpected } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('compute_pos_shift_expected', {
    p_shift_id: shiftId
  })
  if (error) {
    console.error('computePosShiftExpectedRpc', error.message)
    return { ok: false, message: 'Nem sikerült számolni az elvárt összeget.' }
  }
  const r = data as Record<string, unknown> | null
  if (!r || r.ok !== true) {
    return {
      ok: false,
      message: String(r?.message ?? 'Nem sikerült számolni az elvárt összeget.')
    }
  }
  return {
    ok: true,
    data: {
      opening_cash: Number(r.opening_cash),
      expected_cash: Number(r.expected_cash),
      expected_card: Number(r.expected_card),
      cash_payments: Number(r.cash_payments),
      cash_refunds: Number(r.cash_refunds),
      card_payments: Number(r.card_payments),
      card_refunds: Number(r.card_refunds),
      cash_in: Number(r.cash_in),
      cash_out: Number(r.cash_out),
      sales_count: Number(r.sales_count),
      returns_count: Number(r.returns_count),
      sales_gross_sum: Number(r.sales_gross_sum)
    }
  }
}
