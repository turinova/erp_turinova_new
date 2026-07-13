import type { Project, Quote, QuoteLine } from "@/types/projects"
import type { OrganizationProfile } from "@/types/organization"
import type { QuoteSummary } from "@/lib/quote-summary"
import { quoteTradeLabel } from "@/lib/quote-list-helpers"
import { getOrganizationProfile } from "@/lib/organization-profile"
import { sanitizeSheetName } from "@/lib/project-export/sheet-name"
import type { ProjectExportKind, ProjectExportModel } from "@/lib/project-export/types"

export type BuildExportModelInput = {
  project: Project
  kind: ProjectExportKind
  quotes: Quote[]
  quoteSummaries: Map<string, QuoteSummary>
  linesByQuoteId: Map<string, QuoteLine[]>
  selectedQuoteIds: string[]
  includeArchived?: boolean
  organization?: OrganizationProfile
}

export function buildProjectExportModel(input: BuildExportModelInput): ProjectExportModel {
  const usedNames = new Set<string>()
  const organization = input.organization ?? getOrganizationProfile()

  const selected = new Set(input.selectedQuoteIds)
  const quotes = input.quotes
    .filter((q) => selected.has(q.id))
    .filter((q) => input.includeArchived || q.status !== "archived")
    .map((q) => {
      const summary = input.quoteSummaries.get(q.id)
      const lines = input.linesByQuoteId.get(q.id) ?? []
      if (!summary) return null
      const tradeLabel = quoteTradeLabel(q)
      const sheetName = sanitizeSheetName(tradeLabel, usedNames)
      return {
        quote: q,
        summary,
        lines: [...lines].sort((a, b) => a.sortOrder - b.sortOrder),
        sheetName,
        tradeLabel,
      }
    })
    .filter((q): q is NonNullable<typeof q> => q != null)

  return {
    project: input.project,
    organization,
    kind: input.kind,
    exportedAt: new Date().toISOString(),
    quotes,
  }
}
