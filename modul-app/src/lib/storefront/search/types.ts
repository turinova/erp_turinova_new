import type { StorefrontCard } from '@/lib/storefront/catalog'

/** GET /api/storefront/search válasz (kereső panel). */
export type StorefrontSuggestResponse = {
  items: StorefrontCard[]
  total: number
  relaxed: boolean
  corrected: string | null
  /** Felismert kategória (+ szűrők), pl. „Fogantyúk · 128 mm · fekete”. */
  intent: { label: string; href: string; filtered: boolean } | null
  queries: string[]
  categories: { id: string; name: string; href: string }[]
}
