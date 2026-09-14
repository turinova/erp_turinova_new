import type { SupabaseClient } from '@supabase/supabase-js'

import type { Equipment } from '@/lib/supabase/database.types'
import {
  isExportFormat,
  type ExportFormat
} from '@/lib/quotes/export/types'

export type EquipmentListItem = Pick<
  Equipment,
  'id' | 'name' | 'export_format' | 'created_at' | 'updated_at'
> & {
  export_format: ExportFormat
}

export async function listEquipment(
  supabase: SupabaseClient,
  tenantId: string
): Promise<EquipmentListItem[]> {
  const { data, error } = await supabase
    .from('equipment')
    .select('id, name, export_format, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listEquipment', error.message)
    throw new Error('Nem sikerült betölteni a berendezéseket.')
  }

  return (data ?? []).map((row) => ({
    ...row,
    export_format: isExportFormat(row.export_format)
      ? row.export_format
      : 'korpus'
  }))
}
