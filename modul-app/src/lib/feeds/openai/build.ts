/** OpenAI Commerce termékfeed (JSONL) — tiszta függvények, I/O nélkül. */

export type FeedKind = 'sheet' | 'linear'

export type FeedSourceRow = {
  kind: FeedKind
  id: string
  name: string
  brand: string | null
  /** linear: munkalap | asztalap | hatfal */
  materialType?: string | null
  slug: string | null
  indexable: boolean
  excluded: boolean
  imageUrl: string | null
  lengthMm: number | null
  widthMm: number | null
  thicknessMm: number | null
  priceNet: number | null
  vatPercent: number | null
  onStock: boolean
}

export type FeedConfig = {
  siteBaseUrl: string
  sheetPath: string
  linearPath: string
  country: string
  currency: string
  sellerName: string
  pickupText: string
  returnPolicyUrl: string
  returnDays: number
}

export type SkipReason =
  | 'not_indexable'
  | 'no_slug'
  | 'excluded'
  | 'no_image'
  | 'no_price'
  | 'no_brand'
  | 'no_size'

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  not_indexable: 'Nem indexelhető',
  no_slug: 'Nincs slug',
  excluded: 'Kizárva',
  no_image: 'Nincs kép',
  no_price: 'Nincs ár',
  no_brand: 'Nincs gyártó',
  no_size: 'Hiányzó méret'
}

export type FeedItem = {
  item_id: string
  title: string
  description: string
  url: string
  brand: string
  seller_name: string
  seller_url?: string
  image_url: string
  availability: 'in_stock' | 'backorder'
  price: string
  condition: 'new'
  product_category: string
  target_countries: string[]
  store_country: string
  is_eligible_search: true
  is_eligible_checkout: false
  group_id: string
  listing_has_variations: boolean
  variant_dict?: Record<string, string>
  mpn?: string
  material?: string
  dimensions?: { length: number; width: number; height: number; unit: 'mm' }
  accepts_returns: boolean
  return_deadline_in_days?: number
  return_policy?: string
}

const LINEAR_TYPE_LABEL: Record<string, string> = {
  munkalap: 'munkalap',
  asztalap: 'asztallap',
  hatfal: 'hátfal'
}

export function kindLabel(row: Pick<FeedSourceRow, 'kind' | 'materialType'>): string {
  if (row.kind === 'sheet') return 'bútorlap'
  return LINEAR_TYPE_LABEL[row.materialType ?? ''] ?? 'munkalap'
}

export function skipReason(row: FeedSourceRow): SkipReason | null {
  if (row.excluded) return 'excluded'
  if (!row.indexable) return 'not_indexable'
  if (!row.slug) return 'no_slug'
  if (!row.imageUrl || !/^https:\/\//i.test(row.imageUrl)) return 'no_image'
  if (!row.brand?.trim()) return 'no_brand'
  if (!row.lengthMm || !row.thicknessMm || (row.kind === 'sheet' && !row.widthMm)) return 'no_size'
  if (grossPrice(row) <= 0) return 'no_price'
  return null
}

/** Bruttó ár egész táblára (Ft/m² × terület) vagy szálra (Ft/m × hossz). */
export function grossPrice(row: FeedSourceRow): number {
  const net = Number(row.priceNet ?? 0)
  const vat = Number(row.vatPercent ?? 0)
  const length = Number(row.lengthMm ?? 0)
  if (!(net > 0) || !(length > 0)) return 0
  const qty = row.kind === 'sheet' ? (length * Number(row.widthMm ?? 0)) / 1e6 : length / 1000
  return Math.round(net * qty * (1 + vat / 100))
}

/** Gyártói dekorkód, pl. U702, H1145, F242, W1000. */
export function detectDecorCode(name: string): string | null {
  const m = name.match(/\b([A-Z]{1,2}\d{3,5})\b/)
  return m ? m[1] : null
}

/** Alapanyag a névből / gyártóból; ismeretlen → null (mező kimarad). */
export function detectMaterial(name: string, brand: string | null): string | null {
  const text = `${name} ${brand ?? ''}`
  if (/\bHDF\b/i.test(text)) return 'HDF'
  if (/\bMDF\b/i.test(text)) return 'MDF'
  if (/\bOSB\b/i.test(text)) return 'OSB'
  if (/rétegelt|nyír/i.test(text)) return 'Rétegelt lemez'
  if (/\bHPL\b|kompakt/i.test(text)) return 'HPL kompakt lap'
  if (/akril/i.test(text)) return 'Akril'
  return null
}

function fmtMm(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',')
}

function joinUrl(base: string, path: string, slug: string): string {
  const b = base.replace(/\/+$/, '')
  const p = `/${path.replace(/^\/+|\/+$/g, '')}`
  return `${b}${p}/${slug}`
}

function slugPart(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Ugyanaz a dekor különböző vastagságban / méretben = egy csoport. */
export function groupKey(row: FeedSourceRow): string {
  const decor = detectDecorCode(row.name)
  const base = decor ?? row.name.replace(/\b\d+([.,]\d+)?\s*mm\b/gi, '').replace(/\b\d{3,4}\s*[x×]\s*\d{3,4}\b/g, '')
  return `${row.kind === 'sheet' ? 'sm' : 'lm'}-${slugPart(`${row.brand ?? ''} ${base}`)}`
}

export function buildTitle(row: FeedSourceRow): string {
  const brand = row.brand?.trim() ?? ''
  const name = row.name.trim()
  const head = brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name
  const label = kindLabel(row)
  const withLabel = head.toLowerCase().includes(label) ? head : `${head} ${label}`
  const size =
    row.kind === 'sheet'
      ? `${fmtMm(row.thicknessMm ?? 0)} mm, ${fmtMm(row.lengthMm ?? 0)}×${fmtMm(row.widthMm ?? 0)} mm`
      : `${fmtMm(row.thicknessMm ?? 0)} mm, ${fmtMm(row.lengthMm ?? 0)} mm hosszú`
  return `${withLabel} – ${size}`.slice(0, 150)
}

export function buildDescription(row: FeedSourceRow, cfg: FeedConfig): string {
  const unit = row.kind === 'sheet' ? 'egész táblára' : 'egész szálra'
  const parts = [
    `${buildTitle(row)}.`,
    `Az ár ${unit} vonatkozik, bruttó.`,
    'Méretre vágás és élzárás rendelhető.',
    cfg.pickupText.trim() ? `Személyes átvétel: ${cfg.pickupText.trim()}` : '',
    'Méretre vágott áru nem visszaküldhető.'
  ]
  return parts.filter(Boolean).join(' ').slice(0, 5000)
}

export function buildItem(row: FeedSourceRow, cfg: FeedConfig, groupSize: number): FeedItem {
  const isSheet = row.kind === 'sheet'
  const decor = detectDecorCode(row.name)
  const material = detectMaterial(row.name, row.brand)
  const thickness = Number(row.thicknessMm ?? 0)
  const length = Number(row.lengthMm ?? 0)
  const width = Number(row.widthMm ?? 0)
  const sellerUrl = cfg.siteBaseUrl.trim()

  const item: FeedItem = {
    item_id: `${isSheet ? 'sm' : 'lm'}-${row.id}`,
    title: buildTitle(row),
    description: buildDescription(row, cfg),
    url: joinUrl(cfg.siteBaseUrl, isSheet ? cfg.sheetPath : cfg.linearPath, row.slug ?? ''),
    brand: row.brand?.trim() ?? '',
    seller_name: cfg.sellerName,
    image_url: row.imageUrl ?? '',
    availability: row.onStock ? 'in_stock' : 'backorder',
    price: `${grossPrice(row)} ${cfg.currency}`,
    condition: 'new',
    product_category: isSheet
      ? 'Otthon és kert > Bútorkészítés > Bútorlap'
      : `Otthon és kert > Konyha > ${kindLabel(row).replace(/^./, (c) => c.toUpperCase())}`,
    target_countries: [cfg.country],
    store_country: cfg.country,
    is_eligible_search: true,
    is_eligible_checkout: false,
    group_id: groupKey(row),
    listing_has_variations: groupSize > 1,
    accepts_returns: cfg.returnDays > 0
  }

  if (sellerUrl) item.seller_url = sellerUrl
  if (width > 0) item.dimensions = { length, width, height: thickness, unit: 'mm' }
  if (groupSize > 1) {
    item.variant_dict = isSheet
      ? { Vastagság: `${fmtMm(thickness)} mm`, Méret: `${fmtMm(length)}×${fmtMm(width)} mm` }
      : { Vastagság: `${fmtMm(thickness)} mm`, Hossz: `${fmtMm(length)} mm` }
  }
  if (decor) item.mpn = decor
  if (material) item.material = material
  if (cfg.returnDays > 0) item.return_deadline_in_days = cfg.returnDays
  if (cfg.returnPolicyUrl.trim()) item.return_policy = cfg.returnPolicyUrl.trim()
  return item
}

export type FeedBuildResult = {
  items: FeedItem[]
  skipped: { row: FeedSourceRow; reason: SkipReason }[]
}

export function buildFeed(rows: FeedSourceRow[], cfg: FeedConfig): FeedBuildResult {
  const ok: FeedSourceRow[] = []
  const skipped: FeedBuildResult['skipped'] = []
  for (const row of rows) {
    const reason = skipReason(row)
    if (reason) skipped.push({ row, reason })
    else ok.push(row)
  }
  const groupSizes = new Map<string, number>()
  for (const row of ok) {
    const k = groupKey(row)
    groupSizes.set(k, (groupSizes.get(k) ?? 0) + 1)
  }
  const items = ok.map((row) => buildItem(row, cfg, groupSizes.get(groupKey(row)) ?? 1))
  return { items, skipped }
}

export function toJsonl(items: FeedItem[]): string {
  return items.map((i) => JSON.stringify(i)).join('\n') + (items.length ? '\n' : '')
}
