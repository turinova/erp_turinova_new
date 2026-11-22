import type { SupabaseClient } from '@supabase/supabase-js'

/** Hány napnyi megrendelés számít a „gyakori” rangsorhoz. */
export const KIOSK_POPULAR_SHEETS_DAYS = 90

/** Max panel sor a aggregáláshoz (lean bootstrap). */
const PANEL_FETCH_LIMIT = 8000

/**
 * Tenant quote_panels → sheet_material_id gyakoriság (SUM quantity).
 * Csak megrendelt (ordered_at) / nem törölt / nem cancelled quote-ok.
 */
export async function listPopularSheetMaterialIds(
  admin: SupabaseClient,
  tenantId: string,
  options?: { days?: number; limit?: number }
): Promise<string[]> {
  const days = options?.days ?? KIOSK_POPULAR_SHEETS_DAYS
  const outLimit = options?.limit ?? 40
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  const sinceIso = since.toISOString()

  const { data, error } = await admin
    .from('quote_panels')
    .select(
      `
      sheet_material_id,
      quantity,
      quotes!inner (
        tenant_id,
        ordered_at,
        deleted_at,
        status
      )
    `
    )
    .eq('quotes.tenant_id', tenantId)
    .is('quotes.deleted_at', null)
    .not('quotes.ordered_at', 'is', null)
    .gte('quotes.ordered_at', sinceIso)
    .neq('quotes.status', 'cancelled')
    .limit(PANEL_FETCH_LIMIT)

  if (error) {
    console.error('listPopularSheetMaterialIds', error.message)
    return []
  }

  const scores = new Map<string, number>()
  for (const row of data ?? []) {
    const id = row.sheet_material_id as string | null
    if (!id) continue
    const quote = Array.isArray(row.quotes) ? row.quotes[0] : row.quotes
    if (!quote || (quote as { status?: string }).status === 'cancelled') {
      continue
    }
    const qty = Number(row.quantity) || 0
    if (qty <= 0) continue
    scores.set(id, (scores.get(id) ?? 0) + qty)
  }

  return [...scores.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0])
    })
    .slice(0, outLimit)
    .map(([id]) => id)
}

/**
 * Katalógus-metszet + quote rangsor → featured lista (max `take`).
 * Fallback: raktári előbb, majd név.
 */
export function pickFeaturedSheets<
  T extends { id: string; onStock?: boolean; name?: string }
>(
  catalog: T[],
  popularIds: string[],
  take = 8
): T[] {
  if (catalog.length === 0 || take <= 0) return []

  const byId = new Map(catalog.map((s) => [s.id, s]))
  const featured: T[] = []
  const used = new Set<string>()

  for (const id of popularIds) {
    const sheet = byId.get(id)
    if (!sheet) continue
    featured.push(sheet)
    used.add(id)
    if (featured.length >= take) return featured
  }

  const rest = catalog
    .filter((s) => !used.has(s.id))
    .sort((a, b) => {
      const aStock = Boolean(a.onStock)
      const bStock = Boolean(b.onStock)
      if (aStock !== bStock) return aStock ? -1 : 1
      return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'hu')
    })

  for (const sheet of rest) {
    featured.push(sheet)
    if (featured.length >= take) break
  }

  return featured
}
