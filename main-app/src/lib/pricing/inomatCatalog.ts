/**
 * INOMAT front color catalog — UI + pricing helpers.
 * Prefer DB rows (`nettfront_skus`); static list is fallback before migration.
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

const FALLBACK_COST = 25_000
const FALLBACK_SELL = 35_000

function grossFromNet(sellNet: number): number {
  return Math.round(sellNet * (1 + NETTFRONT_VAT_RATE))
}

function colorDef(
  id: string,
  label: string,
  group: InomatColorGroup,
  swatchHex: string,
  costNet = FALLBACK_COST,
  sellNet = FALLBACK_SELL,
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

/** Fallback seed (migration előtt / üres lekérdezés) */
export const INOMAT_MATT_COLORS: InomatColorDef[] = [
  colorDef('bronze', 'Bronze', 'matt', '#8B6914'),
  colorDef('cedar-green', 'Cedar Green', 'matt', '#5C6B4F'),
  colorDef('dune-beige', 'Dune Beige', 'matt', '#C4B59A'),
  colorDef('ivory-white', 'Ivory White', 'matt', '#F5F0E6'),
  colorDef('lava-black', 'Lava Black', 'matt', '#2A2A2A'),
  colorDef('midnight-blue', 'Midnight Blue', 'matt', '#1E3A5F'),
  colorDef('mist-grey', 'Mist Grey', 'matt', '#B8B8B8'),
  colorDef('palo-santo-beige', 'Palo Santo Beige', 'matt', '#D4C4A8')
]

export const INOMAT_HG_COLORS: InomatColorDef[] = [
  colorDef('pearl', 'Pearl', 'hg', '#E8E4DC'),
  colorDef('pure-white', 'Pure White', 'hg', '#FAFAFA'),
  colorDef('storm-grey', 'Storm Grey', 'hg', '#7A7A7A'),
  colorDef('gold', 'Gold', 'hg', '#C9A227'),
  colorDef('hg-dune-beige', 'Hg Dune Beige', 'hg', '#D8C9AE'),
  colorDef('hg-ivory-white', 'Hg Ivory White', 'hg', '#F8F4EA'),
  colorDef('hg-palo-santo-beige', 'Hg Palo Santo Beige', 'hg', '#E0D0B4'),
  colorDef('hg-pure-white', 'Hg Pure White', 'hg', '#FFFFFF')
]

export const INOMAT_ALL_COLORS: InomatColorDef[] = [...INOMAT_MATT_COLORS, ...INOMAT_HG_COLORS]

export const INOMAT_SZIN_OPTIONS = INOMAT_ALL_COLORS.map(c => c.label)

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
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  if (!inomat.length) return INOMAT_ALL_COLORS

  return inomat.map(r =>
    colorDef(
      r.sku_code,
      r.display_name,
      r.finish as InomatColorGroup,
      r.swatch_hex || '#CCCCCC',
      Number(r.cost_net_per_sqm) || FALLBACK_COST,
      Number(r.sell_net_per_sqm) || FALLBACK_SELL,
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
  catalog: InomatColorDef[] = INOMAT_ALL_COLORS
): InomatColorDef | undefined {
  return byLabelMap(catalog).get(label.trim().toLowerCase())
}

export function normalizeInomatSzin(
  raw: string | null | undefined,
  catalog: InomatColorDef[] = INOMAT_ALL_COLORS
): string {
  const s = (raw ?? '').trim()
  const fallback = catalog[0]?.label ?? 'Bronze'

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

export function sellNetPerSqmForInomatSzin(
  szin: string,
  catalog: InomatColorDef[] = INOMAT_ALL_COLORS
): number {
  const def = getInomatColorDef(normalizeInomatSzin(szin, catalog), catalog)

  return def?.sellNetPerSqm ?? FALLBACK_SELL
}

export function grossPerSqmForInomatSzin(
  szin: string,
  catalog: InomatColorDef[] = INOMAT_ALL_COLORS
): number {
  const def = getInomatColorDef(normalizeInomatSzin(szin, catalog), catalog)

  return def?.grossPerSqm ?? grossFromNet(FALLBACK_SELL)
}

export function isInomatSzin(value: string, catalog: InomatColorDef[] = INOMAT_ALL_COLORS): boolean {
  return byLabelMap(catalog).has(value.trim().toLowerCase())
}

export function getInomatFinishLabel(
  szin: string,
  catalog: InomatColorDef[] = INOMAT_ALL_COLORS
): 'Matt' | 'Fényes' {
  const def = getInomatColorDef(normalizeInomatSzin(szin, catalog), catalog)

  return def?.group === 'hg' ? 'Fényes' : 'Matt'
}

export function getInomatFinishGroup(
  szin: string,
  catalog: InomatColorDef[] = INOMAT_ALL_COLORS
): InomatColorGroup {
  const def = getInomatColorDef(normalizeInomatSzin(szin, catalog), catalog)

  return def?.group ?? 'matt'
}
