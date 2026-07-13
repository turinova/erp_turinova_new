import type { Project, Quote, QuoteLine } from "@/types/projects"
import type { OrganizationProfile } from "@/types/organization"
import type { QuoteSummary } from "@/lib/quote-summary"

export type ProjectExportKind = "cost" | "sell"

export type ProjectExportQuoteSlice = {
  quote: Quote
  summary: QuoteSummary
  lines: QuoteLine[]
  sheetName: string
  tradeLabel: string
}

export type ProjectExportModel = {
  project: Project
  organization: OrganizationProfile
  kind: ProjectExportKind
  exportedAt: string
  quotes: ProjectExportQuoteSlice[]
}

export type TradeSheetAnchors = {
  materialTotal: string
  laborTotal: string
  netTotal: string
  /** Bekerülési export — eladás nettó lábléc (ügyfélár összesen). */
  sellTotal?: string
  /** Bekerülési export — fedezet összeg lábléc. */
  marginTotal?: string
  totalRow: number
}

export type BuiltTradeSheet = {
  sheetName: string
  anchors: TradeSheetAnchors
  appTotals: {
    material: number
    labor: number
    net: number
  }
}

export type ExportValidationIssue = {
  level: "error" | "warning"
  message: string
}

export type ExportValidationResult = {
  ok: boolean
  issues: ExportValidationIssue[]
}
