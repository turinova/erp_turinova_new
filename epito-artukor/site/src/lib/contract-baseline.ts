import type { CustomerPackage, CustomerPackageSnapshot, ProjectDataBundle } from "@/types/projects"
import type { Trade } from "@/types"
import { getTradeLabel } from "@/lib/trades"
import { listCustomerPackagesForProject } from "@/lib/data/projects-store"
import { bundleCustomerPackagesForProject } from "@/lib/project-bundle-queries"

export type ContractTradeRow = {
  trade: Trade
  label: string
  quoteId: string
  quoteTitle: string
  sellNetTotal: number
  grossTotal: number
  packageId: string
  packageType: CustomerPackage["type"]
  linesCount: number
}

export type ContractBaseline = {
  hasContract: boolean
  baseGrossTotal: number
  supplementGrossTotal: number
  grossTotal: number
  sellNetTotal: number
  tradeRows: ContractTradeRow[]
  packageCount: number
}

function acceptedSnapshotsFromPackage(pkg: CustomerPackage): CustomerPackageSnapshot[] {
  if (pkg.status !== "accepted") return []
  return pkg.acceptedSnapshots ?? pkg.snapshots
}

function buildContractBaselineFromPackages(
  packages: CustomerPackage[]
): ContractBaseline {
  const tradeRows: ContractTradeRow[] = []
  let baseGrossTotal = 0
  let supplementGrossTotal = 0
  let sellNetTotal = 0

  for (const pkg of packages) {
    const snaps = acceptedSnapshotsFromPackage(pkg)
    for (const snap of snaps) {
      tradeRows.push({
        trade: snap.trade,
        label: getTradeLabel(snap.trade),
        quoteId: snap.quoteId,
        quoteTitle: snap.quoteTitle,
        sellNetTotal: snap.sellNetTotal ?? 0,
        grossTotal: snap.grossTotal,
        packageId: pkg.id,
        packageType: pkg.type,
        linesCount: snap.lines?.length ?? snap.lineIds?.length ?? 0,
      })
      sellNetTotal += snap.sellNetTotal ?? 0
      if (pkg.type === "supplement") supplementGrossTotal += snap.grossTotal
      else baseGrossTotal += snap.grossTotal
    }
  }

  tradeRows.sort((a, b) => a.label.localeCompare(b.label, "hu"))

  return {
    hasContract: tradeRows.length > 0,
    baseGrossTotal,
    supplementGrossTotal,
    grossTotal: baseGrossTotal + supplementGrossTotal,
    sellNetTotal,
    tradeRows,
    packageCount: packages.length,
  }
}

export function buildContractBaseline(projectId: string): ContractBaseline {
  const packages = listCustomerPackagesForProject(projectId).filter(
    (p) => p.status === "accepted"
  )
  return buildContractBaselineFromPackages(packages)
}

export function buildContractBaselineFromBundle(
  projectId: string,
  bundle: ProjectDataBundle
): ContractBaseline {
  const packages = bundleCustomerPackagesForProject(bundle, projectId).filter(
    (p) => p.status === "accepted"
  )
  return buildContractBaselineFromPackages(packages)
}
