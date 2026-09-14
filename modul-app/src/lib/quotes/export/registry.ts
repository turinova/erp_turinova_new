import { buildKorpusExcel } from '@/lib/quotes/export/formats/korpus'
import type {
  BuildExcelResult,
  ExportFormat,
  QuoteExportPanel
} from '@/lib/quotes/export/types'

type ExcelBuilder = (input: {
  quoteNumber: string
  equipmentName: string
  panels: QuoteExportPanel[]
}) => Promise<BuildExcelResult>

const builders: Record<ExportFormat, ExcelBuilder> = {
  korpus: buildKorpusExcel
}

export function getExcelBuilder(format: ExportFormat): ExcelBuilder {
  return builders[format]
}

export async function buildQuoteExcel(input: {
  format: ExportFormat
  quoteNumber: string
  equipmentName: string
  panels: QuoteExportPanel[]
}): Promise<BuildExcelResult> {
  const builder = getExcelBuilder(input.format)
  return builder({
    quoteNumber: input.quoteNumber,
    equipmentName: input.equipmentName,
    panels: input.panels
  })
}
