export type AppPageCategory =
  | 'Fő'
  | 'Műhely'
  | 'Értékesítés'
  | 'Webshop'
  | 'Beszerzés'
  | 'Jelenlét'
  | 'Törzsadatok'
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
export const PAGE_CATALOG_VERSION = 13

/** Single source: oldaljog kulcsok = nav path-ek. */
export const APP_PAGES: AppPageDef[] = [
  { key: '/home', label: 'Kezdőlap', category: 'Fő', always: true },
  {
    key: '/beallitasok/profil',
    label: 'Saját adatok',
    category: 'Beállítások',
    always: true
  },
  { key: '/kereso', label: 'Kereső', category: 'Fő' },
  { key: '/opti', label: 'Opti', category: 'Műhely' },
  { key: '/scanner', label: 'Scanner', category: 'Műhely' },
  { key: '/pos', label: 'POS', category: 'Értékesítés' },
  {
    key: '/pos/beallitasok',
    label: 'POS beállítások',
    category: 'Értékesítés'
  },
  { key: '/ugyfelek', label: 'Ügyfelek', category: 'Fő' },
  { key: '/belepok', label: 'Belépők', category: 'Fő' },
  { key: '/ertekesitesek', label: 'Értékesítések', category: 'Értékesítés' },
  {
    key: '/ertekesitesek/muszakok',
    label: 'Műszakok',
    category: 'Értékesítés'
  },
  { key: '/szamlak', label: 'Bizonylatok', category: 'Értékesítés' },
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
  { key: '/jelenlet', label: 'Jelenlét naptár', category: 'Jelenlét' },
  {
    key: '/jelenlet/naptar',
    label: 'Munkarend / ünnepek',
    category: 'Jelenlét'
  },
  { key: '/dolgozok', label: 'Dolgozók', category: 'Jelenlét' },
  {
    key: '/dolgozok/tipusok',
    label: 'Dolgozó típusok',
    category: 'Jelenlét'
  },
  { key: '/beszallitok', label: 'Beszállítók', category: 'Beszerzés' },
  {
    key: '/beszallitoi-rendelesek',
    label: 'Beszállítói rendelések',
    category: 'Beszerzés'
  },
  { key: '/beerkezesek', label: 'Beérkezések', category: 'Beszerzés' },
  { key: '/keszlet/atadasok', label: 'Áttárolások', category: 'Beszerzés' },
  { key: '/keszlet/mozgasok', label: 'Készletmozgások', category: 'Beszerzés' },
  { key: '/megrendelesek', label: 'Megrendelések', category: 'Műhely' },
  { key: '/ajanlatok', label: 'Lapszabászati ajánlatok', category: 'Műhely' },
  {
    key: '/torzsadatok/alapanyagok/tablas-anyagok',
    label: 'Táblás anyagok',
    category: 'Törzsadatok'
  },
  {
    key: '/torzsadatok/alapanyagok/szalas-anyagok',
    label: 'Szálas anyagok',
    category: 'Törzsadatok'
  },
  {
    key: '/torzsadatok/alapanyagok/elzarok',
    label: 'Élzárók',
    category: 'Törzsadatok'
  },
  {
    key: '/torzsadatok/alapanyagok/termekek',
    label: 'Termékek',
    category: 'Törzsadatok'
  },
  {
    key: '/torzsadatok/rendszer/adonem',
    label: 'Adónem',
    category: 'Törzsadatok'
  },
  {
    key: '/torzsadatok/rendszer/fizetesi-modok',
    label: 'Fizetési módok',
    category: 'Törzsadatok'
  },
  {
    key: '/torzsadatok/rendszer/egysegek',
    label: 'Egységek',
    category: 'Törzsadatok'
  },
  {
    key: '/torzsadatok/rendszer/dij-tipusok',
    label: 'Díj típusok',
    category: 'Törzsadatok'
  },
  {
    key: '/torzsadatok/rendszer/gyartok',
    label: 'Gyártók',
    category: 'Törzsadatok'
  },
  {
    key: '/torzsadatok/rendszer/raktarak',
    label: 'Raktárak',
    category: 'Törzsadatok'
  },
  {
    key: '/torzsadatok/rendszer/berendezes',
    label: 'Berendezés',
    category: 'Törzsadatok'
  },
  {
    key: '/torzsadatok/rendszer/gyartogepek',
    label: 'Gyártógépek',
    category: 'Törzsadatok'
  },
  {
    key: '/torzsadatok/rendszer/media',
    label: 'Média',
    category: 'Törzsadatok'
  },  {
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
      '/ertekesitesek',
      '/pos',
      '/pos/beallitasok',
      '/ertekesitesek/muszakok',
      '/szamlak',
      '/beallitasok/szamlazas',
      '/webshop',
      '/webshop/katalogus',
      '/webshop/kategoriak',
      '/webshop/tulajdonsagok',
      '/jelenlet',
      '/jelenlet/naptar',
      '/dolgozok',
      '/dolgozok/tipusok',
      '/beszallitok',
      '/beszallitoi-rendelesek',
      '/beerkezesek',
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
    if (
      pathname === page.key ||
      pathname.startsWith(`${page.key}/`)
    ) {
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
