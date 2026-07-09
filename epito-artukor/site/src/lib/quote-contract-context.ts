import type { CustomerPackageType } from "@/types/projects"
import { packageSnapshotDrift } from "@/lib/customer-package"
import { getQuote, listCustomerPackagesForProject } from "@/lib/data/projects-store"
import { buildQuoteWithSummary } from "@/lib/project-quote-aggregation"

export type QuoteContractContext = {
  isContracted: boolean
  packageId?: string
  packageTitle?: string
  packageType?: CustomerPackageType
  snapshotGross?: number
  hasDrift?: boolean
}

export function getQuoteContractContext(
  projectId: string,
  quoteId: string
): QuoteContractContext {
  const packages = listCustomerPackagesForProject(projectId).filter((p) => p.status === "accepted")

  for (const pkg of packages) {
    const snaps = pkg.acceptedSnapshots ?? pkg.snapshots
    const snap = snaps.find((s) => s.quoteId === quoteId)
    if (!snap) continue

    const quote = getQuote(quoteId)
    const hasDrift = quote
      ? packageSnapshotDrift(pkg, [buildQuoteWithSummary(quote)]).hasDrift
      : false

    return {
      isContracted: true,
      packageId: pkg.id,
      packageTitle: pkg.title,
      packageType: pkg.type,
      snapshotGross: snap.grossTotal,
      hasDrift,
    }
  }

  return { isContracted: false }
}

export function buildQuoteContractContextMap(projectId: string): Map<string, QuoteContractContext> {
  const map = new Map<string, QuoteContractContext>()
  const packages = listCustomerPackagesForProject(projectId).filter((p) => p.status === "accepted")

  for (const pkg of packages) {
    const snaps = pkg.acceptedSnapshots ?? pkg.snapshots
    for (const snap of snaps) {
      const quote = getQuote(snap.quoteId)
      const hasDrift = quote
        ? packageSnapshotDrift(pkg, [buildQuoteWithSummary(quote)]).hasDrift
        : false

      map.set(snap.quoteId, {
        isContracted: true,
        packageId: pkg.id,
        packageTitle: pkg.title,
        packageType: pkg.type,
        snapshotGross: snap.grossTotal,
        hasDrift,
      })
    }
  }

  return map
}
