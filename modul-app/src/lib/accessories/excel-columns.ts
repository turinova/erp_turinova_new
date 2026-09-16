/** Shared column contract for accessories (termékek) Excel template / export / import. */

export const ACCESSORY_EXCEL_SHEET_NAME = 'Termekek'
export const ACCESSORY_EXCEL_GUIDE_NAME = 'Utmutato'
export const ACCESSORY_IMPORT_MAX_ROWS = 1000

export const ACCESSORY_EXCEL_HEADERS = [
  'Gyarto',
  'Nev',
  'SKU',
  'Vonalkod',
  'Belso_vonalkod',
  'Brutto_Ft',
  'Adonem',
  'Egyseg',
  'Aktiv',
  'Kep_fajlnev'
] as const

export type AccessoryExcelHeader = (typeof ACCESSORY_EXCEL_HEADERS)[number]

export type AccessoryExcelRow = {
  manufacturerName: string
  name: string
  sku: string
  barcode: string | null
  barcodeInternal: string | null
  priceGross: number
  taxRateName: string
  unitLabel: string
  active: boolean
  imageFilename: string | null
}

export const ACCESSORY_EXCEL_EXAMPLE_ROW: Record<
  AccessoryExcelHeader,
  string | number
> = {
  Gyarto: 'Riex',
  Nev: 'EA60 asztalláb',
  SKU: 'RIEX-EA60',
  Vonalkod: '',
  Belso_vonalkod: '',
  Brutto_Ft: 2490,
  Adonem: 'ÁFA 27%',
  Egyseg: 'db',
  Aktiv: 'igen',
  Kep_fajlnev: 'RIEX-EA60.jpg'
}

export const ACCESSORY_EXCEL_GUIDE_LINES = [
  'Termékek import / export',
  '',
  '1. Töltsd le a sablont vagy exportáld a meglévő termékeket.',
  '2. Töltsd ki a „Termekek” munkalapot (az „Utmutato” csak magyarázat).',
  '3. Importáld a fájlt — előnézet után erősítsd meg.',
  '',
  'Azonosítás (új vs frissítés): SKU (kis/nagybetű nem számít).',
  'Gyártó / Adónem: pontos név a törzsadatból.',
  'Egység: rövidítés (pl. db) vagy teljes név.',
  'Ár: Bruttó Ft / egység. Az adónem ÁFA%-a alapján nettótá számoljuk.',
  'Vonalkód / Belső vonalkód: opcionális; ha kitöltött, egyedinek kell lennie.',
  'Aktív: igen / nem.',
  'Kep_fajlnev: opcionális — a Média könyvtárban lévő fájlnév (pl. RIEX-EA60.jpg).',
  'Üres Kep_fajlnev frissítéskor nem törli a meglévő képet.',
  `Maximum ${ACCESSORY_IMPORT_MAX_ROWS} adatsor / fájl.`
]
