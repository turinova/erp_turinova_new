export const LAPSZABASZAT_ADDON_KEY = 'lapszabaszat' as const
export const LAPSZABASZAT_FEATURE = 'lapszabaszat' as const

/** Add-onok, amikhez kell a Lapszabászat. */
export const LAPSZABASZAT_DEPENDENT_ADDON_KEYS = [
  'partner_orders',
  'quote_ready_sms'
] as const

/** Oldalak, amiket az add-on megnyit (page_access + entitlements). */
export const LAPSZABASZAT_PAGE_KEYS = [
  '/opti',
  '/ajanlatok',
  '/megrendelesek',
  '/scanner',
  '/torzsadatok/alapanyagok/tablas-anyagok',
  '/torzsadatok/alapanyagok/szalas-anyagok',
  '/torzsadatok/alapanyagok/elzarok',
  '/torzsadatok/rendszer/gyartogepek',
  '/torzsadatok/rendszer/berendezes',
  '/beallitasok/opti'
] as const
