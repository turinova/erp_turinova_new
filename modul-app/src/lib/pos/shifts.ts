import type { SupabaseClient } from '@supabase/supabase-js'

export type PosRegister = {
  id: string
  warehouse_id: string
  name: string
  code: string
  is_default: boolean
  is_active: boolean
}

export type PosShiftOpen = {
  id: string
  pos_register_id: string
  warehouse_id: string
  opening_cash: number
  opened_at: string
  opened_by_label: string | null
}

export type PosShiftExpected = {
  opening_cash: number
  expected_cash: number
  expected_card: number
  cash_payments: number
  cash_refunds: number
  card_payments: number
  card_refunds: number
  cash_in: number
  cash_out: number
  sales_count: number
  returns_count: number
  sales_gross_sum: number
}

export type PosShiftListItem = {
  id: string
  status: 'open' | 'closed'
  opened_at: string
  closed_at: string | null
  opening_cash: number
  expected_cash: number | null
  counted_cash: number | null
  cash_difference: number | null
  sales_gross_sum: number
  opened_by_label: string | null
  closed_by_label: string | null
  register_name: string
  warehouse_name: string
  note: string | null
}

export type PosShiftDetail = PosShiftListItem & {
  expected_card: number | null
  counted_card: number | null
  card_difference: number | null
  sales_count: number
  returns_count: number
  pos_register_id: string
  warehouse_id: string
  cash_moves: {
    id: string
    kind: 'in' | 'out'
    amount: number
    note: string
    created_at: string
    created_by_label: string | null
  }[]
}

export async function listPosRegisters(
  supabase: SupabaseClient,
  tenantId: string,
  warehouseId?: string
): Promise<PosRegister[]> {
  let q = supabase
    .from('pos_registers')
    .select('id, warehouse_id, name, code, is_default, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (warehouseId) q = q.eq('warehouse_id', warehouseId)
  const { data, error } = await q
  if (error) {
    console.error('listPosRegisters', error.message)
    throw new Error('Nem sikerült betölteni a pénztárakat.')
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    warehouse_id: r.warehouse_id,
    name: r.name,
    code: r.code,
    is_default: Boolean(r.is_default),
    is_active: Boolean(r.is_active)
  }))
}

export async function getOpenPosShift(
  supabase: SupabaseClient,
  tenantId: string,
  registerId: string
): Promise<PosShiftOpen | null> {
  const { data, error } = await supabase
    .from('pos_shifts')
    .select(
      'id, pos_register_id, warehouse_id, opening_cash, opened_at, opened_by_label'
    )
    .eq('tenant_id', tenantId)
    .eq('pos_register_id', registerId)
    .eq('status', 'open')
    .maybeSingle()
  if (error) {
    console.error('getOpenPosShift', error.message)
    throw new Error('Nem sikerült betölteni a műszakot.')
  }
  if (!data) return null
  return {
    id: data.id,
    pos_register_id: data.pos_register_id,
    warehouse_id: data.warehouse_id,
    opening_cash: Number(data.opening_cash),
    opened_at: data.opened_at,
    opened_by_label: data.opened_by_label
  }
}

export async function listPosShifts(
  supabase: SupabaseClient,
  params: {
    tenantId: string
    page?: number
    limit?: number
    diffOnly?: boolean
    status?: 'open' | 'closed' | 'all'
  }
): Promise<{ rows: PosShiftListItem[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let q = supabase
    .from('pos_shifts')
    .select(
      `
      id, status, opened_at, closed_at, opening_cash,
      expected_cash, counted_cash, cash_difference, sales_gross_sum,
      opened_by_label, closed_by_label, note,
      pos_registers ( name ),
      warehouses ( name )
    `,
      { count: 'exact' }
    )
    .eq('tenant_id', params.tenantId)
    .order('opened_at', { ascending: false })
    .range(from, to)

  if (params.status === 'open' || params.status === 'closed') {
    q = q.eq('status', params.status)
  }
  if (params.diffOnly) {
    q = q.neq('cash_difference', 0).not('cash_difference', 'is', null)
  }

  const { data, error, count } = await q
  if (error) {
    console.error('listPosShifts', error.message)
    throw new Error('Nem sikerült betölteni a műszakokat.')
  }

  const rows: PosShiftListItem[] = (data ?? []).map((row) => {
    const reg = row.pos_registers as { name: string } | { name: string }[] | null
    const regOne = Array.isArray(reg) ? reg[0] : reg
    const wh = row.warehouses as { name: string } | { name: string }[] | null
    const whOne = Array.isArray(wh) ? wh[0] : wh
    return {
      id: row.id,
      status: row.status as 'open' | 'closed',
      opened_at: row.opened_at,
      closed_at: row.closed_at,
      opening_cash: Number(row.opening_cash),
      expected_cash:
        row.expected_cash == null ? null : Number(row.expected_cash),
      counted_cash:
        row.counted_cash == null ? null : Number(row.counted_cash),
      cash_difference:
        row.cash_difference == null ? null : Number(row.cash_difference),
      sales_gross_sum: Number(row.sales_gross_sum ?? 0),
      opened_by_label: row.opened_by_label,
      closed_by_label: row.closed_by_label,
      register_name: regOne?.name ?? '—',
      warehouse_name: whOne?.name ?? '—',
      note: row.note
    }
  })

  return { rows, total: count ?? rows.length, page, limit }
}

export async function getPosShift(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<PosShiftDetail | null> {
  const { data, error } = await supabase
    .from('pos_shifts')
    .select(
      `
      id, status, opened_at, closed_at, opening_cash,
      expected_cash, counted_cash, cash_difference,
      expected_card, counted_card, card_difference,
      sales_count, returns_count, sales_gross_sum,
      opened_by_label, closed_by_label, note,
      pos_register_id, warehouse_id,
      pos_registers ( name ),
      warehouses ( name ),
      pos_shift_cash_moves (
        id, kind, amount, note, created_at, created_by_label
      )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('getPosShift', error.message)
    throw new Error('Nem sikerült betölteni a műszakot.')
  }
  if (!data) return null

  const reg = data.pos_registers as { name: string } | { name: string }[] | null
  const regOne = Array.isArray(reg) ? reg[0] : reg
  const wh = data.warehouses as { name: string } | { name: string }[] | null
  const whOne = Array.isArray(wh) ? wh[0] : wh
  const moves = (data.pos_shift_cash_moves ?? []) as {
    id: string
    kind: 'in' | 'out'
    amount: number
    note: string
    created_at: string
    created_by_label: string | null
  }[]

  return {
    id: data.id,
    status: data.status as 'open' | 'closed',
    opened_at: data.opened_at,
    closed_at: data.closed_at,
    opening_cash: Number(data.opening_cash),
    expected_cash:
      data.expected_cash == null ? null : Number(data.expected_cash),
    counted_cash:
      data.counted_cash == null ? null : Number(data.counted_cash),
    cash_difference:
      data.cash_difference == null ? null : Number(data.cash_difference),
    expected_card:
      data.expected_card == null ? null : Number(data.expected_card),
    counted_card:
      data.counted_card == null ? null : Number(data.counted_card),
    card_difference:
      data.card_difference == null ? null : Number(data.card_difference),
    sales_count: Number(data.sales_count ?? 0),
    returns_count: Number(data.returns_count ?? 0),
    sales_gross_sum: Number(data.sales_gross_sum ?? 0),
    opened_by_label: data.opened_by_label,
    closed_by_label: data.closed_by_label,
    register_name: regOne?.name ?? '—',
    warehouse_name: whOne?.name ?? '—',
    note: data.note,
    pos_register_id: data.pos_register_id,
    warehouse_id: data.warehouse_id,
    cash_moves: moves
      .map((m) => ({
        id: m.id,
        kind: m.kind,
        amount: Number(m.amount),
        note: m.note,
        created_at: m.created_at,
        created_by_label: m.created_by_label
      }))
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
  }
}
