/**
 * INOMAT front color catalog — UI + pricing helpers.
 * Prices come only from `nettfront_skus` (no hardcoded fallback).
 */

export const NETTFRONT_VAT_RATE = 0.27

export type InomatColorGroup = 'matt' | 'hg'

export type InomatColorDef = {
  id: string
  /** DB uuid when loaded from nettfront_skus */
  skuId?: string
  label: string
  group: InomatColorGroup
  /** UI swatch */
  swatchHex: string
  /** Bekerülés nettó Ft/m² */
  costNetPerSqm: number
  /** Eladás nettó Ft/m² */
  sellNetPerSqm: number
  /** Eladás bruttó Ft/m² (ÁFA 27%) — UI megjelenítés */
  grossPerSqm: number
}

/** DB row shape from `nettfront_skus` */
export type NettfrontSkuRow = {
  id: string
  front_type: string
  sku_code: string
  display_name: string
  finish: string | null
  swatch_hex: string | null
  cost_net_per_sqm: number
  sell_net_per_sqm: number
  is_active: boolean
  sort_order: number
}

function grossFromNet(sellNet: number): number {
  return Math.round(sellNet * (1 + NETTFRONT_VAT_RATE))
}

function colorDef(
  id: string,
  label: string,
  group: InomatColorGroup,
  swatchHex: string,
  costNet: number,
  sellNet: number,
  skuId?: string
): InomatColorDef {
  return {
    id,
    skuId,
    label,
    group,
    swatchHex,
    costNetPerSqm: costNet,
    sellNetPerSqm: sellNet,
    grossPerSqm: grossFromNet(sellNet)
  }
}

/** @deprecated Empty — catalog must come from DB via buildInomatCatalogFromSkus */
export const INOMAT_MATT_COLORS: InomatColorDef[] = []
/** @deprecated Empty — catalog must come from DB via buildInomatCatalogFromSkus */
export const INOMAT_HG_COLORS: InomatColorDef[] = []
/** @deprecated Empty — catalog must come from DB via buildInomatCatalogFromSkus */
export const INOMAT_ALL_COLORS: InomatColorDef[] = []

export const INOMAT_SZIN_OPTIONS: string[] = []

export type InomatSzin = string

/** Legacy HU / typo aliases → canonical label */
const ALIASES: Record<string, string> = {
  bronz: 'Bronze',
  bronze: 'Bronze',
  pearl: 'Pearl',
  gold: 'Gold',
  arany: 'Gold',
  'pure white': 'Pure White',
  purewhite: 'Pure White',
  'pure white hg': 'Hg Pure White',
  'hg pure white': 'Hg Pure White'
}

export function buildInomatCatalogFromSkus(rows: NettfrontSkuRow[]): InomatColorDef[] {
  const inomat = rows
    .filter(r => r.front_type === 'inomat' && r.is_active !== false)
    .filter(r => r.finish === 'matt' || r.finish === 'hg')
    .filter(r => Number(r.sell_net_per_sqm) > 0)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  return inomat.map(r =>
    colorDef(
      r.sku_code,
      r.display_name,
      r.finish as InomatColorGroup,
      r.swatch_hex || '#CCCCCC',
      Number(r.cost_net_per_sqm) || 0,
      Number(r.sell_net_per_sqm),
      r.id
    )
  )
}

export function splitInomatCatalog(catalog: InomatColorDef[]): {
  matt: InomatColorDef[]
  hg: InomatColorDef[]
} {
  return {
    matt: catalog.filter(c => c.group === 'matt'),
    hg: catalog.filter(c => c.group === 'hg')
  }
}

function byLabelMap(catalog: InomatColorDef[]) {
  return new Map(catalog.map(c => [c.label.toLowerCase(), c]))
}

export function getInomatColorDef(
  label: string,
  catalog: InomatColorDef[] = []
): InomatColorDef | undefined {
  return byLabelMap(catalog).get(label.trim().toLowerCase())
}

export function normalizeInomatSzin(
  raw: string | null | undefined,
  catalog: InomatColorDef[] = []
): string {
  const s = (raw ?? '').trim()
  const fallback = catalog[0]?.label ?? ''

  if (!s) return fallback

  const alias = ALIASES[s.toLowerCase()]

  if (alias && byLabelMap(catalog).has(alias.toLowerCase())) return alias

  const exact = byLabelMap(catalog).get(s.toLowerCase())

  if (exact) return exact.label

  const lower = s.toLowerCase()

  if (lower.startsWith('bronz') || lower.startsWith('bronze')) {
    const bronze = catalog.find(c => c.label === 'Bronze')

    if (bronze) return bronze.label
  }

  if (lower.startsWith('pearl')) {
    const pearl = catalog.find(c => c.label === 'Pearl')

    if (pearl) return pearl.label
  }

  if (lower === 'gold' || lower.startsWith('gold ')) {
    const gold = catalog.find(c => c.label === 'Gold')

    if (gold) return gold.label
  }

  return fallback
}

export function sellNetPerSqmForInomatSzin(szin: string, catalog: InomatColorDef[] = []): number {
  const def = getInomatColorDef(normalizeInomatSzin(szin, catalog), catalog)

  return def?.sellNetPerSqm ?? 0
}

export function grossPerSqmForInomatSzin(szin: string, catalog: InomatColorDef[] = []): number {
  const def = getInomatColorDef(normalizeInomatSzin(szin, catalog), catalog)

  return def?.grossPerSqm ?? 0
}

export function isInomatSzin(value: string, catalog: InomatColorDef[] = []): boolean {
  return byLabelMap(catalog).has(value.trim().toLowerCase())
}

export function getInomatFinishLabel(
  szin: string,
  catalog: InomatColorDef[] = []
): 'Matt' | 'Fényes' {
  const def = getInomatColorDef(normalizeInomatSzin(szin, catalog), catalog)

  return def?.group === 'hg' ? 'Fényes' : 'Matt'
}

export function getInomatFinishGroup(
  szin: string,
  catalog: InomatColorDef[] = []
): InomatColorGroup {
  const def = getInomatColorDef(normalizeInomatSzin(szin, catalog), catalog)

  return def?.group ?? 'matt'
}
