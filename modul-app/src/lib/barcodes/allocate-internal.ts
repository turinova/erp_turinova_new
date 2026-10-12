import type { SupabaseClient } from '@supabase/supabase-js'

import {
  buildInternalEan13,
  INTERNAL_EAN13_PREFIX,
  randomEan13Body9
} from '@/lib/barcodes/ean13'

/**
 * Egyedi belső EAN-13 a tenantben (barcode ∪ barcode_internal).
 * Prefix 200… — bolt saját címke / POS.
 */
export async function allocateUniqueInternalEan13(
  supabase: SupabaseClient,
  tenantId: string,
  attempts = 12
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const code = buildInternalEan13(randomEan13Body9(), INTERNAL_EAN13_PREFIX)
    const { data, error } = await supabase
      .from('accessories')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .or(`barcode.eq.${code},barcode_internal.eq.${code}`)
      .limit(1)

    if (error) {
      console.error('allocateUniqueInternalEan13', error.message)
      throw new Error('Nem sikerült ellenőrizni a vonalkód egyediségét.')
    }
    if (!data || data.length === 0) return code
  }
  throw new Error('Nem sikerült egyedi vonalkódot generálni — próbáld újra.')
}
