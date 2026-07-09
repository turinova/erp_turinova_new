import type { ProjectDataBundle, Quote, QuoteLine } from "@/types/projects"
import { getDefaultVatModeStatic } from "@/lib/organization-profile"
import { getDefaultTradeMarkupsStatic } from "@/lib/app-settings"
import { normalizeRfqBundle } from "@/lib/rfq-migration"
import { inferPrimaryTrade } from "@/lib/project-quote-aggregation"

/** Régi materialUnitPrice / laborUnitPrice → cost mezők + alapértelmezett meta */
export function normalizeQuoteLine(line: QuoteLine & {
  materialUnitPrice?: number
  laborUnitPrice?: number
}): QuoteLine {
  const costMaterial =
    line.costMaterialUnitPrice ??
    line.materialUnitPrice ??
    0
  const costLabor =
    line.costLaborUnitPrice ??
    line.laborUnitPrice ??
    0
  const hasCost = costMaterial > 0 || costLabor > 0

  return {
    id: line.id,
    quoteId: line.quoteId,
    sortOrder: line.sortOrder,
    costItemId: line.costItemId,
    identifierSnapshot: line.identifierSnapshot,
    textSnapshot: line.textSnapshot,
    trade: line.trade,
    unitId: line.unitId,
    quantity: line.quantity,
    costMaterialUnitPrice: costMaterial,
    costLaborUnitPrice: costLabor,
    markupPercent: line.markupPercent ?? null,
    costSource:
      line.costSource ??
      (hasCost ? (line.costSourceSubcontractor ? "subcontractor" : "catalog") : "unpriced"),
    costSourceSubcontractor: line.costSourceSubcontractor ?? null,
    costSourceRfqSubmissionId: line.costSourceRfqSubmissionId ?? null,
    pricingStatus:
      line.pricingStatus ??
      (line.costSource === "subcontractor" || line.costSourceSubcontractor
        ? "costed"
        : hasCost
          ? "estimated"
          : "unpriced"),
    executionStatus: line.executionStatus,
    tigDocumentId: line.tigDocumentId,
  }
}

function migrateQuoteScope(quote: Quote, lines: QuoteLine[]): Quote {
  const legacyScope = quote.quoteScope as Quote["quoteScope"] | "full" | undefined
  let scope = quote.quoteScope
  if (legacyScope === "full" || !scope) {
    scope = quote.supersedesQuoteId ? "version" : "trade"
  }
  const primaryTrade =
    quote.primaryTrade ?? inferPrimaryTrade({ ...quote, quoteScope: "trade" }, lines) ?? undefined
  return { ...quote, quoteScope: scope, primaryTrade }
}

export function normalizeQuote(quote: Quote, lines: QuoteLine[]): Quote {
  const migrated = migrateQuoteScope(quote, lines)
  return {
    ...migrated,
    tradeMarkups: {
      ...getDefaultTradeMarkupsStatic(),
      ...quote.tradeMarkups,
    },
    vatMode: quote.vatMode ?? getDefaultVatModeStatic(),
  }
}

export function normalizeProjectBundle(bundle: ProjectDataBundle): ProjectDataBundle {
  const withRfq = normalizeRfqBundle({
    ...bundle,
    rfqInvitations: bundle.rfqInvitations ?? [],
    rfqDecisionLogs: bundle.rfqDecisionLogs ?? [],
    compositions: bundle.compositions ?? [],
    customerPackages: bundle.customerPackages ?? [],
  })

  const linesByQuote = new Map<string, QuoteLine[]>()
  for (const line of withRfq.quoteLines) {
    const list = linesByQuote.get(line.quoteId) ?? []
    list.push(line)
    linesByQuote.set(line.quoteId, list)
  }

  return {
    ...withRfq,
    rfqCampaigns: withRfq.rfqCampaigns ?? [],
    auditLog: withRfq.auditLog ?? [],
    quotes: withRfq.quotes.map((q) =>
      normalizeQuote(q, linesByQuote.get(q.id) ?? [])
    ),
    quoteLines: withRfq.quoteLines.map(normalizeQuoteLine),
    compositions: bundle.compositions ?? [],
    customerPackages: bundle.customerPackages ?? [],
    performanceCertificates: bundle.performanceCertificates ?? [],
  }
}
