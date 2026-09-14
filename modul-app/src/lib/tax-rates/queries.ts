import type { SupabaseClient } from '@supabase/supabase-js'

import type { TaxRate } from '@/lib/supabase/database.types'

export type TaxRateListItem = Pick<
  TaxRate,
  'id' | 'name' | 'rate_percent' | 'is_default' | 'created_at' | 'updated_at'
>

export async function listTaxRates(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TaxRateListItem[]> {
  const { data, error } = await supabase
    .from('tax_rates')
    .select('id, name, rate_percent, is_default, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('rate_percent', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('listTaxRates', error.message)
    throw new Error('Nem sikerült betölteni az adónemeket.')
  }

  return (data ?? []).map((row) => ({
    ...row,
    rate_percent: Number(row.rate_percent)
  }))
}
