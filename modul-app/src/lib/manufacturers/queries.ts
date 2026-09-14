import type { SupabaseClient } from '@supabase/supabase-js'

import type { Manufacturer } from '@/lib/supabase/database.types'

export type ManufacturerListItem = Pick<
  Manufacturer,
  'id' | 'name' | 'created_at' | 'updated_at'
>

export async function listManufacturers(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ManufacturerListItem[]> {
  const { data, error } = await supabase
    .from('manufacturers')
    .select('id, name, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listManufacturers', error.message)
    throw new Error('Nem sikerült betölteni a gyártókat.')
  }

  return data ?? []
}
