import type { SupabaseClient } from '@supabase/supabase-js'

import type { Unit } from '@/lib/supabase/database.types'

export type UnitListItem = Pick<
  Unit,
  'id' | 'name' | 'shortform' | 'created_at' | 'updated_at'
>

export async function listUnits(
  supabase: SupabaseClient,
  tenantId: string
): Promise<UnitListItem[]> {
  const { data, error } = await supabase
    .from('units')
    .select('id, name, shortform, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listUnits', error.message)
    throw new Error('Nem sikerült betölteni az egységeket.')
  }

  return data ?? []
}
