import type { CostItem } from "@/types"
import type { Quote } from "@/types/projects"
import { getTradeLabel } from "@/lib/trades"
import { pickBetterQuote } from "@/lib/project-quote-aggregation"
import type {
  QuoteImportMatchedRow,
  QuoteImportPreviewGroup,
  QuoteImportPreviewResponse,
  QuoteImportPreviewRow,
} from "@/lib/cost-items/quote-import-types"

function resolveTargetQuote(
  trade: string,
  quotes: Quote[]
): { quoteId: string | null; action: "EXISTING" | "CREATE"; label: string } {
  const pool = quotes.filter(
    (q) =>
      q.status !== "archived" &&
      q.status !== "rejected" &&
      q.quoteScope !== "version" &&
      q.primaryTrade === trade
  )

  if (pool.length === 0) {
    return {
      quoteId: null,
      action: "CREATE",
      label: `${getTradeLabel(trade)} (új)`,
    }
  }

  const draft = pool.filter((q) => q.status === "draft")
  const target = (draft.length > 0 ? draft : pool).reduce((best, q) =>
    pickBetterQuote(q, best) === q ? q : best
  )

  return {
    quoteId: target.id,
    action: "EXISTING",
    label: target.title,
  }
}

function validatePreviewRow(
  row: QuoteImportMatchedRow,
  target: ReturnType<typeof resolveTargetQuote>,
  quotes: Quote[]
): QuoteImportPreviewRow {
  const warnings: string[] = []
  const errors: string[] = []

  if (!row.matchedCostItemId) {
    errors.push("Nincs párosított K-tétel a katalógusban.")
  } else if (row.matchScore < 75) {
    warnings.push(`Alacsony egyezés (${row.matchScore}%) — ellenőrizd a párosítást.`)
  }

  if (row.matchSource === "none") {
    errors.push("Nem található megfelelő K-tétel.")
  }

  if (target.action === "EXISTING" && target.quoteId) {
    const quote = quotes.find((q) => q.id === target.quoteId)
    if (quote?.status === "accepted" || quote?.status === "sent") {
      warnings.push(
        `A cél költségvetés (${quote.title}) már ${quote.status === "accepted" ? "elfogadott" : "elküldött"}.`
      )
    }
  }

  return {
    ...row,
    targetQuoteId: target.quoteId,
    targetQuoteAction: target.action,
    targetQuoteLabel: target.label,
    included: errors.length === 0,
    warnings,
    errors,
  }
}

export function buildQuoteImportPreview(
  matched: QuoteImportMatchedRow[],
  quotes: Quote[],
  catalogItems: CostItem[],
  aiAvailable: boolean
): QuoteImportPreviewResponse {
  const tradeTargets = new Map<string, ReturnType<typeof resolveTargetQuote>>()

  const rows = matched.map((row) => {
    const trade = row.trade ?? "epitomester"
    if (!tradeTargets.has(trade)) {
      tradeTargets.set(trade, resolveTargetQuote(trade, quotes))
    }
    return validatePreviewRow(row, tradeTargets.get(trade)!, quotes)
  })

  const groupsMap = new Map<string, QuoteImportPreviewGroup>()
  for (const row of rows) {
    if (!row.trade) continue
    const trade = row.trade
    if (!groupsMap.has(trade)) {
      const target = tradeTargets.get(trade) ?? resolveTargetQuote(trade, quotes)
      groupsMap.set(trade, {
        trade,
        tradeLabel: getTradeLabel(trade),
        targetQuoteId: target.quoteId,
        targetQuoteAction: target.action,
        targetQuoteLabel: target.label,
        rows: [],
      })
    }
    groupsMap.get(trade)!.rows.push(row)
  }

  const groups = [...groupsMap.values()].sort((a, b) =>
    a.tradeLabel.localeCompare(b.tradeLabel, "hu")
  )

  return {
    rows,
    groups,
    catalogItems: catalogItems
      .filter((item) => item.status === "active")
      .map((item) => ({
        id: item.id,
        text: item.text,
        trade: item.trade,
        identifier: item.identifier,
      })),
    existingQuotes: quotes.map((q) => ({
      id: q.id,
      title: q.title,
      primaryTrade: q.primaryTrade,
      status: q.status,
    })),
    aiAvailable,
    aiUsedCount: rows.filter((r) => r.aiUsed).length,
    row_count: rows.length,
    matched_count: rows.filter((r) => r.matchedCostItemId).length,
    unmatched_count: rows.filter((r) => !r.matchedCostItemId).length,
    error_count: rows.filter((r) => r.errors.length > 0).length,
    warning_count: rows.reduce((sum, r) => sum + r.warnings.length, 0),
  }
}

export function validateQuoteImportPreviewRow(
  row: QuoteImportPreviewRow,
  quotes: Quote[],
  catalogItems: Array<Pick<CostItem, "id" | "text" | "trade">>
): QuoteImportPreviewRow {
  const item = row.matchedCostItemId
    ? catalogItems.find((c) => c.id === row.matchedCostItemId)
    : undefined

  const matched: QuoteImportMatchedRow = {
    lineNumber: row.lineNumber,
    rawInput: row.rawInput,
    text: row.text,
    quantity: row.quantity,
    matchedCostItemId: row.matchedCostItemId,
    matchedText: item?.text ?? row.matchedText,
    matchScore: row.matchScore,
    matchSource: row.matchSource,
    alternatives: row.alternatives,
    trade: item?.trade ?? row.trade,
    aiUsed: row.aiUsed,
  }

  const trade = matched.trade
  const target =
    row.targetQuoteId && quotes.some((q) => q.id === row.targetQuoteId)
      ? {
          quoteId: row.targetQuoteId,
          action: "EXISTING" as const,
          label: quotes.find((q) => q.id === row.targetQuoteId)?.title ?? row.targetQuoteLabel ?? "",
        }
      : trade
        ? resolveTargetQuote(trade, quotes)
        : { quoteId: null, action: "CREATE" as const, label: row.targetQuoteLabel ?? "" }

  return {
    ...validatePreviewRow(matched, target, quotes),
    included: row.included,
    quantity: row.quantity,
    targetQuoteId: row.targetQuoteId ?? target.quoteId,
    targetQuoteAction: row.targetQuoteAction,
    targetQuoteLabel: row.targetQuoteLabel ?? target.label,
  }
}
