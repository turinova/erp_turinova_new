/** Bolt munkafüzet (Bolt katalógus export / import) — oszlopszerződés. */

export const SHOP_EXCEL_KIND = 'turinova-bolt'
export const SHOP_EXCEL_VERSION = 2

export const SHOP_SHEET = {
  products: 'Bolt',
  specs: 'Jellemzők',
  faq: 'GYIK',
  related: 'Kapcsolatok',
  documents: 'Dokumentumok',
  groups: 'Változatcsoportok',
  categories: 'Kategóriák',
  attributes: 'Tulajdonságok',
  guide: 'Útmutató',
  lists: 'Listák',
  meta: 'Adatok'
} as const

/** A meta lap „Mód” értéke a teljes pillanatképnél (mentés visszavonáshoz): minden halmaz pontosan ez. */
export const SHOP_SNAPSHOT_MODE = 'pillanatkep'

export const SHOP_IMPORT_MAX_ROWS = 10000
export const SHOP_IMPORT_MAX_SPEC_ROWS = 150000
export const SHOP_IMPORT_MAX_FAQ_ROWS = 30000
export const SHOP_IMPORT_MAX_RELATED_ROWS = 60000
export const SHOP_IMPORT_MAX_DOCUMENT_ROWS = 60000
export const SHOP_IMPORT_MAX_GROUP_ROWS = 5000
export const SHOP_IMPORT_MAX_CATEGORY_ROWS = 5000
export const SHOP_IMPORT_MAX_ATTRIBUTE_ROWS = 1000
/** Feltöltött fájl felső mérete (a Storage-on át; a kérésbe közvetlenül 4 MB fér). */
export const SHOP_IMPORT_MAX_BYTES = 40 * 1024 * 1024
export const SHOP_IMPORT_DIRECT_MAX_BYTES = 4 * 1024 * 1024
export const SHOP_FAQ_MAX_PER_PRODUCT = 20
export const SHOP_DOCUMENTS_MAX_PER_PRODUCT = 20

/** Választható lapok letöltéskor (a Bolt lap mindig benne van). */
export const SHOP_OPTIONAL_SHEETS = ['specs', 'faq', 'related', 'documents', 'groups', 'categories', 'attributes'] as const
export type ShopOptionalSheet = (typeof SHOP_OPTIONAL_SHEETS)[number]

export const SHOP_OPTIONAL_SHEET_META: Record<ShopOptionalSheet, { label: string; hint: string }> = {
  specs: { label: 'Jellemzők', hint: 'Méret, szín, anyag… soronként egy adat.' },
  faq: { label: 'GYIK', hint: 'Kérdés–válasz párok termékenként.' },
  related: { label: 'Kapcsolatok', hint: 'Kell hozzá, tartozék, alternatíva, nagyobb kiszerelés.' },
  documents: { label: 'Dokumentumok', hint: 'PDF-ek a Médiából: útmutató, adatlap, nyilatkozat.' },
  groups: { label: 'Változatcsoportok', hint: 'Csoport neve, fő terméke, választási szempontjai.' },
  categories: { label: 'Kategóriák', hint: 'Kategóriafa, Google kategória, jellemző-sablon.' },
  attributes: { label: 'Tulajdonságok', hint: 'Jellemzők típusa, mértékegysége, értékei.' }
}

/** Ezzel a jellel lehet egy mezőt kiüríteni (az üres cella nem változtat). */
export const CLEAR_MARK = '-'

/** A hibás sorok fájl első oszlopa — visszatöltéskor figyelmen kívül marad. */
export const PROBLEM_COLUMN_LABEL = 'Mi a baj?'

export type ShopColumnKind =
  | 'key'
  | 'info'
  | 'availability'
  | 'text'
  | 'list'
  | 'bool'
  | 'decimal'
  | 'int'
  | 'netUnit'
  | 'country'
  | 'video'
  | 'slug'
  | 'category'
  | 'group'
  | 'tiers'
  | 'money'
  | 'media'

export type ShopColumnId =
  | 'sku'
  | 'name'
  | 'price'
  | 'active'
  | 'available'
  | 'category'
  | 'description'
  | 'shortDescription'
  | 'useCases'
  | 'compatibility'
  | 'boxContents'
  | 'brand'
  | 'mpn'
  | 'gtin'
  | 'group'
  | 'netQuantity'
  | 'netUnit'
  | 'multipack'
  | 'isBundle'
  | 'priceTiers'
  | 'compareAt'
  | 'productLength'
  | 'productWidth'
  | 'productHeight'
  | 'productWeight'
  | 'shippingLength'
  | 'shippingWidth'
  | 'shippingHeight'
  | 'shippingWeight'
  | 'country'
  | 'ingredients'
  | 'usage'
  | 'safety'
  | 'video'
  | 'dimensionImage'
  | 'title'
  | 'slug'
  | 'googleCategory'
  | 'searchAliases'
  | 'tags'

export type ShopColumn = {
  id: ShopColumnId
  label: string
  kind: ShopColumnKind
  /** Egyszerű letöltésben is benne van. */
  simple: boolean
  /** Szöveg: max karakter; lista: max elemhossz. */
  max?: number
  width: number
  note: string
}

export const SHOP_COLUMNS: ShopColumn[] = [
  { id: 'sku', label: 'SKU', kind: 'key', simple: true, width: 16, note: 'Ez azonosítja a terméket. Ne írd át.' },
  { id: 'name', label: 'Név', kind: 'info', simple: true, width: 32, note: 'Csak tájékoztató. A Termékek oldalon módosítható.' },
  { id: 'price', label: 'Bruttó ár (Ft)', kind: 'info', simple: true, width: 13, note: 'Csak tájékoztató. A Termékek oldalon módosítható.' },
  { id: 'active', label: 'Aktív', kind: 'info', simple: true, width: 8, note: 'Csak tájékoztató. A Termékek oldalon módosítható.' },
  {
    id: 'available',
    label: 'Elérhető a boltban',
    kind: 'availability',
    simple: true,
    width: 12,
    note: 'igen = kitesszük a boltba (ha minden kötelező megvan), nem = levesszük, üres = nem változik.'
  },
  {
    id: 'category',
    label: 'Kategória',
    kind: 'category',
    simple: true,
    width: 30,
    note: 'Válassz a listából, vagy írd be az útvonalat: Konyha > Zsanérok.'
  },
  {
    id: 'description',
    label: 'Leírás',
    kind: 'text',
    max: 5000,
    simple: true,
    width: 50,
    note: 'Legalább 200 karakter kell a boltba kerüléshez. Az eleje (legalább 80 karakter) lesz a rövid szöveg.'
  },
  {
    id: 'shortDescription',
    label: 'Rövid leírás',
    kind: 'text',
    max: 800,
    simple: false,
    width: 36,
    note: 'Ha üresen hagyod, a leírás elejéből készül.'
  },
  { id: 'useCases', label: 'Mire jó', kind: 'list', max: 120, simple: true, width: 30, note: 'Több elem: | jellel vagy új sorral (Alt+Enter) elválasztva.' },
  { id: 'compatibility', label: 'Mihez illik', kind: 'list', max: 120, simple: false, width: 30, note: 'Több elem: | jellel vagy új sorral elválasztva.' },
  { id: 'boxContents', label: 'Doboz tartalma', kind: 'list', max: 120, simple: false, width: 30, note: 'Több elem: | jellel vagy új sorral elválasztva. Pl. 2 db zsanér | 8 db csavar' },
  { id: 'brand', label: 'Márka', kind: 'text', max: 120, simple: true, width: 16, note: 'Ha üres, a gyártó neve lesz a márka.' },
  { id: 'mpn', label: 'Gyártói cikkszám', kind: 'text', max: 64, simple: false, width: 16, note: 'A gyártó saját cikkszáma (MPN).' },
  { id: 'gtin', label: 'GTIN', kind: 'text', max: 32, simple: false, width: 16, note: 'Csak ha eltér a termék vonalkódjától.' },
  {
    id: 'group',
    label: 'Változatcsoport',
    kind: 'group',
    max: 64,
    simple: true,
    width: 16,
    note: 'Ugyanaz a kód = egy termékoldalon választható változatok (pl. EA60-LAB). Kiszedés: -'
  },
  { id: 'netQuantity', label: 'Nettó tartalom', kind: 'decimal', simple: false, width: 12, note: 'Szám, pl. 500. A mértékegység a következő oszlopban.' },
  { id: 'netUnit', label: 'Nettó tartalom egysége', kind: 'netUnit', simple: false, width: 12, note: 'g, kg, ml, l, db, m vagy m2' },
  { id: 'multipack', label: 'Darab a csomagban', kind: 'int', simple: false, width: 12, note: 'Ha több darab van egy csomagban (2–10 000).' },
  { id: 'isBundle', label: 'Csomagajánlat', kind: 'bool', simple: false, width: 12, note: 'igen, ha több különböző termék van egy csomagban.' },
  {
    id: 'priceTiers',
    label: 'Mennyiségi árak (bruttó)',
    kind: 'tiers',
    simple: false,
    width: 26,
    note: 'Pl. 10 db: 1800; 50 db: 1650 — bruttó egységár, legalább 2 db-tól.'
  },
  {
    id: 'compareAt',
    label: 'Listaár (bruttó Ft)',
    kind: 'money',
    simple: false,
    width: 13,
    note: 'Nem jelenik meg áthúzva. Csak akkor van értelme, ha nagyobb az eladási árnál.'
  },
  { id: 'productLength', label: 'Termék hossza (cm)', kind: 'decimal', simple: false, width: 12, note: 'Szám, cm-ben.' },
  { id: 'productWidth', label: 'Termék szélessége (cm)', kind: 'decimal', simple: false, width: 12, note: 'Szám, cm-ben.' },
  { id: 'productHeight', label: 'Termék magassága (cm)', kind: 'decimal', simple: false, width: 12, note: 'Szám, cm-ben.' },
  { id: 'productWeight', label: 'Termék súlya (kg)', kind: 'decimal', simple: false, width: 12, note: 'Szám, kg-ban (pl. 0,35).' },
  { id: 'shippingLength', label: 'Csomag hossza (cm)', kind: 'decimal', simple: false, width: 12, note: 'Szám, cm-ben.' },
  { id: 'shippingWidth', label: 'Csomag szélessége (cm)', kind: 'decimal', simple: false, width: 12, note: 'Szám, cm-ben.' },
  { id: 'shippingHeight', label: 'Csomag magassága (cm)', kind: 'decimal', simple: false, width: 12, note: 'Szám, cm-ben.' },
  { id: 'shippingWeight', label: 'Csomag súlya (kg)', kind: 'decimal', simple: true, width: 12, note: 'Szám, kg-ban. Ebből számoljuk a szállítást.' },
  { id: 'country', label: 'Származási ország', kind: 'country', simple: false, width: 16, note: 'Pl. Magyarország vagy HU.' },
  { id: 'ingredients', label: 'Összetevők', kind: 'text', max: 4000, simple: false, width: 30, note: 'Anyagok, összetevők.' },
  { id: 'usage', label: 'Használat', kind: 'text', max: 4000, simple: false, width: 30, note: 'Hogyan kell használni.' },
  { id: 'safety', label: 'Figyelmeztetés', kind: 'text', max: 2000, simple: false, width: 30, note: 'Biztonsági tudnivalók.' },
  { id: 'video', label: 'Videó (YouTube link)', kind: 'video', simple: false, width: 30, note: 'Csak YouTube link.' },
  { id: 'dimensionImage', label: 'Méretrajz (fájlnév)', kind: 'media', simple: false, width: 22, note: 'A Média könyvtárban lévő kép fájlneve.' },
  { id: 'title', label: 'Bolt cím', kind: 'text', max: 150, simple: false, width: 30, note: 'Ha üres, a termék neve lesz a cím.' },
  { id: 'slug', label: 'Webcím', kind: 'slug', simple: false, width: 26, note: 'Kisbetű, szám, kötőjel. Kint lévő terméknél a régi link megszűnik.' },
  { id: 'googleCategory', label: 'Google kategória', kind: 'text', max: 240, simple: false, width: 24, note: 'Google termékkategória (szám vagy útvonal).' },
  { id: 'searchAliases', label: 'Keresőszavak', kind: 'list', max: 120, simple: false, width: 24, note: 'Amire még keresnek (| jellel elválasztva).' },
  { id: 'tags', label: 'Címkék', kind: 'list', max: 120, simple: false, width: 20, note: '| jellel elválasztva.' }
]

export const SHOP_COLUMN_BY_ID = new Map(SHOP_COLUMNS.map((c) => [c.id, c]))

export function shopColumnLabel(id: ShopColumnId): string {
  return SHOP_COLUMN_BY_ID.get(id)?.label ?? id
}

export type SpecColumnId = 'sku' | 'name' | 'attribute' | 'value' | 'unit'
export const SPEC_COLUMNS: { id: SpecColumnId; label: string; info: boolean; width: number; note: string }[] = [
  { id: 'sku', label: 'SKU', info: false, width: 16, note: 'A termék SKU-ja.' },
  { id: 'name', label: 'Név', info: true, width: 32, note: 'Csak tájékoztató.' },
  { id: 'attribute', label: 'Jellemző', info: false, width: 24, note: 'Válassz a listából.' },
  { id: 'value', label: 'Érték', info: false, width: 24, note: 'Lista: a lehetséges értékek egyike (több: |). Szám: pl. 35. Tartomány: 10-20. Igen/nem. Törlés: -' },
  { id: 'unit', label: 'Mértékegység', info: true, width: 12, note: 'Csak tájékoztató: ebben kell a szám.' }
]

export type FaqColumnId = 'sku' | 'name' | 'question' | 'answer'
export const FAQ_COLUMNS: { id: FaqColumnId; label: string; info: boolean; width: number; note: string }[] = [
  { id: 'sku', label: 'SKU', info: false, width: 16, note: 'A termék SKU-ja.' },
  { id: 'name', label: 'Név', info: true, width: 32, note: 'Csak tájékoztató.' },
  { id: 'question', label: 'Kérdés', info: false, width: 40, note: 'Az összes GYIK törlése: - ebben a cellában.' },
  { id: 'answer', label: 'Válasz', info: false, width: 60, note: 'A kérdésre adott válasz.' }
]

type SideColumn<C extends string> = { id: C; label: string; info: boolean; width: number; note: string }

export type RelatedColumnId = 'sku' | 'name' | 'kind' | 'relatedSku' | 'relatedName' | 'order'
export const RELATED_COLUMNS: SideColumn<RelatedColumnId>[] = [
  { id: 'sku', label: 'SKU', info: false, width: 16, note: 'Melyik terméknél jelenjen meg.' },
  { id: 'name', label: 'Név', info: true, width: 30, note: 'Csak tájékoztató.' },
  { id: 'kind', label: 'Típus', info: false, width: 18, note: 'Kell hozzá, Tartozék, Alternatíva vagy Nagyobb kiszerelés.' },
  {
    id: 'relatedSku',
    label: 'Kapcsolt SKU',
    info: false,
    width: 16,
    note: 'A másik termék SKU-ja. Egy típus összes kapcsolatának törlése: - ebben a cellában.'
  },
  { id: 'relatedName', label: 'Kapcsolt termék', info: true, width: 30, note: 'Csak tájékoztató.' },
  { id: 'order', label: 'Sorrend', info: false, width: 9, note: 'Kisebb szám előrébb. Üresen a sorok sorrendje számít.' }
]

export type DocumentColumnId = 'sku' | 'name' | 'file' | 'kind' | 'title' | 'language'
export const DOCUMENT_COLUMNS: SideColumn<DocumentColumnId>[] = [
  { id: 'sku', label: 'SKU', info: false, width: 16, note: 'A termék SKU-ja. Ugyanaz a PDF több termékhez: több sor.' },
  { id: 'name', label: 'Név', info: true, width: 30, note: 'Csak tájékoztató.' },
  {
    id: 'file',
    label: 'Fájlnév',
    info: false,
    width: 30,
    note: 'A Média oldalra feltöltött PDF fájlneve. A termék összes dokumentumának törlése: - ebben a cellában.'
  },
  {
    id: 'kind',
    label: 'Típus',
    info: false,
    width: 22,
    note: 'Használati útmutató, Biztonsági adatlap, Megfelelőségi nyilatkozat, Műszaki adatlap, Garancia, Tanúsítvány vagy Egyéb.'
  },
  { id: 'title', label: 'Cím', info: false, width: 28, note: 'Ha üres, a típus neve lesz a cím.' },
  { id: 'language', label: 'Nyelv', info: false, width: 8, note: 'Kétbetűs kód, pl. hu, en, de. Üresen: hu.' }
]

export type GroupColumnId = 'code' | 'title' | 'main' | 'axes' | 'members'
export const GROUP_COLUMNS: SideColumn<GroupColumnId>[] = [
  { id: 'code', label: 'Csoport kód', info: false, width: 18, note: 'Ugyanaz, mint a Bolt lap Változatcsoport oszlopa.' },
  { id: 'title', label: 'Csoport neve', info: false, width: 30, note: 'Belső név, pl. Riex EA60 láb. Törlés: -' },
  {
    id: 'main',
    label: 'Fő termék SKU',
    info: false,
    width: 16,
    note: 'Ez látszik a kategória oldalon a csoport képviselőjeként (ha kint van és raktáron). Törlés: -'
  },
  {
    id: 'axes',
    label: 'Választási szempontok',
    info: false,
    width: 30,
    note: 'Jellemzők | jellel, sorrendben (legfeljebb 3), pl. Magasság | Szín. Kiszerelés is írható. Üres vagy -: automatikus.'
  },
  { id: 'members', label: 'Tagok', info: true, width: 40, note: 'Csak tájékoztató.' }
]

export type CategoryColumnId = 'path' | 'active' | 'google' | 'measureImage' | 'keyAttrs' | 'specAttrs' | 'count'
export const CATEGORY_COLUMNS: SideColumn<CategoryColumnId>[] = [
  {
    id: 'path',
    label: 'Útvonal',
    info: false,
    width: 36,
    note: 'Pl. Konyha > Zsanérok. Ami nincs még meg, azt létrehozzuk (a hiányzó szinteket is).'
  },
  { id: 'active', label: 'Látható', info: false, width: 9, note: 'igen / nem. Üresen: nem változik (új kategória: igen).' },
  { id: 'google', label: 'Google kategória', info: false, width: 22, note: 'Google termékkategória száma. Törlés: -' },
  { id: 'measureImage', label: 'Mérési ábra (fájlnév)', info: false, width: 22, note: 'Kép a Médiából. Törlés: -' },
  {
    id: 'keyAttrs',
    label: 'Fő jellemzők',
    info: false,
    width: 30,
    note: 'Legfeljebb 4 jellemző | jellel — a „Passzol-e?” kártyán látszanak. Törlés: -'
  },
  { id: 'specAttrs', label: 'További jellemzők', info: false, width: 30, note: 'Ajánlott jellemzők | jellel. Törlés: -' },
  { id: 'count', label: 'Termékek', info: true, width: 10, note: 'Csak tájékoztató.' }
]

export type AttributeColumnId = 'name' | 'type' | 'unit' | 'multiple' | 'variantAxis' | 'active' | 'values'
export const ATTRIBUTE_COLUMNS: SideColumn<AttributeColumnId>[] = [
  { id: 'name', label: 'Jellemző', info: false, width: 24, note: 'A jellemző neve. Ami nincs még meg, azt létrehozzuk.' },
  {
    id: 'type',
    label: 'Típus',
    info: false,
    width: 16,
    note: 'Lista, Szám, Tartomány vagy Igen/nem. Meglévőnél csak akkor váltható, ha még egy termék sem használja.'
  },
  { id: 'unit', label: 'Mértékegység', info: false, width: 12, note: 'Számnál, pl. mm, kg. Törlés: -' },
  { id: 'multiple', label: 'Több érték', info: false, width: 10, note: 'Listánál: választható-e több érték egyszerre (igen/nem).' },
  { id: 'variantAxis', label: 'Változat szempont', info: false, width: 12, note: 'igen, ha ebben szoktak eltérni a változatok.' },
  { id: 'active', label: 'Látható', info: false, width: 9, note: 'igen / nem.' },
  {
    id: 'values',
    label: 'Értékek',
    info: false,
    width: 50,
    note: 'Listánál a lehetséges értékek | jellel. A hiányzókat felvesszük, a meglévőket nem töröljük.'
  }
]

export const RELATED_KIND_ALIASES: Record<string, 'required' | 'accessory' | 'alternative' | 'larger_pack'> = {
  'kell hozza': 'required',
  kell: 'required',
  szukseges: 'required',
  required: 'required',
  tartozek: 'accessory',
  kiegeszito: 'accessory',
  accessory: 'accessory',
  alternativa: 'alternative',
  helyette: 'alternative',
  alternative: 'alternative',
  'nagyobb kiszereles': 'larger_pack',
  'nagyobb csomag': 'larger_pack',
  larger_pack: 'larger_pack'
}

export const DOCUMENT_KIND_LABEL = {
  manual: 'Használati útmutató',
  safety_data_sheet: 'Biztonsági adatlap',
  declaration_of_conformity: 'Megfelelőségi nyilatkozat',
  datasheet: 'Műszaki adatlap',
  warranty: 'Garancia',
  certificate: 'Tanúsítvány',
  other: 'Egyéb'
} as const
export type DocumentKind = keyof typeof DOCUMENT_KIND_LABEL

export const DOCUMENT_KIND_ALIASES: Record<string, DocumentKind> = {
  'hasznalati utmutato': 'manual',
  utmutato: 'manual',
  kezikonyv: 'manual',
  manual: 'manual',
  'biztonsagi adatlap': 'safety_data_sheet',
  sds: 'safety_data_sheet',
  'megfelelosegi nyilatkozat': 'declaration_of_conformity',
  nyilatkozat: 'declaration_of_conformity',
  doc: 'declaration_of_conformity',
  'muszaki adatlap': 'datasheet',
  adatlap: 'datasheet',
  rajz: 'datasheet',
  meretrajz: 'datasheet',
  datasheet: 'datasheet',
  garancia: 'warranty',
  jotallas: 'warranty',
  tanusitvany: 'certificate',
  certificate: 'certificate',
  egyeb: 'other',
  other: 'other'
}

export const ATTRIBUTE_TYPE_ALIASES: Record<string, 'list' | 'number' | 'range' | 'boolean'> = {
  lista: 'list',
  list: 'list',
  szam: 'number',
  number: 'number',
  tartomany: 'range',
  range: 'range',
  'igen/nem': 'boolean',
  'igen / nem': 'boolean',
  igennem: 'boolean',
  boolean: 'boolean'
}

/** A „# ” kezdetű sor címsor (félkövér, a jel nélkül). */
export const SHOP_GUIDE_LINES = [
  '# Bolt adatok — import / export',
  '',
  '# Mire jó ez a fájl?',
  'A boltban megjelenő adatokat (kategória, leírás, jellemzők, kapcsolatok, dokumentumok…) tudod vele egyszerre sok ezer terméknél kitölteni.',
  'A név, az ár, a kép és a raktár a Termékek oldal Excel importjával módosítható — itt ezek szürkék, csak tájékoztatók.',
  'Új terméket ez a fájl nem hoz létre: előbb a Termékek oldalon töltsd fel őket, utána ezt.',
  '',
  '# Lépések',
  '1. Töltsd le a fájlt a Bolt katalógus oldalon (a mostani szűrés termékeivel), és válaszd ki, mely lapok kellenek.',
  '2. Töltsd ki. Az oszlopfejlécre állva látod a magyarázatot. Lapot és oszlopot nyugodtan törölhetsz.',
  '3. Töltsd fel. Mentés előtt megmutatjuk, mi fog változni, és megkérdezzük, ami még nem létezik.',
  '4. Mentés után a „Visszavonás” gombbal a mentés előtti állapot visszaállítható.',
  '5. Ha maradt hibás sor, letöltheted őket külön fájlban a hiba okával — javítsd és töltsd fel újra.',
  '',
  '# Fontos szabályok',
  '• A terméket az SKU azonosítja.',
  '• Üres cella = nem változik semmi. Törölni egy - (kötőjel) beírásával lehet.',
  '• Ami nincs a fájlban (lap, oszlop, termék), az nem változik.',
  '• Több elem egy cellában: | jellel vagy új sorral (Alt+Enter) elválasztva.',
  '• Igen/nem: igen, nem, i, n, x (= igen).',
  '• Elérhető a boltban: igen = kitesszük (ha minden kötelező megvan), nem = levesszük, üres = nem változik.',
  '• A boltba kerüléshez kell: kép, ár, aktív termék, kategória és legalább 200 karakteres leírás.',
  '• Kategória: az útvonal a > jellel, pl. Konyha > Zsanérok. Ha a név egyedi, elég csak a név.',
  '• Nem létező kategóriát, jellemzőt vagy értéket a Bolt és a Jellemzők lapról nem hozunk létre magától: megkérdezzük.',
  '  A választásod megjegyezzük: ugyanarra a névre legközelebb már nem kérdezünk.',
  '• Mennyiségi árak bruttóban: 10 db: 1800; 50 db: 1650',
  '• Ha az Excel egy értéket dátummá alakít (pl. 1/2), állítsd a cellát Szöveg formátumúra.',
  '',
  '# Jellemzők lap',
  '• Soronként egy adat: SKU, Jellemző, Érték. Ha egy terméknél egy jellemző szerepel, az értéke erre cserélődik.',
  '• Szám mértékegységgel is jó (35 mm), ha a mértékegység egyezik. Tartomány: 10-20.',
  '',
  '# GYIK, Kapcsolatok, Dokumentumok lap',
  '• Ha egy SKU szerepel a lapon, annak a halmaza pontosan az lesz, ami a lapon van (a Kapcsolatoknál típusonként).',
  '• Ha egy SKU nem szerepel a lapon, nem változik.',
  '• Kapcsolatok: az Alternatíva kölcsönös — a másik terméknél is megjelenik. Két termék között egy kapcsolat lehet.',
  '• Dokumentumok: a PDF-et előbb töltsd fel a Média oldalra, itt a fájlnevét add meg.',
  '',
  '# Változatok',
  '• Ugyanaz a Változatcsoport kód (Bolt lap) köti össze őket. Amiben eltérnek (pl. Hossz), azt a Jellemzők lapon add meg.',
  '• A Változatcsoportok lapon megadhatod a csoport nevét, a fő terméket és a választási szempontok sorrendjét.',
  '',
  '# Kategóriák és Tulajdonságok lap',
  '• Ezeken a lapokon a hiányzó kategóriát / jellemzőt / értéket létrehozzuk — ez a lap célja. Törölni itt nem lehet.',
  '• Sorrend nem számít: előbb a tulajdonságok, utána a kategóriák, végül a termékek mentődnek.',
  '',
  `Egy fájlban legfeljebb ${SHOP_IMPORT_MAX_ROWS.toLocaleString('hu-HU')} termék lehet.`
]
