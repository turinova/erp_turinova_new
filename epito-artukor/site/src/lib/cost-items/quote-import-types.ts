import type { Trade } from "@/types"
import type { Quote } from "@/types/projects"
import type { AiSearchMatch } from "@/lib/cost-items/ai-search-types"

export type QuoteImportMatchSource = "identifier" | "fuzzy" | "local" | "ai" | "none"

export type QuoteImportInputRow = {
  lineNumber: number
  rawInput: string
  text: string
  quantity: number
  unitHint: string | null
  identifierHint: string | null
}

export type QuoteImportMatchedRow = {
  lineNumber: number
  rawInput: string
  text: string
  quantity: number
  matchedCostItemId: string | null
  matchedText: string | null
  matchScore: number
  matchSource: QuoteImportMatchSource
  alternatives: AiSearchMatch[]
  trade: Trade | null
  aiUsed: boolean
}

export type QuoteImportTargetAction = "EXISTING" | "CREATE"

export type QuoteImportPreviewRow = QuoteImportMatchedRow & {
  targetQuoteId: string | null
  targetQuoteAction: QuoteImportTargetAction
  targetQuoteLabel: string | null
  included: boolean
  warnings: string[]
  errors: string[]
}

export type QuoteImportPreviewGroup = {
  trade: Trade
  tradeLabel: string
  targetQuoteId: string | null
  targetQuoteAction: QuoteImportTargetAction
  targetQuoteLabel: string
  rows: QuoteImportPreviewRow[]
}

export type QuoteImportPreviewResponse = {
  rows: QuoteImportPreviewRow[]
  groups: QuoteImportPreviewGroup[]
  catalogItems: Array<{
    id: string
    text: string
    trade: Trade
    identifier: string
  }>
  existingQuotes: Array<Pick<Quote, "id" | "title" | "primaryTrade" | "status">>
  aiAvailable: boolean
  aiUsedCount: number
  row_count: number
  matched_count: number
  unmatched_count: number
  error_count: number
  warning_count: number
}

export type QuoteImportDuplicatePolicy = "skip" | "add"

export type QuoteImportExecuteOptions = {
  createMissingQuotes: boolean
  duplicatePolicy: QuoteImportDuplicatePolicy
}

export type QuoteImportExecuteResult = {
  createdQuotes: number
  addedLines: number
  skippedDuplicates: number
  skippedUnmatched: number
  failed: number
  quoteIds: string[]
  errors: Array<{ lineNumber: number; reason: string }>
}
