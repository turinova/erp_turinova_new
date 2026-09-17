export const BESZERZES_ADDON_KEY = 'beszerzes' as const
export const BESZERZES_FEATURE = 'beszerzes' as const

/** Page keys that imply procurement is available (legacy Alap backfill). */
export const BESZERZES_PAGE_KEYS = [
  '/beszallitok',
  '/beszallitoi-rendelesek',
  '/beerkezesek',
  '/keszlet/atadasok',
  '/keszlet/mozgasok',
  '/torzsadatok/rendszer/raktarak'
] as const
