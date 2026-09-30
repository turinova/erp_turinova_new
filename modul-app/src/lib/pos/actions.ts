'use server'

import { getSessionUser } from '@/lib/auth/session'
import { lookupPosBarcodeProduct } from '@/lib/pos/barcode-lookup'
import { createClient } from '@/lib/supabase/server'

export type PosBarcodeLookupResult =
  | {
      ok: true
      product: import('@/lib/sales/queries').SaleProductSearchItem
    }
  | { ok: false; message: string; notFound?: boolean }

/** Exact barcode / internal / sku → termék + WH on_hand (RPC). */
export async function lookupPosProductByBarcode(
  code: string,
  warehouseId: string
): Promise<PosBarcodeLookupResult> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  if (!warehouseId) {
    return { ok: false, message: 'Válaszd ki a raktárat.' }
  }

  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  return lookupPosBarcodeProduct(
    supabase,
    user.tenantId,
    code,
    warehouseId
  )
}
