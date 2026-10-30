import type { LabelBarcodeSource } from '@/lib/labels/types'

export const A4_PAGE_KEY = '/torzsadatok/vonalkod-lap' as const

export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297

export type A4GridPresetId = '3x8' | '4x6' | '2x4'

export type A4GridPreset = {
  id: A4GridPresetId
  label: string
  cols: number
  rows: number
  hint: string
}

export const A4_GRID_PRESETS: A4GridPreset[] = [
  {
    id: '3x8',
    label: '3 × 8',
    cols: 3,
    rows: 8,
    hint: 'Sűrű füzet'
  },
  {
    id: '4x6',
    label: '4 × 6',
    cols: 4,
    rows: 6,
    hint: 'Közepes'
  },
  {
    id: '2x4',
    label: '2 × 4',
    cols: 2,
    rows: 4,
    hint: 'Nagy, falra'
  }
]

export type A4BarcodeSource = LabelBarcodeSource

/** Sheet-level defaults for *new* cells (not a global override). */
export type A4SheetFields = {
  showName: boolean
  showSku: boolean
  showPrice: boolean
}

/** Per-cell visibility — drives packer + PDF. */
export type A4CellFields = {
  showName: boolean
  showSku: boolean
  showPrice: boolean
  showBarcode: boolean
}

export const DEFAULT_NEW_CELL_FIELDS: A4CellFields = {
  showName: true,
  showSku: true,
  showPrice: true,
  showBarcode: true
}

export type A4SheetCellDraft = {
  row: number
  col: number
  accessoryId: string | null
  barcodeValue: string
  barcodeSource: A4BarcodeSource
  nameSnap: string
  skuSnap: string
  /** Bruttó Ft — szerkeszthető snapshot. */
  priceGross?: number | null
  /** Egység shortform (db, m…) — PDF: Ft/{unit}. */
  unitSnap: string
  showName: boolean
  showSku: boolean
  showPrice: boolean
  showBarcode: boolean
  accessoryDeleted?: boolean
  blocked?: boolean
  blockMessage?: string | null
}

export type A4SheetDraft = {
  id?: string
  name: string
  cols: number
  rows: number
  marginMm: number
  fields: A4SheetFields
  cells: A4SheetCellDraft[]
}

export function cellKey(row: number, col: number): string {
  return `${row}:${col}`
}

export function cellInnerSizeMm(
  cols: number,
  rows: number,
  marginMm: number
): { widthMm: number; heightMm: number } {
  const m = Math.max(0, marginMm)
  return {
    widthMm: Math.max(1, (A4_WIDTH_MM - 2 * m) / Math.max(1, cols)),
    heightMm: Math.max(1, (A4_HEIGHT_MM - 2 * m) / Math.max(1, rows))
  }
}

export function cellFieldsFromDraft(c: A4SheetCellDraft): A4CellFields {
  return {
    showName: c.showName,
    showSku: c.showSku,
    showPrice: c.showPrice,
    showBarcode: c.showBarcode
  }
}

export function defaultsToCellFields(d: A4SheetFields): A4CellFields {
  return {
    showName: d.showName,
    showSku: d.showSku,
    showPrice: d.showPrice,
    showBarcode: true
  }
}
