import type { SupabaseClient } from '@supabase/supabase-js'

import type { SaleProductSearchItem } from '@/lib/sales/queries'

export type SearchPosProductsOpts = {
  limit?: number
  stockFirst?: boolean
}

type RpcRow = {
  id: string
  name: string
  sku: string
  barcode: string | null
  barcode_internal: string | null
  price_net: number | string
  tax_rate_percent: number | string
  unit_shortform: string
  image_url: string | null
  on_hand: number | string
  web_mpn: string | null
  match_score: number | string
}

function mapRpcRow(row: RpcRow): SaleProductSearchItem {
  return {
    kind: 'product',
    id: row.id,
    name: row.name,
    sku: row.sku,
    price_net: Number(row.price_net) || 0,
    tax_rate_percent: Number(row.tax_rate_percent) || 0,
    unit_shortform: row.unit_shortform || 'db',
    on_hand: Number(row.on_hand) || 0,
    image_url: row.image_url ?? null
  }
}

/**
 * Lean POS typeahead RPC (token / unaccent / alias / typo fallback + on_hand).
 * null = RPC nincs telepítve → hívó fallback a legacy keresőre.
 */
export async function searchPosProductsRpc(
  supabase: SupabaseClient,
  tenantId: string,
  warehouseId: string,
  q: string,
  opts?: SearchPosProductsOpts
): Promise<SaleProductSearchItem[] | null> {
  const safe = q.trim()
  if (!safe || !warehouseId) return []

  const { data, error } = await supabase.rpc('search_pos_products', {
    p_tenant_id: tenantId,
    p_warehouse_id: warehouseId,
    p_q: safe,
    p_limit: opts?.limit ?? 15,
    p_stock_first: opts?.stockFirst !== false
  })

  if (error) {
    if (
      /search_pos_products|schema cache|does not exist/i.test(error.message)
    ) {
      return null
    }
    console.error('searchPosProductsRpc', error.message)
    throw new Error('Nem sikerült keresni a termékek között.')
  }

  return ((data ?? []) as RpcRow[]).map(mapRpcRow)
}
