import type { SupabaseClient } from '@supabase/supabase-js'

import type { HrEmployeeTypeRow } from '@/lib/jelenlet/types'

function mapType(row: Record<string, unknown>): HrEmployeeTypeRow {
  return {
    id: row.id as string,
    name: row.name as string,
    code: (row.code as string) ?? '',
    sortOrder: Number(row.sort_order) || 100,
    active: Boolean(row.active),
    isDefault: Boolean(row.is_default)
  }
}

export async function listEmployeeTypes(
  supabase: SupabaseClient,
  tenantId: string,
  opts?: { includeInactive?: boolean }
): Promise<HrEmployeeTypeRow[]> {
  let query = supabase
    .from('hr_employee_types')
    .select('id, name, code, sort_order, active, is_default')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (!opts?.includeInactive) {
    query = query.eq('active', true)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapType(r as Record<string, unknown>))
}

export async function listEmployeeTypeOptions(
  supabase: SupabaseClient,
  tenantId: string,
  opts?: { includeId?: string }
): Promise<Array<{ id: string; name: string; isDefault: boolean }>> {
  const rows = await listEmployeeTypes(supabase, tenantId, {
    includeInactive: Boolean(opts?.includeId)
  })
  const filtered = opts?.includeId
    ? rows.filter((r) => r.active || r.id === opts.includeId)
    : rows
  return filtered.map((r) => ({
    id: r.id,
    name: r.name,
    isDefault: r.isDefault
  }))
}
