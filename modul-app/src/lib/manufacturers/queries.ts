import type { SupabaseClient } from '@supabase/supabase-js'

import type { Manufacturer } from '@/lib/supabase/database.types'

export type ManufacturerListItem = Pick<
  Manufacturer,
  | 'id'
  | 'name'
  | 'legal_name'
  | 'postal_address'
  | 'email'
  | 'website'
  | 'eu_rep_name'
  | 'eu_rep_address'
  | 'eu_rep_email'
  | 'created_at'
  | 'updated_at'
>

const GPSR_COLUMNS =
  'legal_name, postal_address, email, website, eu_rep_name, eu_rep_address, eu_rep_email'

const EMPTY_GPSR = {
  legal_name: null,
  postal_address: null,
  email: null,
  website: null,
  eu_rep_name: null,
  eu_rep_address: null,
  eu_rep_email: null
}

export async function listManufacturers(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ManufacturerListItem[]> {
  const full = await supabase
    .from('manufacturers')
    .select(`id, name, ${GPSR_COLUMNS}, created_at, updated_at`)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (!full.error) return (full.data ?? []) as ManufacturerListItem[]

  console.error('listManufacturers', full.error.message)
  const basic = await supabase
    .from('manufacturers')
    .select('id, name, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (basic.error) {
    console.error('listManufacturers', basic.error.message)
    throw new Error('Nem sikerült betölteni a gyártókat.')
  }

  return (basic.data ?? []).map((r) => ({ ...r, ...EMPTY_GPSR }))
}

/** GPSR: gyártó és (EU-n kívüli gyártónál) EU felelős személy elérhetősége. */
export function hasGpsrContact(row: {
  postal_address: string | null
  email: string | null
  website: string | null
}): boolean {
  return Boolean(row.postal_address && (row.email || row.website))
}
