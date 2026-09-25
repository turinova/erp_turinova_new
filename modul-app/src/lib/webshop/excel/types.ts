/** Bolt import előnézet / eredmény — kliens is importálhatja (nincs szerver függőség). */

export type ShopXSheet = 'products' | 'specs' | 'faq' | 'related' | 'documents' | 'groups' | 'categories' | 'attributes'

export const SHOP_X_SHEETS: ShopXSheet[] = ['products', 'specs', 'faq', 'related', 'documents', 'groups', 'categories', 'attributes']

export const SHOP_X_SHEET_LABEL: Record<ShopXSheet, string> = {
  products: 'Bolt',
  specs: 'Jellemzők',
  faq: 'GYIK',
  related: 'Kapcsolatok',
  documents: 'Dokumentumok',
  groups: 'Változatcsoportok',
  categories: 'Kategóriák',
  attributes: 'Tulajdonságok'
}

/**
 * Nem létező kategória / jellemző / érték: mit tegyünk vele. Hiányzó kulcs = kihagyjuk.
 * `use:<id>` = egy meglévőre párosítjuk (a jelöltek közül).
 */
export type ShopXDecision = 'suggestion' | 'create' | `use:${string}`
export type ShopXDecisions = Record<string, ShopXDecision>

export type ShopXIssueLevel = 'error' | 'warning' | 'info'

export type ShopXIssue = {
  level: ShopXIssueLevel
  /** Oszlop vagy lap neve, pl. „Leírás” vagy „Jellemzők 14. sor”. */
  where: string
  message: string
}

/**
 * goes_live: most kerül ki · stays_live: kint marad · goes_off: levesszük (kérésre)
 * forced_off: a változások miatt lekerül · blocked: kitennénk, de hiányos · off: nincs kint
 */
export type ShopXShopOutcome = 'goes_live' | 'stays_live' | 'goes_off' | 'forced_off' | 'blocked' | 'off'

export type ShopXRowRef = { sheet: ShopXSheet; rowNumber: number }

export type ShopXItem = {
  key: string
  sku: string
  name: string
  accessoryId: string | null
  rows: ShopXRowRef[]
  status: 'update' | 'unchanged' | 'error'
  changes: string[]
  shop: ShopXShopOutcome
  /** Mi hiányzik a boltba kerüléshez (blocked / forced_off). */
  shopReasons: string[]
  issues: ShopXIssue[]
}

export type ShopXPendingKind = 'category' | 'value' | 'attribute'

export type ShopXPending = {
  key: string
  kind: ShopXPendingKind
  raw: string
  attributeName: string | null
  suggestion: string | null
  /** Hasonló meglévők (legfeljebb 8) — „Ezt használom” választáshoz. */
  candidates: { id: string; label: string }[]
  /** Mit hoznánk létre, pl. „Konyha > Zsanérok (új: Zsanérok)”. */
  createLabel: string
  rowCount: number
  choice: ShopXDecision | null
  /** Korábbi importból megjegyzett párosítás (a választás már ki van töltve). */
  remembered: boolean
}

export type ShopXGroupCard = {
  code: string
  title: string | null
  axes: string[]
  members: { sku: string; name: string; live: boolean; main: boolean; values: Record<string, string> }[]
  issues: string[]
}

/** Katalógus-szintű változások (Kategóriák / Tulajdonságok / Változatcsoportok lap + döntések). */
export type ShopXCatalogChanges = {
  categoriesCreated: string[]
  categoriesUpdated: string[]
  attributesCreated: string[]
  attributesUpdated: string[]
  valuesCreated: number
  groupsChanged: string[]
}

export type ShopXStats = {
  items: number
  update: number
  unchanged: number
  error: number
  /** Frissül, de egy-egy mező kimarad. */
  partial: number
  goesLive: number
  goesOff: number
  blocked: number
  warnings: number
}

export type ShopXProblem = { sheet: ShopXSheet; rowNumber: number; messages: string[] }

export type ShopXItemFilter = 'all' | 'update' | 'live' | 'blocked' | 'error' | 'unchanged'

export type ShopXPreview = {
  /** Legfeljebb PREVIEW_ITEM_LIMIT tétel (hibásak elöl); a teljes lista a jelentésben. */
  items: ShopXItem[]
  itemCounts: Record<ShopXItemFilter, number>
  itemsTruncated: boolean
  pending: ShopXPending[]
  groups: ShopXGroupCard[]
  catalog: ShopXCatalogChanges
  stats: ShopXStats
  /** Fájl szintű megjegyzések (ismeretlen oszlop, régi sablon…). */
  notices: string[]
  problems: ShopXProblem[]
  /** Hány termék változik — a mentés lépéseinek alapja. */
  writeCount: number
  /** Létrehozandó / módosuló kategória, jellemző, érték, csoport. */
  catalogChangeCount: number
  /** Pillanatkép (visszavonás) fájl: minden halmaz pontosan a fájl szerinti. */
  snapshot: boolean
}

/** A feltöltött fájl helye: Storage útvonal (nagy fájl) vagy a kérésben küldött fájl. */
export type ShopXSource = { kind: 'storage'; path: string; name: string } | { kind: 'inline'; name: string }

export type ShopXStepResult = {
  runId: string
  /** Következő kötegtől folytatandó; null = kész. */
  next: number | null
  total: number
  done: number
  updated: number
  wentLive: number
  wentOff: number
  failed: number
  problems: ShopXProblem[]
  notices: string[]
}

export type ShopXApplyResult = {
  runId: string | null
  canUndo: boolean
  updated: number
  wentLive: number
  wentOff: number
  createdCategories: number
  createdAttributes: number
  createdValues: number
  failed: number
  problems: ShopXProblem[]
  notices: string[]
}

export type ShopXRunSummary = {
  id: string
  fileName: string
  kind: 'import' | 'restore'
  status: 'running' | 'done' | 'failed' | 'undone'
  createdAt: string
  updated: number
  canUndo: boolean
}

export function matchesShopItem(item: ShopXItem, f: ShopXItemFilter): boolean {
  switch (f) {
    case 'all':
      return true
    case 'update':
      return item.status === 'update'
    case 'live':
      return item.status === 'update' && item.shop === 'goes_live'
    case 'blocked':
      return item.shop === 'blocked' || item.shop === 'forced_off'
    case 'error':
      return item.status === 'error' || item.issues.some((i) => i.level === 'error')
    case 'unchanged':
      return item.status === 'unchanged'
  }
}

export const SHOP_X_ITEM_FILTERS: ShopXItemFilter[] = ['all', 'update', 'live', 'blocked', 'error', 'unchanged']
