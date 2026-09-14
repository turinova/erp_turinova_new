/** Supported cutting-list Excel export formats (equipment.export_format). */

export const EXPORT_FORMATS = ['korpus'] as const

export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  korpus: 'Korpus cutting list'
}

export function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value)
}

export function exportFormatLabel(format: string): string {
  if (isExportFormat(format)) return EXPORT_FORMAT_LABELS[format]
  return format
}

export type QuoteExportPanel = {
  id: string
  sheetMaterialId: string
  equipmentId: string
  machineCode: string
  grainMm: number
  crossMm: number
  quantity: number
  label: string | null
  grainDirection: boolean
  edgeACode: string | null
  edgeBCode: string | null
  edgeCCode: string | null
  edgeDCode: string | null
}

export type QuoteExportTarget = {
  equipmentId: string
  equipmentName: string
  exportFormat: ExportFormat
  panelCount: number
  missingMachineCodeCount: number
  /** Soft-deleted equipment still referenced by sheet materials. */
  isDeleted: boolean
}

export type BuildExcelResult = {
  buffer: ArrayBuffer
  filename: string
  mimeType: string
}
