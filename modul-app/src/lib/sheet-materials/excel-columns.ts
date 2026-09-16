/** Shared column contract for sheet-material Excel template / export / import. */

export const SHEET_EXCEL_SHEET_NAME = 'Tablas_anyagok'
export const SHEET_EXCEL_GUIDE_NAME = 'Utmutato'
export const SHEET_IMPORT_MAX_ROWS = 1000

export const SHEET_EXCEL_HEADERS = [
  'Gyarto',
  'Nev',
  'Hossz_mm',
  'Szelesseg_mm',
  'Vastagsag_mm',
  'Brutto_Ft_m2',
  'Adonem',
  'Berendezes',
  'Gepkod',
  'Raktari',
  'Aktiv',
  'Trim_fel_mm',
  'Trim_jobb_mm',
  'Trim_le_mm',
  'Trim_bal_mm',
  'Kerf_mm',
  'Hulladek_szorzo',
  'Kihasznaltsag_szazalek',
  'Szalirany',
  'Forgathato',
  'Kep_fajlnev'
] as const

export type SheetExcelHeader = (typeof SHEET_EXCEL_HEADERS)[number]

export type SheetExcelRow = {
  manufacturerName: string
  name: string
  lengthMm: number
  widthMm: number
  thicknessMm: number
  priceGross: number
  taxRateName: string
  equipmentName: string
  machineCode: string
  onStock: boolean
  active: boolean
  trimTopMm: number
  trimRightMm: number
  trimBottomMm: number
  trimLeftMm: number
  kerfMm: number
  wasteMulti: number
  usageLimitPercent: number
  grainDirection: boolean
  rotatable: boolean
  imageFilename: string | null
}

export const SHEET_EXCEL_EXAMPLE_ROW: Record<SheetExcelHeader, string | number> =
  {
    Gyarto: 'Egger',
    Nev: 'W1000 ST9 Fehér',
    Hossz_mm: 2800,
    Szelesseg_mm: 2070,
    Vastagsag_mm: 18,
    Brutto_Ft_m2: 4500,
    Adonem: 'ÁFA 27%',
    Berendezes: 'Fő gép',
    Gepkod: 'MAT-001',
    Raktari: 'igen',
    Aktiv: 'igen',
    Trim_fel_mm: 10,
    Trim_jobb_mm: 10,
    Trim_le_mm: 10,
    Trim_bal_mm: 10,
    Kerf_mm: 3,
    Hulladek_szorzo: 1.2,
    Kihasznaltsag_szazalek: 65,
    Szalirany: 'nem',
    Forgathato: 'igen',
    Kep_fajlnev: 'MAT-001.jpg'
  }

export const SHEET_EXCEL_GUIDE_LINES = [
  'Táblás anyagok import / export',
  '',
  '1. Töltsd le a sablont vagy exportáld a meglévő anyagokat.',
  '2. Töltsd ki a „Tablas_anyagok” munkalapot (az „Utmutato” csak magyarázat).',
  '3. Importáld a fájlt — előnézet után erősítsd meg.',
  '',
  'Azonosítás (új vs frissítés): Gyártó + Név + Hossz + Szélesség + Vastagság.',
  'Gyártó / Adónem / Berendezés: pontos név a törzsadatból (nem UUID).',
  'Ár: Bruttó Ft/m². Az adónem ÁFA%-a alapján nettótá számoljuk.',
  'Igen/nem mezők: igen / nem (vagy true / false, 1 / 0).',
  'Kihasználtság: százalék (pl. 65 = 65%).',
  'Kep_fajlnev: opcionális — Média könyvtár fájlnév. Üres frissítéskor nem törli a képet.',
  `Maximum ${SHEET_IMPORT_MAX_ROWS} adatsor / fájl.`
]
