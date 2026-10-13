/**
 * Square-szemléletű plan → bundelt add-on kulcsok.
 * Forrás: docs/33-packages-and-addons.md, docs/46-csomagok-funkcio-matrix.md
 */

export const PLAN_KEY = {
  BOLT: 'bolt',
  BOLT_PLUS: 'bolt_plus',
  MUHELY: 'muhely',
  PRO: 'pro'
} as const

export type PlanKey = (typeof PLAN_KEY)[keyof typeof PLAN_KEY]

/** Plan árak (nettó HUF) — migrációval egyező. */
export const PLAN_LIST_PRICE_HUF: Record<PlanKey, number> = {
  bolt: 39_990,
  bolt_plus: 59_900,
  muhely: 49_990,
  pro: 94_900
}

/**
 * Plan bekapcsolásakor automatikusan enable-elt add-onok
 * (0 Ft havi, ha a billing skip-if-in-plan / 0 listaár).
 */
export const PLAN_BUNDLED_ADDON_KEYS: Record<string, readonly string[]> = {
  bolt: [],
  bolt_plus: ['pda_pos', 'jelenlet', 'footcounter'],
  muhely: ['lapszabaszat', 'partner_orders', 'quote_ready_sms'],
  /** Webshop※ külön — amíg WEBSHOP_ENABLED=false, ne auto-enable. */
  pro: ['pda_pos', 'jelenlet', 'footcounter']
}

/**
 * Option B: Műhelyen (és ritkán Pro-n) megengedett à la carte add-onok,
 * amiket planváltáskor NEM kapcsolunk ki automatikusan.
 */
export const PLAN_A_LA_CARTE_ADDON_KEYS: Record<string, readonly string[]> = {
  bolt: [],
  bolt_plus: ['lapszabaszat', 'partner_orders', 'quote_ready_sms'],
  muhely: ['pda_pos', 'jelenlet', 'footcounter'],
  pro: ['lapszabaszat', 'partner_orders', 'quote_ready_sms']
}

/** Planváltáskor kezelt add-onok (auto on/off). Webshop nem ide tartozik. */
export const MANAGED_BUNDLE_ADDON_KEYS: readonly string[] = [
  'pda_pos',
  'jelenlet',
  'footcounter',
  'lapszabaszat',
  'partner_orders',
  'quote_ready_sms'
]

export function bundledAddonKeysForPlan(planKey: string | null | undefined): readonly string[] {
  if (!planKey) return []
  return PLAN_BUNDLED_ADDON_KEYS[planKey] ?? []
}

export function retainedAddonKeysForPlan(planKey: string | null | undefined): Set<string> {
  const keep = new Set<string>([
    ...bundledAddonKeysForPlan(planKey),
    ...(PLAN_A_LA_CARTE_ADDON_KEYS[planKey ?? ''] ?? [])
  ])
  // Webshop soha ne essen auto-disable alá (gate külön)
  keep.add('webshop')
  return keep
}

export function isPlanKey(key: string): key is PlanKey {
  return key === 'bolt' || key === 'bolt_plus' || key === 'muhely' || key === 'pro'
}

/** Rövid hint a platform UI-hoz. */
export function planBundleHint(planKey: string): string {
  switch (planKey) {
    case 'bolt':
      return 'POS + készlet + beszerzés + ÜR + számla'
    case 'bolt_plus':
      return 'Bolt + PDA + jelenlét + belépő (szoftver)'
    case 'muhely':
      return 'Bolt + lapszabászat (PDA à la carte)'
    case 'pro':
      return 'Bolt+ + prioritás · webshop※ külön'
    default:
      return ''
  }
}
