/** Kategória lista URL-paraméterei — szerver és kliens közös (doc 40 §3d). */

export const CATALOG_PAGE_SIZE = 24
/** „Továbbiak betöltése” kumulatív: ?page=N → az első N×24 termék. */
export const CATALOG_MAX_PAGES = 20

export const CATALOG_PARAM = {
  sort: 'rendezes',
  inStock: 'raktaron',
  priceMin: 'ar-tol',
  priceMax: 'ar-ig',
  page: 'page'
} as const

export type CatalogSort = 'ajanlott' | 'ar-nov' | 'ar-csokk' | 'uj' | 'ertekeles'

export const CATALOG_SORTS: { value: CatalogSort; label: string }[] = [
  { value: 'ajanlott', label: 'Ajánlott' },
  { value: 'ar-nov', label: 'Legolcsóbb elöl' },
  { value: 'ar-csokk', label: 'Legdrágább elöl' },
  { value: 'uj', label: 'Legújabb elöl' },
  { value: 'ertekeles', label: 'Legjobbra értékelt' }
]

export function parseCatalogSort(v: string | undefined): CatalogSort {
  return CATALOG_SORTS.some((s) => s.value === v) ? (v as CatalogSort) : 'ajanlott'
}

export function parsePriceParam(v: string | undefined): number | null {
  if (!v) return null
  const n = Number.parseInt(v.replace(/\D/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function parsePageParam(v: string | undefined): number {
  const n = Number.parseInt(v ?? '1', 10)
  return Math.min(CATALOG_MAX_PAGES, Math.max(1, Number.isFinite(n) ? n : 1))
}

export type CatalogParams = Record<string, string | undefined>

/** Szűrő/rendezés változáskor a lapozás mindig visszaáll. */
export function catalogHref(
  base: string,
  params: CatalogParams,
  patch: CatalogParams
): string {
  const next = new URLSearchParams()
  const merged: CatalogParams = { ...params, [CATALOG_PARAM.page]: undefined, ...patch }
  for (const [k, v] of Object.entries(merged)) {
    if (v) next.set(k, v)
  }
  const s = next.toString()
  return s ? `${base}?${s}` : base
}
