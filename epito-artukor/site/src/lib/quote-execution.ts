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
  skipped: number
  /** Kész + nem kell — lezárt tételek */
  resolved: number
  /** resolved / total */
  percent: number
}

export type ExecutionFilter = "all" | "pending" | "done" | "skipped"

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
  if (line.executionStatus === "done") return "done"
  if (line.executionStatus === "skipped") return "skipped"
  return "pending"
}

export function isLineExecutionDone(line: QuoteLine): boolean {
  return resolveLineExecutionStatus(line) === "done"
}

export function isLineExecutionSkipped(line: QuoteLine): boolean {
  return resolveLineExecutionStatus(line) === "skipped"
}

/** Kész VAGY nem kell — a készültség %-hoz lezárt */
export function isLineExecutionResolved(line: QuoteLine): boolean {
  const s = resolveLineExecutionStatus(line)
  return s === "done" || s === "skipped"
}

export function isLineTigCertified(line: QuoteLine): boolean {
  return Boolean(line.tigDocumentId)
}

/** TIG-be csak „kész” tétel mehet — „nem kell” soha */
export function isLineEligibleForTig(line: QuoteLine): boolean {
  return isLineExecutionDone(line) && !isLineTigCertified(line)
}

export function computeQuoteExecutionStats(lines: QuoteLine[]): QuoteExecutionStats {
  const total = lines.length
  let done = 0
  let skipped = 0
  let pending = 0
  for (const line of lines) {
    const s = resolveLineExecutionStatus(line)
    if (s === "done") done += 1
    else if (s === "skipped") skipped += 1
    else pending += 1
  }
  const resolved = done + skipped
  const percent = total > 0 ? Math.round((resolved / total) * 100) : 0
  return { total, done, pending, skipped, resolved, percent }
}

export function filterLinesByExecution(
  lines: QuoteLine[],
  filter: ExecutionFilter
): QuoteLine[] {
  if (filter === "all") return lines
  if (filter === "done") return lines.filter(isLineExecutionDone)
  if (filter === "skipped") return lines.filter(isLineExecutionSkipped)
  return lines.filter((line) => resolveLineExecutionStatus(line) === "pending")
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
