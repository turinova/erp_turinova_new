import type {
  Project,
  ProjectDataBundle,
  Quote,
  QuoteLine,
  RfqInvitation,
  SubcontractorRfq,
  SubcontractorRfqSubmission,
} from "@/types/projects"

/** Bundle-alapú lekérdezések — store és szerver summary közös logikája. */

export function bundleQuotesForProject(bundle: ProjectDataBundle, projectId: string): Quote[] {
  return bundle.quotes.filter((q) => q.projectId === projectId)
}

export function bundleQuoteLines(bundle: ProjectDataBundle, quoteId: string): QuoteLine[] {
  return bundle.quoteLines
    .filter((l) => l.quoteId === quoteId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function bundleRfqsForQuote(bundle: ProjectDataBundle, quoteId: string): SubcontractorRfq[] {
  const quote = bundle.quotes.find((q) => q.id === quoteId)
  if (!quote) return []
  return bundle.rfqs.filter((r) => r.quoteId === quoteId)
}

export function bundleSubmissionsForQuote(
  bundle: ProjectDataBundle,
  quoteId: string
): SubcontractorRfqSubmission[] {
  const rfqIds = new Set(bundleRfqsForQuote(bundle, quoteId).map((r) => r.id))
  return bundle.submissions.filter((s) => rfqIds.has(s.rfqId))
}

export function bundleInvitationsForQuote(
  bundle: ProjectDataBundle,
  quoteId: string
): RfqInvitation[] {
  const rfqIds = new Set(bundleRfqsForQuote(bundle, quoteId).map((r) => r.id))
  return bundle.rfqInvitations.filter((i) => rfqIds.has(i.packageId))
}

export function bundleInvitationsForPackage(
  bundle: ProjectDataBundle,
  packageId: string
): RfqInvitation[] {
  return bundle.rfqInvitations.filter((i) => i.packageId === packageId)
}

export function bundleSubmissionsForPackage(
  bundle: ProjectDataBundle,
  packageId: string
): SubcontractorRfqSubmission[] {
  return bundle.submissions.filter((s) => s.rfqId === packageId)
}

export function bundleRfqsForProject(bundle: ProjectDataBundle, projectId: string): SubcontractorRfq[] {
  return bundle.rfqs.filter((r) => r.projectId === projectId)
}

export function bundleCustomerPackagesForProject(
  bundle: ProjectDataBundle,
  projectId: string
) {
  return bundle.customerPackages.filter((p) => p.projectId === projectId)
}

export function bundlePerformanceCertificatesForProject(
  bundle: ProjectDataBundle,
  projectId: string
) {
  return (bundle.performanceCertificates ?? []).filter((p) => p.projectId === projectId)
}

export function bundleCompositionForProject(bundle: ProjectDataBundle, projectId: string) {
  return bundle.compositions.find((c) => c.projectId === projectId)
}

export function bundleAuditForProject(bundle: ProjectDataBundle, projectId: string) {
  return (bundle.auditLog ?? []).filter((a) => a.projectId === projectId)
}

/** Egy projekt rész-bundle kivágása a teljes bundle-ből. */
export function sliceBundleForProject(
  bundle: ProjectDataBundle,
  projectId: string
): ProjectDataBundle {
  const project = bundle.projects.find((p) => p.id === projectId)
  if (!project) {
    throw new Error("A projekt nem található a bundle-ben.")
  }

  const quoteIds = new Set(bundleQuotesForProject(bundle, projectId).map((q) => q.id))
  const rfqIds = new Set(bundleRfqsForProject(bundle, projectId).map((r) => r.id))

  return {
    projects: [project],
    quotes: bundle.quotes.filter((q) => quoteIds.has(q.id)),
    quoteLines: bundle.quoteLines.filter((l) => quoteIds.has(l.quoteId)),
    rfqs: bundle.rfqs.filter((r) => rfqIds.has(r.id)),
    rfqCampaigns: (bundle.rfqCampaigns ?? []).filter((c) => c.projectId === projectId),
    rfqInvitations: bundle.rfqInvitations.filter((i) => rfqIds.has(i.packageId)),
    submissions: bundle.submissions.filter((s) => rfqIds.has(s.rfqId)),
    rfqDecisionLogs: bundle.rfqDecisionLogs.filter((d) => rfqIds.has(d.packageId)),
    auditLog: bundleAuditForProject(bundle, projectId),
    compositions: bundle.compositions.filter((c) => c.projectId === projectId),
    customerPackages: bundleCustomerPackagesForProject(bundle, projectId),
    performanceCertificates: bundlePerformanceCertificatesForProject(bundle, projectId),
  }
}

/** Üres bundle skeleton — summary mód induláshoz. */
export function emptyBundleSkeleton(projects: Project[]): ProjectDataBundle {
  return {
    projects,
    quotes: [],
    quoteLines: [],
    rfqs: [],
    rfqCampaigns: [],
    rfqInvitations: [],
    submissions: [],
    rfqDecisionLogs: [],
    auditLog: [],
    compositions: [],
    customerPackages: [],
    performanceCertificates: [],
  }
}
