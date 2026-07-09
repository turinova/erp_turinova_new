import type {
  CustomerPackageSnapshotLine,
  Project,
  ProjectStatus,
  Quote,
  QuoteLine,
  QuoteLineExecutionStatus,
} from "@/types/projects"
import { listCustomerPackagesForProject } from "@/lib/data/projects-store"
import {
  getLineMarkupPercent,
  isLineCosted,
  lineCostMaterialTotal,
  lineCostLaborTotal,
  lineCostTotal,
} from "@/lib/quote-pricing"
import { lineSellTotal } from "@/lib/quote-utils"

export type QuoteExecutionStats = {
  total: number
  done: number
  pending: number
  percent: number
}

export type ExecutionFilter = "all" | "pending" | "done"

const EXECUTION_PHASES: ProjectStatus[] = ["won", "in_progress"]

export function isExecutionPhaseProject(project: Project | undefined): boolean {
  return project != null && EXECUTION_PHASES.includes(project.status)
}

export function isQuoteInExecutionMode(
  quote: Quote | undefined,
  project: Project | undefined
): boolean {
  return quote?.status === "accepted" && isExecutionPhaseProject(project)
}

export function resolveLineExecutionStatus(
  line: QuoteLine
): QuoteLineExecutionStatus {
  return line.executionStatus === "done" ? "done" : "pending"
}

export function isLineExecutionDone(line: QuoteLine): boolean {
  return resolveLineExecutionStatus(line) === "done"
}

export function isLineTigCertified(line: QuoteLine): boolean {
  return Boolean(line.tigDocumentId)
}

export function isLineEligibleForTig(line: QuoteLine): boolean {
  return isLineExecutionDone(line) && !isLineTigCertified(line)
}

export function computeQuoteExecutionStats(lines: QuoteLine[]): QuoteExecutionStats {
  const total = lines.length
  const done = lines.filter(isLineExecutionDone).length
  const pending = total - done
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return { total, done, pending, percent }
}

export function filterLinesByExecution(
  lines: QuoteLine[],
  filter: ExecutionFilter
): QuoteLine[] {
  if (filter === "all") return lines
  if (filter === "done") return lines.filter(isLineExecutionDone)
  return lines.filter((line) => !isLineExecutionDone(line))
}

/** Elfogadott csomag pillanatképe — szerződött eladási ár tételenként */
export function buildContractedSellMap(
  projectId: string,
  quoteId: string
): Map<string, CustomerPackageSnapshotLine> {
  const map = new Map<string, CustomerPackageSnapshotLine>()
  const packages = listCustomerPackagesForProject(projectId).filter(
    (p) => p.status === "accepted"
  )

  for (const pkg of packages) {
    const snaps = pkg.acceptedSnapshots ?? pkg.snapshots
    const snap = snaps.find((s) => s.quoteId === quoteId)
    if (!snap?.lines) continue
    for (const line of snap.lines) {
      map.set(line.lineId, line)
    }
  }

  return map
}

export function getContractedSellTotal(
  line: QuoteLine,
  contractedMap: Map<string, CustomerPackageSnapshotLine>,
  quote: Quote
): number {
  const snap = contractedMap.get(line.id)
  if (snap) return snap.sellNetTotal
  return lineSellTotal(line, quote)
}

export function getContractedSellUnit(
  line: QuoteLine,
  contractedMap: Map<string, CustomerPackageSnapshotLine>,
  quote: Quote
): number {
  const snap = contractedMap.get(line.id)
  if (snap) return snap.sellNetUnitPrice
  const total = lineSellTotal(line, quote)
  return line.quantity > 0 ? Math.round(total / line.quantity) : total
}

export function computeProjectExecutionStats(
  linesByQuote: QuoteLine[][]
): QuoteExecutionStats {
  const all = linesByQuote.flat()
  return computeQuoteExecutionStats(all)
}

export function lineCostDisplay(line: QuoteLine): number {
  return lineCostTotal(line)
}

export type ExecutionLineFinancials = {
  cost: number
  costMaterial: number
  costLabor: number
  markupPercent: number | null
  contractedSell: number
  margin: number
  marginPercent: number | null
  hasContractedPrice: boolean
  isCosted: boolean
}

export function computeExecutionLineFinancials(
  line: QuoteLine,
  quote: Quote,
  contractedMap: Map<string, CustomerPackageSnapshotLine>
): ExecutionLineFinancials {
  const cost = lineCostTotal(line)
  const costMaterial = lineCostMaterialTotal(line)
  const costLabor = lineCostLaborTotal(line)
  const contractedSell = getContractedSellTotal(line, contractedMap, quote)
  const hasContractedPrice = contractedMap.has(line.id)
  const isCosted = isLineCosted(line)
  const margin = isCosted && contractedSell > 0 ? contractedSell - cost : 0
  const markupPercent =
    isCosted && cost > 0 ? Math.round((margin / cost) * 100) : null

  return {
    cost,
    costMaterial,
    costLabor,
    markupPercent: isCosted ? getLineMarkupPercent(line, quote) : null,
    contractedSell,
    margin,
    marginPercent: markupPercent,
    hasContractedPrice,
    isCosted,
  }
}

export type ExecutionFinancialTotals = {
  cost: number
  costMaterial: number
  costLabor: number
  contractedSell: number
  margin: number
  marginPercent: number | null
}

export function computeExecutionFinancialTotals(
  lines: QuoteLine[],
  quote: Quote,
  contractedMap: Map<string, CustomerPackageSnapshotLine>
): ExecutionFinancialTotals {
  let cost = 0
  let costMaterial = 0
  let costLabor = 0
  let contractedSell = 0

  for (const line of lines) {
    const fin = computeExecutionLineFinancials(line, quote, contractedMap)
    cost += fin.cost
    costMaterial += fin.costMaterial
    costLabor += fin.costLabor
    contractedSell += fin.contractedSell
  }

  const margin = contractedSell - cost
  const marginPercent = cost > 0 ? Math.round((margin / cost) * 100) : null

  return { cost, costMaterial, costLabor, contractedSell, margin, marginPercent }
}
