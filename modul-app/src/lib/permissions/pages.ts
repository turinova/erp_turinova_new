import { WEBSHOP_ENABLED } from '@/lib/webshop/enabled'

/**
 * Oldaljog UI csoportok — egyezzen a sidebar IA-val (`navigation.ts`).
 * Certainty-first: ugyanaz a chunk a menüben és a jogosultságoknál.
 */
export type AppPageCategory =
  | 'Pult'
  | 'Ügyfél'
  | 'Értékesítés'
  | 'Webshop'
  | 'Pénzügy'
  | 'Gyártás'
  | 'Beszerzés & készlet'
  | 'Csapat'
  | 'Törzs — alapanyagok'
  | 'Törzs — rendszer'
  | 'Beállítások'

export type AppPageDef = {
  key: string
  label: string
  category: AppPageCategory
  /** Mindig engedélyezett; nem kapcsolható ki. */
  always?: boolean
}

/**
 * Bump when új oldal kerül APP_PAGES-be (pl. migráció után).
 * Session snapshot mismatch → újratölt entitlements DB-ből.
 */
export const PAGE_CATALOG_VERSION = 20

/** Single source: oldaljog kulcsok = nav path-ek. */
export const APP_PAGES: AppPageDef[] = [
  { key: '/home', label: 'Kezdőlap', category: 'Pult', always: true },
  {
    key: '/beallitasok/profil',
    label: 'Saját adatok',
    category: 'Beállítások',
    always: true
  },
  { key: '/kereso', label: 'Kereső', category: 'Pult' },
  { key: '/opti', label: 'Opti', category: 'Pult' },
  { key: '/scanner', label: 'Scanner', category: 'Pult' },
  { key: '/pos', label: 'POS', category: 'Pult' },
  {
    key: '/pos/beallitasok',
    label: 'POS beállítások',
    category: 'Pult'
  },
  { key: '/belepok', label: 'Belépők', category: 'Pult' },
  { key: '/ugyfelek', label: 'Ügyfelek', category: 'Ügyfél' },
  {
    key: '/ugyfelrendelesek',
    label: 'Ügyfélrendelések',
    category: 'Ügyfél'
  },
  { key: '/ertekesitesek', label: 'Értékesítések', category: 'Értékesítés' },
  {
    key: '/ertekesitesek/muszakok',
    label: 'Műszakok',
    category: 'Értékesítés'
  },
  { key: '/webshop', label: 'Webshop áttekintés', category: 'Webshop' },
  {
    key: '/webshop/katalogus',
    label: 'Bolt katalógus',
    category: 'Webshop'
  },
  {
    key: '/webshop/kategoriak',
    label: 'Bolt kategóriák',
    category: 'Webshop'
  },
  {
    key: '/webshop/tulajdonsagok',
    label: 'Jellemzők',
    category: 'Webshop'
  },
  { key: '/penzugy', label: 'Pénzügy áttekintés', category: 'Pénzügy' },
  { key: '/szamlak', label: 'Bizonylatok', category: 'Pénzügy' },
  {
    key: '/penzugy/kintlevoseg',
    label: 'Kintlévőség',
    category: 'Pénzügy'
  },
  { key: '/penzugy/afa', label: 'ÁFA összesítő', category: 'Pénzügy' },
  { key: '/penzugy/exportok', label: 'Pénzügy exportok', category: 'Pénzügy' },
  { key: '/megrendelesek', label: 'Megrendelések', category: 'Gyártás' },
  { key: '/ajanlatok', label: 'Lapszabászati ajánlatok', category: 'Gyártás' },
  { key: '/beszallitok', label: 'Beszállítók', category: 'Beszerzés & készlet' },
  {
    key: '/beszallitoi-rendelesek',
    label: 'Beszállítói rendelések',
    category: 'Beszerzés & készlet'
  },
  { key: '/beerkezesek', label: 'Beérkezések', category: 'Beszerzés & készlet' },
  {
    key: '/keszlet/nyito',
    label: 'Nyitó készlet',
    category: 'Beszerzés & készlet'
  },
  {
    key: '/keszlet/atadasok',
    label: 'Áttárolások',
    category: 'Beszerzés & készlet'
  },
  {
    key: '/keszlet/mozgasok',
    label: 'Készletmozgások',
    category: 'Beszerzés & készlet'
  },
  { key: '/jelenlet', label: 'Jelenlét naptár', category: 'Csapat' },
  {
    key: '/jelenlet/naptar',
    label: 'Munkarend / ünnepek',
    category: 'Csapat'
  },
  { key: '/dolgozok', label: 'Dolgozók', category: 'Csapat' },
  {
    key: '/dolgozok/tipusok',
    label: 'Dolgozó típusok',
    category: 'Csapat'
  },
  {
    key: '/torzsadatok/alapanyagok/tablas-anyagok',
    label: 'Táblás anyagok',
    category: 'Törzs — alapanyagok'
  },
  {
    key: '/torzsadatok/alapanyagok/szalas-anyagok',
    label: 'Szálas anyagok',
    category: 'Törzs — alapanyagok'
  },
  {
    key: '/torzsadatok/alapanyagok/elzarok',
    label: 'Élzárók',
    category: 'Törzs — alapanyagok'
  },
  {
    key: '/torzsadatok/alapanyagok/termekek',
    label: 'Termékek',
    category: 'Törzs — alapanyagok'
  },
  {
    key: '/torzsadatok/rendszer/adonem',
    label: 'Adónem',
    category: 'Törzs — rendszer'
  },
  {
    key: '/torzsadatok/rendszer/fizetesi-modok',
    label: 'Fizetési módok',
    category: 'Törzs — rendszer'
  },
  {
    key: '/torzsadatok/rendszer/egysegek',
    label: 'Egységek',
    category: 'Törzs — rendszer'
  },
  {
    key: '/torzsadatok/rendszer/dij-tipusok',
    label: 'Díj típusok',
    category: 'Törzs — rendszer'
  },
  {
    key: '/torzsadatok/rendszer/gyartok',
    label: 'Gyártók',
    category: 'Törzs — rendszer'
  },
  {
    key: '/torzsadatok/rendszer/raktarak',
    label: 'Raktárak',
    category: 'Törzs — rendszer'
  },
  {
    key: '/torzsadatok/rendszer/berendezes',
    label: 'Berendezés',
    category: 'Törzs — rendszer'
  },
  {
    key: '/torzsadatok/rendszer/gyartogepek',
    label: 'Gyártógépek',
    category: 'Törzs — rendszer'
  },
  {
    key: '/torzsadatok/rendszer/media',
    label: 'Média',
    category: 'Törzs — rendszer'
  },
  {
    key: '/beallitasok/cegadatok',
    label: 'Cégadatok',
    category: 'Beállítások'
  },
  {
    key: '/beallitasok/szamlazas',
    label: 'Számlázás',
    category: 'Beállítások'
  },
  {
    key: '/beallitasok/elofizetes',
    label: 'Előfizetés',
    category: 'Beállítások'
  },
  {
    key: '/beallitasok/opti',
    label: 'Opti beállítások',
    category: 'Beállítások'
  },
  {
    key: '/beallitasok/atveteli-blokk',
    label: 'Átvételi blokk',
    category: 'Beállítások'
  },
  {
    key: '/beallitasok/partner',
    label: 'Online partner',
    category: 'Beállítások'
  },
  {
    key: '/beallitasok/sms',
    label: 'SMS sablon',
    category: 'Beállítások'
  },
  {
    key: '/beallitasok/felhasznalok',
    label: 'Felhasználók',
    category: 'Beállítások'
  }
]

export const ALL_PAGE_KEYS = APP_PAGES.map((p) => p.key)

export const ALWAYS_ALLOWED_PAGE_KEYS = APP_PAGES.filter((p) => p.always).map(
  (p) => p.key
)

/** Display order for page-access UI (sidebar IA). */
export const APP_PAGE_CATEGORIES: AppPageCategory[] = [
  'Pult',
  'Ügyfél',
  'Értékesítés',
  'Webshop',
  'Pénzügy',
  'Gyártás',
  'Beszerzés & készlet',
  'Csapat',
  'Törzs — alapanyagok',
  'Törzs — rendszer',
  'Beállítások'
]

/** Útvonalak, amikhez nem kell page_access (auth / hiba). */
export const PUBLIC_APP_PATHS = new Set([
  '/nincs-hozzaferes',
  '/no-access',
  '/login'
])

export type PageAccessTemplateId = 'full' | 'office' | 'workshop'

export const PAGE_ACCESS_TEMPLATES: Record<
  PageAccessTemplateId,
  { label: string; keys: string[] }
> = {
  full: {
    label: 'Teljes',
    keys: ALL_PAGE_KEYS
  },
  office: {
    label: 'Irodai',
    keys: [
      '/home',
      '/kereso',
      '/opti',
      '/ugyfelek',
      '/ugyfelrendelesek',
      '/ertekesitesek',
      '/pos',
      '/pos/beallitasok',
      '/ertekesitesek/muszakok',
      '/szamlak',
      '/penzugy',
      '/penzugy/kintlevoseg',
      '/penzugy/afa',
      '/penzugy/exportok',
      '/beallitasok/szamlazas',
      ...(WEBSHOP_ENABLED
        ? [
            '/webshop',
            '/webshop/katalogus',
            '/webshop/kategoriak',
            '/webshop/tulajdonsagok'
          ]
        : []),
      '/jelenlet',
      '/jelenlet/naptar',
      '/dolgozok',
      '/dolgozok/tipusok',
      '/beszallitok',
      '/beszallitoi-rendelesek',
      '/beerkezesek',
      '/keszlet/nyito',
      '/keszlet/atadasok',
      '/keszlet/mozgasok',
      '/ajanlatok',
      '/megrendelesek',
      '/beallitasok/cegadatok',
      '/beallitasok/partner'
    ]
  },
  workshop: {
    label: 'Műhely',
    keys: ['/home', '/kereso', '/megrendelesek', '/scanner', '/opti']
  }
}

/** Pathname → leghosszabb egyező page_key, vagy null. */
export function resolvePageKey(pathname: string): string | null {
  if (PUBLIC_APP_PATHS.has(pathname)) return null
  if (pathname === '/' || pathname === '') return '/home'

  let best: string | null = null
  for (const page of APP_PAGES) {
    if (pathname === page.key || pathname.startsWith(`${page.key}/`)) {
      if (!best || page.key.length > best.length) {
        best = page.key
      }
    }
  }
  return best
}

export function pathIsAllowed(
  pathname: string,
  allowedKeys: string[]
): boolean {
  if (PUBLIC_APP_PATHS.has(pathname)) return true
  const key = resolvePageKey(pathname)
  if (!key) return false
  if (ALWAYS_ALLOWED_PAGE_KEYS.includes(key)) return true
  return allowedKeys.includes(key)
}

export function mergeAlwaysAllowed(keys: string[]): string[] {
  const set = new Set([...ALWAYS_ALLOWED_PAGE_KEYS, ...keys])
  return ALL_PAGE_KEYS.filter((k) => set.has(k))
}
