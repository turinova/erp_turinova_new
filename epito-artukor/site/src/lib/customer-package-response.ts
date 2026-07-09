import type {
  CustomerPackage,
  CustomerPackageSnapshot,
  ProjectDataBundle,
} from "@/types/projects"
import type { CustomerPackageResponseType } from "@/lib/customer-package"

function touch<T extends { updatedAt: string }>(row: T): T {
  return { ...row, updatedAt: new Date().toISOString() }
}

export type ApplyPackageResponseInput = {
  type: CustomerPackageResponseType
  acceptedQuoteIds?: string[]
  clientNotes?: string
  respondedByName?: string
  viaLink?: boolean
}

export type ApplyPackageResponseResult =
  | { ok: true; pkg: CustomerPackage }
  | { ok: false; error: string; status: number }

export function applyCustomerPackageResponse(
  bundle: ProjectDataBundle,
  packageId: string,
  input: ApplyPackageResponseInput
): ApplyPackageResponseResult {
  const pkgIdx = bundle.customerPackages.findIndex((p) => p.id === packageId)
  if (pkgIdx < 0) return { ok: false, error: "Not found", status: 404 }

  const pkg = bundle.customerPackages[pkgIdx]
  if (pkg.status !== "sent") {
    return { ok: false, error: "Decision already recorded", status: 409 }
  }

  if (pkg.expiresAt && new Date(pkg.expiresAt) < new Date()) {
    return { ok: false, error: "Offer expired", status: 410 }
  }

  const now = new Date().toISOString()
  const snapshotQuoteIds = pkg.snapshots.map((s) => s.quoteId)

  if (input.type === "reject_all") {
    bundle.customerPackages[pkgIdx] = {
      ...pkg,
      status: "rejected",
      respondedAt: now,
      clientNotes: input.clientNotes,
      respondedByName: input.respondedByName,
    }
    for (const quoteId of snapshotQuoteIds) {
      const qIdx = bundle.quotes.findIndex((q) => q.id === quoteId)
      if (qIdx >= 0 && bundle.quotes[qIdx].status === "sent") {
        bundle.quotes[qIdx] = touch({ ...bundle.quotes[qIdx], status: "rejected" })
      }
    }
    return { ok: true, pkg: bundle.customerPackages[pkgIdx] }
  }

  const acceptedIds =
    input.type === "accept_all"
      ? snapshotQuoteIds
      : (input.acceptedQuoteIds ?? []).filter((id) => snapshotQuoteIds.includes(id))

  if (acceptedIds.length === 0) {
    return { ok: false, error: "Legalább egy szakágot ki kell választani", status: 400 }
  }

  const acceptedSnapshots: CustomerPackageSnapshot[] = pkg.snapshots.filter((s) =>
    acceptedIds.includes(s.quoteId)
  )
  const rejectedIds = snapshotQuoteIds.filter((id) => !acceptedIds.includes(id))

  // Elfogadott összegek — részlegesnél az elfogadott snapshotok összege
  // (a sellNetTotal/grossTotal a küldött teljes ajánlatot őrzi)
  const acceptedSellNetTotal = Math.round(
    acceptedSnapshots.reduce((sum, s) => sum + s.sellNetTotal, 0)
  )
  const acceptedGrossTotal = Math.round(
    acceptedSnapshots.reduce((sum, s) => sum + s.grossTotal, 0)
  )

  bundle.customerPackages[pkgIdx] = {
    ...pkg,
    status: "accepted",
    respondedAt: now,
    clientNotes: input.clientNotes,
    respondedByName: input.respondedByName,
    acceptedSnapshots,
    acceptedSellNetTotal,
    acceptedGrossTotal,
  }

  for (const quoteId of acceptedIds) {
    const qIdx = bundle.quotes.findIndex((q) => q.id === quoteId)
    if (qIdx >= 0) {
      bundle.quotes[qIdx] = touch({ ...bundle.quotes[qIdx], status: "accepted" })
    }
  }
  for (const quoteId of rejectedIds) {
    const qIdx = bundle.quotes.findIndex((q) => q.id === quoteId)
    if (qIdx >= 0 && bundle.quotes[qIdx].status === "sent") {
      bundle.quotes[qIdx] = touch({ ...bundle.quotes[qIdx], status: "rejected" })
    }
  }

  const projectIdx = bundle.projects.findIndex((p) => p.id === pkg.projectId)
  if (projectIdx >= 0) {
    const project = bundle.projects[projectIdx]
    if (project.status === "prospect" || project.status === "quoting") {
      bundle.projects[projectIdx] = touch({
        ...project,
        status: "won",
      })
    }
  }

  return { ok: true, pkg: bundle.customerPackages[pkgIdx] }
}

export function findCustomerPackageByToken(
  bundle: ProjectDataBundle,
  token: string
): CustomerPackage | undefined {
  return bundle.customerPackages.find((p) => p.accessToken === token)
}
