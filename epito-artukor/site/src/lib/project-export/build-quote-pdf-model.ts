import type { Quote, QuoteLine } from "@/types/projects"
import { loadCostItems } from "@/lib/data/cost-items-store"
import { unitMap } from "@/lib/data/units-store"
import {
  getOfferDefaultNotes,
  getOfferDefaultPaymentTerms,
  getOfferValidityDays,
} from "@/lib/app-settings"
import { getQuoteDisplayIdentifier, isCustomItemFromIdentifier } from "@/lib/item-identifier"
import type { CostItem } from "@/types"
import { buildLineSectionNumbers } from "@/lib/quote-line-display"
import { calcQuoteVatTotals, resolveQuoteVatMode } from "@/lib/quote-client-summary"
import { lineSellTotal } from "@/lib/quote-pricing"
import { groupLinesByTrade } from "@/lib/quote-utils"
import { getTradeLabel } from "@/lib/trades"
import type { ProjectExportModel } from "@/lib/project-export/types"
import { buildProjectExportModel, type BuildExportModelInput } from "@/lib/project-export/build-export-model"
import {
  demoClientParty,
  type TigParty,
} from "@/lib/tig-preview-build"
import {
  organizationBankLine,
  organizationContactLine,
  organizationToContractorParty,
} from "@/lib/organization-profile"

export type QuotePdfLine = {
  ssz: string
  identifier: string
  text: string
  quantity: number
  unitLabel: string
  sellNetUnitPrice: number
  sellNetTotal: number
}

export type QuotePdfTradeBlock = {
  tradeLabel: string
  lines: QuotePdfLine[]
  sellNetTotal: number
}

export type QuotePdfSummaryRow = {
  ssz: number
  tradeLabel: string
  netTotal: number
  vatLabel: string
  vatAmount: number
  grossTotal: number
}

export type QuotePdfModel = {
  issuedAt: string
  validUntil: string
  validityDays: number
  projectName: string
  projectCode: string
  performanceLocation: string
  client: TigParty
  contractor: TigParty
  summaryRows: QuotePdfSummaryRow[]
  trades: QuotePdfTradeBlock[]
  sellNetTotal: number
  vatAmount: number
  grossTotal: number
  vatNote: string | null
  showVatAmount: boolean
  paymentTerms: string
  offerNotes: string
  logoDataUrl?: string
  contractorBankLine?: string | null
  contractorContactLine?: string | null
}

function lineDisplayIdentifier(
  line: QuoteLine,
  costItemById: Map<string, CostItem>
): string {
  if (line.costItemId) {
    const item = costItemById.get(line.costItemId)
    if (item) return getQuoteDisplayIdentifier(item)
  }
  if (isCustomItemFromIdentifier(line.identifierSnapshot)) return "K-tétel"
  return line.identifierSnapshot.trim() || "—"
}

function buildPdfLine(
  line: QuoteLine,
  quote: Quote,
  ssz: string,
  costItemById: Map<string, CostItem>
): QuotePdfLine {
  const sellTotal = lineSellTotal(line, quote)
  const qty = line.quantity
  const unitPrice = qty > 0 ? Math.round(sellTotal / qty) : 0
  return {
    ssz,
    identifier: lineDisplayIdentifier(line, costItemById),
    text: line.textSnapshot,
    quantity: qty,
    unitLabel: unitMap[line.unitId]?.code ?? "db",
    sellNetUnitPrice: unitPrice,
    sellNetTotal: sellTotal,
  }
}

function buildTradeBlocksForQuote(
  quote: Quote,
  lines: QuoteLine[],
  tradeLabel: string,
  costItemById: Map<string, CostItem>
): QuotePdfTradeBlock[] {
  const sectionNumbers = buildLineSectionNumbers(lines)
  const grouped = groupLinesByTrade(lines)
  const blocks: QuotePdfTradeBlock[] = []

  if (grouped.size <= 1) {
    const pdfLines = lines.map((line) =>
      buildPdfLine(
        line,
        quote,
        sectionNumbers.get(line.id) ?? "—",
        costItemById
      )
    )
    blocks.push({
      tradeLabel,
      lines: pdfLines,
      sellNetTotal: pdfLines.reduce((s, l) => s + l.sellNetTotal, 0),
    })
    return blocks
  }

  for (const [trade, group] of grouped) {
    const pdfLines = group.map((line) =>
      buildPdfLine(
        line,
        quote,
        sectionNumbers.get(line.id) ?? "—",
        costItemById
      )
    )
    blocks.push({
      tradeLabel: `${tradeLabel} · ${getTradeLabel(trade)}`,
      lines: pdfLines,
      sellNetTotal: pdfLines.reduce((s, l) => s + l.sellNetTotal, 0),
    })
  }

  return blocks
}

export function buildQuotePdfModelFromExport(exportModel: ProjectExportModel): QuotePdfModel {
  if (exportModel.kind !== "sell") {
    throw new Error("PDF export csak árajánlat (sell) módban érhető el.")
  }

  const costItemById = new Map(loadCostItems().map((item) => [item.id, item]))
  const issuedAt = exportModel.exportedAt
  const issuedDate = new Date(issuedAt)
  const validityDays = getOfferValidityDays()
  const validUntilDate = new Date(issuedDate)
  validUntilDate.setDate(validUntilDate.getDate() + validityDays)

  const org = exportModel.organization
  const contractor = organizationToContractorParty(org)
  const client = demoClientParty(exportModel.project)

  const summaryRows: QuotePdfSummaryRow[] = []
  const trades: QuotePdfTradeBlock[] = []
  let sellNetTotal = 0
  let vatAmount = 0
  let grossTotal = 0
  let vatNote: string | null = null
  let showVatAmount = true

  exportModel.quotes.forEach((slice, index) => {
    const net = slice.summary.sellTotal
    const vatMode = resolveQuoteVatMode(slice.quote)
    const vat = calcQuoteVatTotals(net, vatMode)

    summaryRows.push({
      ssz: index + 1,
      tradeLabel: slice.tradeLabel,
      netTotal: net,
      vatLabel: vat.vatLabel,
      vatAmount: vat.vatAmount,
      grossTotal: vat.grossTotal,
    })

    sellNetTotal += net
    vatAmount += vat.vatAmount
    grossTotal += vat.grossTotal
    if (vat.vatNote) vatNote = vat.vatNote
    if (!vat.showVatAmount) showVatAmount = false

    trades.push(...buildTradeBlocksForQuote(slice.quote, slice.lines, slice.tradeLabel, costItemById))
  })

  const paymentTerms = getOfferDefaultPaymentTerms().trim()
  const offerNotes = getOfferDefaultNotes().trim()

  return {
    issuedAt: issuedDate.toISOString(),
    validUntil: validUntilDate.toISOString(),
    validityDays,
    projectName: exportModel.project.name,
    projectCode: exportModel.project.code,
    performanceLocation: exportModel.project.siteAddress || "—",
    client,
    contractor,
    summaryRows,
    trades,
    sellNetTotal,
    vatAmount,
    grossTotal,
    vatNote,
    showVatAmount,
    paymentTerms,
    offerNotes,
    logoDataUrl: org.logoDataUrl,
    contractorBankLine: organizationBankLine(org),
    contractorContactLine: organizationContactLine(org),
  }
}

export function buildQuotePdfModel(input: BuildExportModelInput): QuotePdfModel {
  const exportModel = buildProjectExportModel({ ...input, kind: "sell" })
  return buildQuotePdfModelFromExport(exportModel)
}
