import type { Quote } from "@/types/projects"
import { buildContractBaseline } from "@/lib/contract-baseline"
import {
  getProject,
  listCustomerPackagesForProject,
  listPerformanceCertificatesForProject,
  listQuoteLines,
  listQuotesForProject,
} from "@/lib/data/projects-store"
import {
  computeQuoteExecutionStats,
  isLineEligibleForTig,
  isLineTigCertified,
} from "@/lib/quote-execution"

export type SupplementPendingItem = {
  quoteId: string
  quoteTitle: string
  packageId?: string
  packageTitle?: string
  packageStatus?: "draft" | "sent"
  grossTotal?: number
}

export type ExecutionSummary = {
  isExecutionPhase: boolean
  contractGross: number
  contractSellNet: number
  baseGross: number
  supplementGross: number
  liveCostNet: number
  liveMarginNet: number
  marginPercentOnContract: number | null
  executionDone: number
  executionTotal: number
  executionPercent: number
  tigCount: number
  tigGrossTotal: number
  tigNetTotal: number
  tigCertifiedLineCount: number
  eligibleTigLineCount: number
  remainingGross: number
  tigPercentOfContract: number
  pendingSupplements: SupplementPendingItem[]
  draftSupplementQuoteCount: number
}

export type ProjectCloseReadiness = {
  canClose: boolean
  warnings: string[]
  blockers: string[]
}

export function buildExecutionSummary(projectId: string): ExecutionSummary {
  const project = getProject(projectId)
  const contract = buildContractBaseline(projectId)
  const isExecutionPhase =
    project != null &&
    (project.status === "won" ||
      project.status === "in_progress" ||
      project.status === "done")

  const acceptedQuotes = listQuotesForProject(projectId).filter((q) => q.status === "accepted")

  let liveCostNet = 0
  let executionDone = 0
  let executionTotal = 0
  let tigCertifiedLineCount = 0
  let eligibleTigLineCount = 0

  for (const quote of acceptedQuotes) {
    const lines = listQuoteLines(quote.id)
    const stats = computeQuoteExecutionStats(lines)
    executionDone += stats.done
    executionTotal += stats.total

    for (const line of lines) {
      liveCostNet += line.costMaterialUnitPrice * line.quantity + line.costLaborUnitPrice * line.quantity
      if (isLineTigCertified(line)) tigCertifiedLineCount += 1
      if (isLineEligibleForTig(line)) eligibleTigLineCount += 1
    }
  }

  const executionPercent =
    executionTotal > 0 ? Math.round((executionDone / executionTotal) * 100) : 0

  const liveMarginNet =
    contract.sellNetTotal > 0 ? contract.sellNetTotal - liveCostNet : 0
  const marginPercentOnContract =
    contract.sellNetTotal > 0
      ? Math.round((liveMarginNet / contract.sellNetTotal) * 100)
      : null

  const certificates = listPerformanceCertificatesForProject(projectId)
  const tigGrossTotal = certificates.reduce((s, c) => s + c.grossTotal, 0)
  const tigNetTotal = certificates.reduce((s, c) => s + c.sellNetTotal, 0)
  const remainingGross = Math.max(0, contract.grossTotal - tigGrossTotal)
  const tigPercentOfContract =
    contract.grossTotal > 0 ? Math.round((tigGrossTotal / contract.grossTotal) * 100) : 0

  const contractedIds = new Set(
    contract.tradeRows.map((r) => r.quoteId)
  )

  const pendingSupplements: SupplementPendingItem[] = []
  let draftSupplementQuoteCount = 0

  for (const quote of listQuotesForProject(projectId)) {
    if (quote.status === "archived") continue
    if (contractedIds.has(quote.id)) continue
    if (quote.status !== "draft" && quote.status !== "sent") continue

    const inPackage = listCustomerPackagesForProject(projectId).find((pkg) =>
      pkg.snapshots.some((s) => s.quoteId === quote.id)
    )

    if (inPackage?.type === "supplement" || quote.title.toLowerCase().includes("pótmunka")) {
      if (quote.status === "draft") draftSupplementQuoteCount += 1
      pendingSupplements.push({
        quoteId: quote.id,
        quoteTitle: quote.title,
        packageId: inPackage?.id,
        packageTitle: inPackage?.title,
        packageStatus:
          inPackage?.status === "draft" || inPackage?.status === "sent"
            ? inPackage.status
            : undefined,
        grossTotal: inPackage?.grossTotal,
      })
    }
  }

  return {
    isExecutionPhase,
    contractGross: contract.grossTotal,
    contractSellNet: contract.sellNetTotal,
    baseGross: contract.baseGrossTotal,
    supplementGross: contract.supplementGrossTotal,
    liveCostNet,
    liveMarginNet,
    marginPercentOnContract,
    executionDone,
    executionTotal,
    executionPercent,
    tigCount: certificates.length,
    tigGrossTotal,
    tigNetTotal,
    tigCertifiedLineCount,
    eligibleTigLineCount,
    remainingGross,
    tigPercentOfContract,
    pendingSupplements,
    draftSupplementQuoteCount,
  }
}

export function buildProjectCloseReadiness(projectId: string): ProjectCloseReadiness {
  const project = getProject(projectId)
  const blockers: string[] = []
  const warnings: string[] = []

  if (!project) {
    return { canClose: false, blockers: ["A projekt nem található"], warnings: [] }
  }

  if (project.status === "done" || project.status === "archived") {
    return { canClose: false, blockers: ["A projekt már le van zárva"], warnings: [] }
  }

  if (project.status !== "won" && project.status !== "in_progress") {
    blockers.push("Csak elfogadott / kivitelezés alatti projekt zárható le")
  }

  const summary = buildExecutionSummary(projectId)

  if (summary.eligibleTigLineCount > 0) {
    warnings.push(`${summary.eligibleTigLineCount} kész tétel még nincs TIG-ben`)
  }

  if (summary.executionPercent < 100 && summary.executionTotal > 0) {
    warnings.push(`Készültség ${summary.executionPercent}% — nem minden tétel kész`)
  }

  if (summary.pendingSupplements.some((p) => p.packageStatus === "sent")) {
    warnings.push("Van elküldött, még nem elfogadott kiegészítő árajánlat")
  }

  if (summary.draftSupplementQuoteCount > 0) {
    warnings.push(`${summary.draftSupplementQuoteCount} pótmunka költségvetés még piszkozat`)
  }

  return {
    canClose: blockers.length === 0,
    warnings,
    blockers,
  }
}

export function listSupplementDraftQuotes(projectId: string): Quote[] {
  const summary = buildExecutionSummary(projectId)
  const ids = new Set(summary.pendingSupplements.map((p) => p.quoteId))
  return listQuotesForProject(projectId).filter((q) => ids.has(q.id))
}
