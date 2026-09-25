import type { SupabaseClient } from '@supabase/supabase-js'

/** PostgREST URL-hossz miatt az `.in()` listát darabolni kell. */
const CHUNK = 200

/**
 * Nyitott beszállítói rendelések legkorábbi várható napja (YYYY-MM-DD) termékenként.
 * Csak jövőbeli dátum számít — a lejárt ígéret nem kommunikálható a vevő felé.
 */
export async function loadExpectedArrivals(
  admin: SupabaseClient,
  tenantId: string,
  accessoryIds: string[]
): Promise<Map<string, string>> {
  const ids = [...new Set(accessoryIds)]
  const out = new Map<string, string>()
  if (ids.length === 0) return out
  const today = new Date().toISOString().slice(0, 10)

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const { data, error } = await admin
      .from('purchase_order_items')
      .select('accessory_id, purchase_orders!inner ( expected_date, status, deleted_at )')
      .eq('tenant_id', tenantId)
      .in('accessory_id', chunk)
      .is('deleted_at', null)
      .in('purchase_orders.status', ['ordered', 'partial'])
      .is('purchase_orders.deleted_at', null)
      .gte('purchase_orders.expected_date', today)
      .limit(chunk.length * 10)
    if (error) {
      console.error('loadExpectedArrivals', error.message)
      return out
    }
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const po = (Array.isArray(r.purchase_orders) ? r.purchase_orders[0] : r.purchase_orders) as {
        expected_date?: string | null
      } | null
      const date = po?.expected_date
      const id = String(r.accessory_id)
      if (!date) continue
      const prev = out.get(id)
      if (!prev || date < prev) out.set(id, date)
    }
  }
  return out
}
