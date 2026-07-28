import { buildContractBaseline } from "@/lib/contract-baseline"
import { buildExecutionSummary } from "@/lib/execution-summary"
import { buildOverviewKpis, buildTradeDashboardRows } from "@/lib/project-overview-dashboard"
import {
  getProject,
  listCustomerPackagesForProject,
} from "@/lib/data/projects-store"
import { isCustomerPackageExpired } from "@/lib/customer-package"
import { formatHuf } from "@/lib/pricing"

function formatStatusGross(amount: number): string | null {
  if (amount <= 0) return null
  return `Bruttó ${formatHuf(amount)}`
}

export type ProjectStatusFacts = {
  facts: string
  grossLabel: string | null
}

/**
 * Egy mondatos projektállapot — tények, szakma nyelvén.
 * Fázis-tudatos: ajánlatkészítés vs szerződés vs kivitelezés.
 */
export function buildProjectStatusFacts(projectId: string): ProjectStatusFacts {
  const project = getProject(projectId)
  const kpis = buildOverviewKpis(projectId)
  const rows = buildTradeDashboardRows(projectId)
  const packages = listCustomerPackagesForProject(projectId)
  const contract = buildContractBaseline(projectId)
  const execution = buildExecutionSummary(projectId)

  const tradeCount = rows.length
  const lineCount = rows.reduce((s, r) => s + r.lineCount, 0)
  const pricedCount = rows.reduce((s, r) => s + r.pricedCount, 0)
  const rfqWaiting = rows.reduce((s, r) => s + r.rfqPendingCount, 0)
  const decisionPending = rows.reduce((s, r) => s + r.unappliedSubmissionCount, 0)
  const pricedPercent = lineCount > 0 ? Math.round((pricedCount / lineCount) * 100) : 0

  const sentPkg = packages.find((p) => p.status === "sent")
  const sentExpired = sentPkg ? isCustomerPackageExpired(sentPkg) : false
  const draftPkg = packages.find((p) => p.status === "draft")
  const pendingSupplements = execution.pendingSupplements ?? []

  const parts: string[] = []

  if (kpis.mode === "execution" || contract.hasContract) {
    if (project?.status === "won") {
      parts.push("Szerződés megvan — kivitelezés még nem indult")
    } else if (project?.status === "in_progress") {
      parts.push(
        `Kivitelezés · készültség ${kpis.executionPercent}% (${kpis.executionResolved}/${kpis.executionTotal})`
      )
    } else if (project?.status === "done") {
      parts.push("Projekt lezárva")
    } else {
      parts.push("Szerződésben")
    }

    if (contract.supplementGrossTotal > 0) {
      parts.push(
        `alap + pótmunka (${contract.tradeRows.filter((r) => r.packageType === "supplement").length} kiegészítő)`
      )
    } else if (contract.tradeRows.length > 0) {
      parts.push(`${contract.tradeRows.length} szerződött szakág`)
    }

    const sentPending = pendingSupplements.filter((p) => p.packageStatus === "sent")
    const draftPending = pendingSupplements.filter(
      (p) => p.packageStatus === "draft" || !p.packageId
    )
    if (sentPending.length > 0) {
      parts.push(
        sentPending.length === 1
          ? "1 pótmunka válaszra vár"
          : `${sentPending.length} pótmunka válaszra vár`
      )
    } else if (draftPending.length > 0) {
      parts.push(
        draftPending.length === 1
          ? "1 pótmunka még nincs elküldve"
          : `${draftPending.length} pótmunka még nincs elküldve`
      )
    }
  } else {
    if (tradeCount > 0) {
      parts.push(`${tradeCount} szakág`)
    }
    if (lineCount > 0) {
      parts.push(`Árazás ${pricedPercent}% (${pricedCount}/${lineCount})`)
    } else if (tradeCount > 0) {
      parts.push("Még nincs tétel")
    } else {
      parts.push("Még nincs szakág")
    }

    if (rfqWaiting > 0) {
      parts.push(`${rfqWaiting} tétel vár alvállalkozói árra`)
    }
    if (decisionPending > 0) {
      parts.push(
        decisionPending === 1
          ? "1 válasz döntésre vár"
          : `${decisionPending} válasz döntésre vár`
      )
    }

    if (sentPkg) {
      parts.push(
        sentExpired
          ? "Ügyfélajánlat lejárt — új kell"
          : "Ügyfélajánlat elküldve — válaszra vár"
      )
    } else if (draftPkg) {
      parts.push("Ügyfélajánlat piszkozat — küldésre vár")
    }
  }

  const gross = contract.hasContract
    ? contract.grossTotal
    : kpis.mode === "execution"
      ? kpis.contractGross
      : kpis.mode === "quoting"
        ? kpis.sellGross
        : 0

  return {
    facts: parts.join(" · "),
    grossLabel: formatStatusGross(gross),
  }
}
