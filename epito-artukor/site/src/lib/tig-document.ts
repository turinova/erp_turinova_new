import type { PerformanceCertificate, QuoteLine } from "@/types/projects"
import { getQuoteContractContext } from "@/lib/quote-contract-context"
import { buildContractedSellMap } from "@/lib/quote-execution"
import {
  getProject,
  getQuote,
  listPerformanceCertificatesForProject,
  listQuoteLines,
} from "@/lib/data/projects-store"
import {
  buildTigPreviewModel,
  formatTigDocumentNumber,
  type TigPreviewModel,
} from "@/lib/tig-preview-build"

export type { TigParty, TigPreviewModel } from "@/lib/tig-preview-build"
export { formatTigDate, tigTradeSummary } from "@/lib/tig-preview-build"

export function isLineEligibleForTig(line: QuoteLine): boolean {
  return line.executionStatus === "done" && !line.tigDocumentId
}

export function listEligibleTigLineIds(quoteId: string): string[] {
  return listQuoteLines(quoteId)
    .filter(isLineEligibleForTig)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => l.id)
}

export type BuildTigPreviewInput = {
  projectId: string
  quoteId: string
  lineIds: string[]
  periodTo?: string
  periodFrom?: string
  notes?: string
  existing?: PerformanceCertificate
}

export function buildTigPreview(input: BuildTigPreviewInput): TigPreviewModel | null {
  const project = getProject(input.projectId)
  const quote = getQuote(input.quoteId)
  if (!project || !quote) return null

  const allLines = listQuoteLines(input.quoteId)
  const selected = allLines.filter((l) => input.lineIds.includes(l.id))
  if (selected.length === 0) return null

  for (const line of selected) {
    if (!isLineEligibleForTig(line) && !input.existing?.lines.some((x) => x.lineId === line.id)) {
      return null
    }
  }

  const ctx = getQuoteContractContext(input.projectId, quote.id)
  const contractReference =
    ctx.isContracted && ctx.packageTitle
      ? `${ctx.packageTitle} — ${quote.title}`
      : quote.title

  const issuedAt = input.existing?.issuedAt ?? new Date().toISOString().slice(0, 10)
  const periodTo = input.periodTo ?? input.existing?.periodTo ?? issuedAt
  const seq = input.existing
    ? listPerformanceCertificatesForProject(input.projectId).findIndex(
        (c) => c.id === input.existing?.id
      ) + 1 || 1
    : listPerformanceCertificatesForProject(input.projectId).length + 1
  const documentNumber =
    input.existing?.documentNumber ?? formatTigDocumentNumber(project, seq)

  return buildTigPreviewModel({
    project,
    quote,
    selectedLines: selected,
    contractedMap: buildContractedSellMap(input.projectId, input.quoteId),
    contractReference,
    contractPackageId: ctx.packageId ?? input.existing?.contractPackageId,
    contractPackageTitle: ctx.packageTitle ?? input.existing?.contractPackageTitle,
    documentNumber,
    issuedAt,
    periodTo,
    periodFrom: input.periodFrom ?? input.existing?.periodFrom,
    notes: input.notes ?? input.existing?.notes,
  })
}

export function performanceCertificateToPreview(cert: PerformanceCertificate): TigPreviewModel | null {
  const firstLine = cert.lines[0]
  if (!firstLine) return null

  return buildTigPreview({
    projectId: cert.projectId,
    quoteId: firstLine.quoteId,
    lineIds: cert.lines.map((l) => l.lineId),
    periodFrom: cert.periodFrom,
    periodTo: cert.periodTo,
    notes: cert.notes,
    existing: cert,
  })
}
