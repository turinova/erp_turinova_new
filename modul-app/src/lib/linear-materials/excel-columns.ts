/** Excel template / export / import contract — szálas anyagok. */

export const LINEAR_EXCEL_SHEET_NAME = 'Szalas_anyagok'
export const LINEAR_EXCEL_GUIDE_NAME = 'Utmutato'
export const LINEAR_IMPORT_MAX_ROWS = 1000

export const LINEAR_EXCEL_HEADERS = [
  'Gyarto',
  'Tipus',
  'Nev',
  'Hossz_mm',
  'Szelesseg_mm',
  'Vastagsag_mm',
  'Brutto_Ft_m',
  'Beszerzes_netto_Ft_m',
  'Arres_szorzo',
  'Adonem',
  'Raktari',
  'Aktiv',
  'Kep_fajlnev'
] as const

export type LinearExcelHeader = (typeof LINEAR_EXCEL_HEADERS)[number]

export const LINEAR_EXCEL_OPTIONAL_HEADERS: ReadonlySet<LinearExcelHeader> =
  new Set(['Beszerzes_netto_Ft_m', 'Arres_szorzo', 'Kep_fajlnev'])

export type LinearExcelRow = {
  manufacturerName: string
  materialTypeLabel: string
  name: string
  lengthMm: number
  widthMm: number
  thicknessMm: number
  priceGross: number | null
  purchasePriceNet: number | null
  marginFactor: number | null
  taxRateName: string
  onStock: boolean
  active: boolean
  imageFilename: string | null
}

export const LINEAR_EXCEL_EXAMPLE_ROW: Record<
  LinearExcelHeader,
  string | number
> = {
  Gyarto: 'Egger',
  Tipus: 'Munkalap',
  Nev: 'W1000 ST9 Fehér',
  Hossz_mm: 4100,
  Szelesseg_mm: 600,
  Vastagsag_mm: 36,
  Brutto_Ft_m: 12000,
  Beszerzes_netto_Ft_m: 7500,
  Arres_szorzo: 1.35,
  Adonem: 'ÁFA 27%',
  Raktari: 'igen',
  Aktiv: 'igen',
  Kep_fajlnev: 'munkalap-w1000.jpg'
}

export const LINEAR_EXCEL_GUIDE_LINES = [
  'Szálas anyagok import / export',
  '',
  '1. Töltsd le a sablont vagy exportáld a meglévő anyagokat.',
  '2. Töltsd ki a „Szalas_anyagok” munkalapot (az „Utmutato” csak magyarázat).',
  '3. Importáld a fájlt — előnézet után erősítsd meg.',
  '',
  'Azonosítás (új vs frissítés): Gyártó + Típus + Név + Hossz + Szélesség + Vastagság.',
  'Típus: Hátfal | Munkalap | Asztalap (vagy hatfal / munkalap / asztalap).',
  'Gyártó / Adónem: pontos név a törzsadatból (nem UUID).',
  'Ár: Brutto_Ft_m = eladási bruttó. Ha kitöltött, ez az eladási ár forrása.',
  'Opcionális: Beszerzes_netto_Ft_m + Arres_szorzo (pl. 1.35).',
  'Ha a Bruttó üres, az eladási nettó = round(beszerzés × szorzó).',
  'Ha mindhárom kitöltött: eladás a bruttóból; beszerzés+szorzó csak tárolódik.',
  'Igen/nem mezők: igen / nem (vagy true / false, 1 / 0).',
  'Kep_fajlnev: opcionális — Média könyvtár fájlnév. Üres frissítéskor nem törli a képet.',
  `Maximum ${LINEAR_IMPORT_MAX_ROWS} adatsor / fájl.`
]
