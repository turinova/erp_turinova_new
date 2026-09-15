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
  'Adonem',
  'Raktari',
  'Aktiv'
] as const

export type LinearExcelHeader = (typeof LINEAR_EXCEL_HEADERS)[number]

export type LinearExcelRow = {
  manufacturerName: string
  materialTypeLabel: string
  name: string
  lengthMm: number
  widthMm: number
  thicknessMm: number
  priceGross: number
  taxRateName: string
  onStock: boolean
  active: boolean
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
  Adonem: 'ÁFA 27%',
  Raktari: 'igen',
  Aktiv: 'igen'
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
  'Ár: Bruttó Ft/m. Az adónem ÁFA%-a alapján nettótá számoljuk.',
  'Igen/nem mezők: igen / nem (vagy true / false, 1 / 0).',
  `Maximum ${LINEAR_IMPORT_MAX_ROWS} adatsor / fájl.`,
  'Kép URL nincs az Excelben — képet a szerkesztőben tölts fel.'
]
