/** Shared column contract for accessories (termékek) Excel template / export / import. */

export const ACCESSORY_EXCEL_SHEET_NAME = 'Termekek'
export const ACCESSORY_EXCEL_GUIDE_NAME = 'Utmutato'
export const ACCESSORY_EXCEL_LISTS_NAME = 'Listak'
export const ACCESSORY_IMPORT_MAX_ROWS = 10000
/** A Vercel 4,5 MB-os kéréskorlátja alatt, a mellé küldött adatoknak is marad hely. */
export const ACCESSORY_IMPORT_MAX_BYTES = 4 * 1024 * 1024
export const ACCESSORY_CLEAR_MARK = '-'
export const ACCESSORY_PROBLEM_COLUMN = 'Mi a baj?'

export const ACCESSORY_EXCEL_HEADERS = [
  'Gyarto',
  'Nev',
  'SKU',
  'Vonalkod',
  'Belso_vonalkod',
  'Brutto_Ft',
  'Beszerzes_netto_Ft',
  'Arres_szorzo',
  'Adonem',
  'Egyseg',
  'Aktiv',
  'Kep_fajlnev',
  'Galeria',
  'Azonosito'
] as const

export type AccessoryExcelHeader = (typeof ACCESSORY_EXCEL_HEADERS)[number]

/** Szövegként tárolt oszlopok: az Excel ne vágja le a vezető nullát. */
export const ACCESSORY_TEXT_HEADERS: ReadonlySet<AccessoryExcelHeader> = new Set([
  'SKU',
  'Vonalkod',
  'Belso_vonalkod',
  'Azonosito'
])

/** `-` jellel törölhető mezők (a többi kötelező, nem lehet üres). */
export const ACCESSORY_CLEARABLE_HEADERS: ReadonlySet<AccessoryExcelHeader> = new Set([
  'Vonalkod',
  'Belso_vonalkod',
  'Beszerzes_netto_Ft',
  'Arres_szorzo',
  'Kep_fajlnev',
  'Galeria'
])

export const ACCESSORY_HEADER_LABEL: Record<AccessoryExcelHeader, string> = {
  Gyarto: 'Gyártó',
  Nev: 'Név',
  SKU: 'SKU',
  Vonalkod: 'Vonalkód',
  Belso_vonalkod: 'Belső vonalkód',
  Brutto_Ft: 'Bruttó ár',
  Beszerzes_netto_Ft: 'Beszerzési nettó',
  Arres_szorzo: 'Árrés szorzó',
  Adonem: 'Adónem',
  Egyseg: 'Egység',
  Aktiv: 'Aktív',
  Kep_fajlnev: 'Kép',
  Galeria: 'Galéria',
  Azonosito: 'Azonosító'
}

export const ACCESSORY_HEADER_NOTE: Record<AccessoryExcelHeader, string> = {
  Gyarto: 'A gyártó neve, ahogy a Gyártók listában van. Ha még nincs ilyen, feltöltéskor megkérdezzük, létrehozzuk-e.',
  Nev: 'A termék neve (legfeljebb 200 karakter).',
  SKU: 'A termék saját kódja. Ez alapján ismerjük fel: ha már van ilyen, frissül, ha nincs, új termék lesz.',
  Vonalkod: 'Gyártói vonalkód (EAN). Szövegként add meg, hogy a 0-val kezdődő kód megmaradjon. Törlés: -',
  Belso_vonalkod: 'Saját vonalkód. Törlés: -',
  Brutto_Ft: 'Eladási bruttó ár forintban. Ha üres, a beszerzés × árrés szorzóból számoljuk.',
  Beszerzes_netto_Ft: 'Beszerzési nettó ár. Az árrés szorzóval együtt add meg. Törlés: -',
  Arres_szorzo: 'Pl. 1,35. A beszerzési árral együtt add meg. Törlés: -',
  Adonem: 'Pontosan úgy, ahogy az Adónemek listában van (pl. ÁFA 27%).',
  Egyseg: 'Rövidítés (pl. db) vagy teljes név.',
  Aktiv: 'igen / nem. Új terméknél üresen: igen.',
  Kep_fajlnev: 'A Média oldalra feltöltött kép fájlneve (pl. RIEX-EA60.jpg). Törlés: -',
  Galeria:
    'További képek a Média oldalról, | jellel elválasztva (pl. RIEX-EA60-2.jpg | RIEX-EA60-3.jpg). A mostani galériát lecseréli. Legfeljebb 20. Törlés: -',
  Azonosito: 'Ne írd át. Ezzel ismerjük fel a terméket akkor is, ha a SKU-t megváltoztatod. Új terméknél hagyd üresen.'
}

export type AccessoryExcelRow = {
  manufacturerName: string
  name: string
  sku: string
  barcode: string | null
  barcodeInternal: string | null
  priceGross: number | null
  purchasePriceNet: number | null
  marginFactor: number | null
  taxRateName: string
  unitLabel: string
  active: boolean
  imageFilename: string | null
  /** Fájlnév, vagy ha a kép nem a Médiából jön, a teljes URL. */
  gallery: string[]
  id: string | null
}

export const ACCESSORY_EXCEL_EXAMPLE_ROW: Record<AccessoryExcelHeader, string | number> = {
  Gyarto: 'Riex',
  Nev: 'EA60 asztalláb',
  SKU: 'RIEX-EA60',
  Vonalkod: '',
  Belso_vonalkod: '',
  Brutto_Ft: 2490,
  Beszerzes_netto_Ft: 1400,
  Arres_szorzo: 1.4,
  Adonem: 'ÁFA 27%',
  Egyseg: 'db',
  Aktiv: 'igen',
  Kep_fajlnev: 'RIEX-EA60.jpg',
  Galeria: 'RIEX-EA60-2.jpg | RIEX-EA60-3.jpg',
  Azonosito: ''
}

export const ACCESSORY_EXCEL_GUIDE_LINES = [
  'Termékek feltöltése Excelből',
  '',
  'Így működik',
  '1. Töltsd le a meglévő termékeket (Letöltöm Excelben) vagy az üres sablont.',
  '2. Írd át vagy írd be a sorokat a „Termekek” lapon. Egy sor = egy termék.',
  '3. Töltsd fel. Előbb megmutatjuk, mi fog történni — addig semmi nem mentődik.',
  '4. Ha valami hibás, azt a sort kihagyjuk, a többi mentődik. A hibás sorokat letöltheted, javíthatod és újra feltöltheted.',
  '',
  'Szabályok',
  '• A termékeket a SKU alapján ismerjük fel. Ugyanazt a fájlt kétszer feltöltve sem lesz dupla termék.',
  '• Az Azonosító oszlopot ne írd át: ha a SKU-t átírod, ez alapján tudjuk, melyik termékről van szó.',
  '• Üres cella = nem változik. Ha valamit törölni akarsz, írj bele egy kötőjelet: -',
  '• Ha egy oszlop hiányzik a fájlból, az a mező nem változik. Így egy csak SKU + Brutto_Ft fájl csak árat frissít.',
  '• Új terméknél kötelező: Gyarto, Nev, SKU, Adonem, Egyseg és ár (Brutto_Ft, vagy Beszerzes_netto_Ft + Arres_szorzo).',
  '• Gyártó: ha még nincs ilyen, a feltöltéskor megkérdezzük, létrehozzuk-e, vagy melyik meglévőre gondoltál.',
  '• Adónem, egység: pontosan úgy, ahogy a törzsadatokban van (a Listak lapon megtalálod).',
  '• Ár: a Brutto_Ft az eladási bruttó ár. Ha üres, de a beszerzés és a szorzó ki van töltve: eladási nettó = beszerzés × szorzó.',
  '• Vonalkód: a 0-val kezdődő kódok miatt az oszlop szöveg formátumú. Ha máshonnan másolsz be, illeszd be „csak értékként”.',
  '• Kép: a Média oldalra előre feltöltött kép fájlneve. Galeria: további képek fájlnevei | jellel elválasztva.',
  '• Képeknél a sorrend: előbb töltsd fel a képeket a Média oldalra, utána ezt a fájlt.',
  '• Törlés nincs: az Excelből hiányzó termékek megmaradnak. Terméket törölni a listában lehet.',
  `• Legfeljebb ${ACCESSORY_IMPORT_MAX_ROWS.toLocaleString('hu-HU')} sor és 4 MB fájlonként.`
]
