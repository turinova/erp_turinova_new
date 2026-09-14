import type { SupabaseClient } from '@supabase/supabase-js'

export type ProductionMachineListItem = {
  id: string
  name: string
  comment: string | null
  usage_limit_per_day: number
  active: boolean
  created_at: string
  updated_at: string
}

export type ProductionMachineOption = {
  id: string
  name: string
}

export async function listProductionMachines(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProductionMachineListItem[]> {
  const { data, error } = await supabase
    .from('production_machines')
    .select(
      'id, name, comment, usage_limit_per_day, active, created_at, updated_at'
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listProductionMachines', error.message)
    throw new Error('Nem sikerült betölteni a gyártógépeket.')
  }

  return (data ?? []).map((row) => ({
    ...row,
    usage_limit_per_day: Number(row.usage_limit_per_day)
  }))
}

/** Aktív gépek a gyártásba adás selecthez. */
export async function listActiveProductionMachines(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProductionMachineOption[]> {
  const { data, error } = await supabase
    .from('production_machines')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listActiveProductionMachines', error.message)
    throw new Error('Nem sikerült betölteni a gyártógépeket.')
  }

  return data ?? []
}
