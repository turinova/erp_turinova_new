/** Shared column contract for edge-material Excel template / export / import. */

export const EDGE_EXCEL_SHEET_NAME = 'Elzarok'
export const EDGE_EXCEL_GUIDE_NAME = 'Utmutato'
export const EDGE_IMPORT_MAX_ROWS = 1000

export const EDGE_EXCEL_HEADERS = [
  'Gyarto',
  'Tipus',
  'Dekor',
  'Szelesseg_mm',
  'Vastagsag_mm',
  'Brutto_Ft_m',
  'Adonem',
  'Berendezes',
  'Gepkod',
  'Rahagyas_mm',
  'Kedvenc_sorrend',
  'Aktiv'
] as const

export type EdgeExcelHeader = (typeof EDGE_EXCEL_HEADERS)[number]

export type EdgeExcelRow = {
  manufacturerName: string
  type: string
  decor: string
  widthMm: number
  thicknessMm: number
  priceGross: number
  taxRateName: string
  equipmentName: string
  machineCode: string
  allowanceMm: number
  favouritePriority: number | null
  active: boolean
}

export const EDGE_EXCEL_EXAMPLE_ROW: Record<EdgeExcelHeader, string | number> =
  {
    Gyarto: 'Rehau',
    Tipus: 'ABS',
    Dekor: 'W1000 Fehér',
    Szelesseg_mm: 23,
    Vastagsag_mm: 0.8,
    Brutto_Ft_m: 180,
    Adonem: 'ÁFA 27%',
    Berendezes: 'Fő gép',
    Gepkod: 'ELZ-001',
    Rahagyas_mm: 20,
    Kedvenc_sorrend: 1,
    Aktiv: 'igen'
  }

export const EDGE_EXCEL_GUIDE_LINES = [
  'Élzárók import / export',
  '',
  '1. Töltsd le a sablont vagy exportáld a meglévő élzárókat.',
  '2. Töltsd ki az „Elzarok” munkalapot (az „Utmutato” csak magyarázat).',
  '3. Importáld a fájlt — előnézet után erősítsd meg.',
  '',
  'Azonosítás (új vs frissítés): Gyártó + Típus + Dekor + Szélesség + Vastagság.',
  'Gyártó / Adónem / Berendezés: pontos név a törzsadatból (nem UUID).',
  'Ár: Bruttó Ft/m. Az adónem ÁFA%-a alapján nettótá számoljuk.',
  'Igen/nem mezők: igen / nem (vagy true / false, 1 / 0).',
  'Kedvenc_sorrend: egész szám, vagy üres (nincs kedvenc sorrend).',
  `Maximum ${EDGE_IMPORT_MAX_ROWS} adatsor / fájl.`
]
