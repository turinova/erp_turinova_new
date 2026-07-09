import type { Project, Quote, RfqInvitation, SubcontractorRfq } from "@/types/projects"
import type { ProjectFile } from "@/types/project-files"
import type { QuoteSummary } from "@/lib/quote-summary"
import {
  buildQuoteSummary,
  getMinAcceptableMarginPercent,
  resolveActiveQuoteId,
} from "@/lib/quote-summary"
import {
  buildAggregatedVatTotals,
  buildProjectAggregatedTotals,
  buildProjectTradeOverviewRows,
  type ProjectAggregatedTotals,
  type ProjectTradeOverviewRow,
} from "@/lib/project-quote-aggregation"
import type { QuoteVatTotals } from "@/lib/quote-client-summary"
import { buildRfqDashboardStats } from "@/lib/rfq-package-utils"
import {
  getProject,
  listInvitationsForProject,
  listQuoteLines,
  listQuotesForProject,
  listRfqsForProject,
  listSubmissionsForProject,
  listRfqsForQuote,
  listSubmissionsForQuote,
  listInvitationsForQuote,
} from "@/lib/data/projects-store"
import {
  getProjectCoverFile,
  listProjectFiles,
} from "@/lib/data/project-files-store"

export type ProjectHealth = "ready" | "attention" | "blocked" | "empty"

export type OverviewAttentionItem = {
  id: string
  severity: "warning" | "error" | "info" | "success"
  message: string
  actionTab?: "overview" | "quotes" | "rfq" | "files"
}

import {
  buildDetailedProjectActivity,
  formatActivitySummary,
  type OverviewActivityItem,
} from "@/lib/project-overview-activity"

export type { OverviewActivityItem } from "@/lib/project-overview-activity"

export type ProjectOverviewSummary = {
  project: Project
  health: ProjectHealth
  healthLabel: string
  activeQuote: Quote | null
  activeSummary: QuoteSummary | null
  vatTotals: QuoteVatTotals | null
  quoteRows: { quote: Quote; summary: QuoteSummary; isActive: boolean }[]
  workingQuotes: { quote: Quote; summary: QuoteSummary; isActive: boolean }[]
  hasNewerDraftThanAccepted: boolean
  newerDraftTitle: string | null
  pricing: {
    pricedCount: number
    rfqPendingCount: number
    unpricedNotRfqCount: number
    lineCount: number
    pricedPercent: number
  }
  rfq: {
    dashboard: ReturnType<typeof buildRfqDashboardStats>
    packageCount: number
    openPackageCount: number
    invitedCount: number
    submittedCount: number
    pendingDecisionCount: number
    expiredPackageCount: number
    nearestExpiry: string | null
    awaitingNames: string[]
    submissionTotalHuf: number
    unappliedCount: number
  }
  files: {
    total: number
    sitePhotos: number
    floorPlans: number
    technical: number
    permits: number
    hasCover: boolean
    coverFile: ProjectFile | null
    lastUploadedAt: string | null
    recentFiles: ProjectFile[]
  }
  attention: OverviewAttentionItem[]
  activity: OverviewActivityItem[]
  marginTone: "success" | "warning" | "neutral"
  lastActivityLabel: string | null
  projectTotals: ProjectAggregatedTotals
  tradeRows: ProjectTradeOverviewRow[]
}

function isOpenPackage(pkg: SubcontractorRfq): boolean {
  return pkg.status === "open"
}

function resolveHealth(
  projectTotals: ProjectAggregatedTotals,
  hasQuote: boolean
): { health: ProjectHealth; healthLabel: string } {
  if (!hasQuote || (projectTotals.mode === "empty" && projectTotals.draftQuoteCount === 0)) {
    return { health: "empty", healthLabel: "Még indul" }
  }
  if (projectTotals.mode === "empty" && projectTotals.draftQuoteCount > 0) {
    return { health: "attention", healthLabel: "Folyamatban" }
  }
  if (projectTotals.canSend) {
    return { health: "ready", healthLabel: "Projekt kész" }
  }
  if (projectTotals.unpricedNotRfqCount > 0) {
    return { health: "blocked", healthLabel: "Hiányos árazás" }
  }
  return { health: "attention", healthLabel: "Folyamatban" }
}

function buildAttention(
  _project: Project,
  projectTotals: ProjectAggregatedTotals,
  rfq: ProjectOverviewSummary["rfq"],
  _files: ProjectOverviewSummary["files"],
  hasNewerDraftThanAccepted: boolean,
  newerDraftTitle: string | null
): OverviewAttentionItem[] {
  const items: OverviewAttentionItem[] = []

  if (projectTotals.lineCount === 0) {
    items.push({
      id: "no-lines",
      severity: "info",
      message: "Még nincs tétel az érvényes ajánlat(ok)ban",
      actionTab: "quotes",
    })
    return items.slice(0, 5)
  }

  if (projectTotals.selected.length === 0 && projectTotals.draftQuoteCount > 0) {
    items.push({
      id: "draft-only",
      severity: "warning",
      message: `${projectTotals.draftQuoteCount} piszkozat — állítsd „Elküldve” státuszra, ha kiment Excelben`,
      actionTab: "quotes",
    })
  }

  if (hasNewerDraftThanAccepted && newerDraftTitle) {
    items.push({
      id: "newer-draft",
      severity: "warning",
      message: `Új piszkozat: „${newerDraftTitle}”`,
      actionTab: "quotes",
    })
  }

  for (const blocker of projectTotals.blockers.slice(0, 2)) {
    items.push({
      id: `blocker-${blocker.slice(0, 24)}`,
      severity: blocker.includes("árazatlan") ? "error" : "warning",
      message: blocker,
      actionTab: blocker.includes("alvállalkozó") ? "rfq" : "quotes",
    })
  }

  for (const warning of projectTotals.warnings.slice(0, 1)) {
    items.push({
      id: `warn-${warning.slice(0, 24)}`,
      severity: "warning",
      message: warning,
      actionTab: "overview",
    })
  }

  if (rfq.pendingDecisionCount > 0) {
    items.push({
      id: "pending-decision",
      severity: "warning",
      message: `${rfq.pendingDecisionCount} bekérés döntésre vár`,
      actionTab: "rfq",
    })
  } else if (rfq.awaitingNames.length > 0) {
    items.push({
      id: "await-summary",
      severity: "warning",
      message: `Várakozás: ${rfq.awaitingNames.slice(0, 3).join(", ")}${rfq.awaitingNames.length > 3 ? "…" : ""}`,
      actionTab: "rfq",
    })
  }

  if (rfq.expiredPackageCount > 0) {
    items.push({
      id: "expired-rfq",
      severity: "error",
      message: `${rfq.expiredPackageCount} bekérés lejárt határidővel`,
      actionTab: "rfq",
    })
  }

  if (rfq.nearestExpiry) {
    const exp = new Date(rfq.nearestExpiry)
    const days = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (days >= 0 && days <= 3 && rfq.awaitingNames.length > 0) {
      items.push({
        id: "expiry-soon",
        severity: "info",
        message: `Bekérés lejár: ${exp.toLocaleDateString("hu-HU")} (${days} nap)`,
        actionTab: "rfq",
      })
    }
  }

  const seen = new Set<string>()
  return items
    .filter((item) => {
      if (seen.has(item.message)) return false
      seen.add(item.message)
      return true
    })
    .slice(0, 4)
}

function countInvitedSubmitted(invs: RfqInvitation[]): {
  invited: number
  submitted: number
  awaitingNames: string[]
} {
  let invited = 0
  let submitted = 0
  const awaitingNames: string[] = []
  for (const inv of invs) {
    if (inv.status === "invited") {
      invited++
      awaitingNames.push(inv.subcontractorName)
    }
    if (inv.status === "submitted" || inv.status === "accepted") {
      submitted++
    }
  }
  return { invited, submitted, awaitingNames }
}

export function buildProjectOverviewSummary(projectId: string): ProjectOverviewSummary | null {
  const project = getProject(projectId)
  if (!project) return null

  const allQuotes = listQuotesForProject(projectId)
  const workingQuotes = allQuotes.filter((q) => q.status !== "archived")

  const quoteRows = allQuotes.map((quote) => {
    const lines = listQuoteLines(quote.id)
    const rfqs = listRfqsForQuote(quote.id)
    const subs = listSubmissionsForQuote(quote.id)
    const invitations = listInvitationsForQuote(quote.id)
    const summary = buildQuoteSummary(quote, lines, rfqs, subs, invitations)
    return { quote, summary }
  })

  const activeQuoteId = resolveActiveQuoteId(workingQuotes)
  const activeQuote = activeQuoteId
    ? workingQuotes.find((q) => q.id === activeQuoteId) ?? null
    : workingQuotes[0] ?? null
  const activeSummary = activeQuote
    ? quoteRows.find((r) => r.quote.id === activeQuote.id)?.summary ?? null
    : null

  const acceptedQuote = workingQuotes.find((q) => q.status === "accepted")
  const newerDraft = workingQuotes.find(
    (q) =>
      q.status === "draft" &&
      acceptedQuote &&
      q.id !== acceptedQuote.id &&
      new Date(q.updatedAt) > new Date(acceptedQuote.updatedAt)
  )

  const packages = listRfqsForProject(projectId)
  const invitations = listInvitationsForProject(projectId)
  const submissions = listSubmissionsForProject(projectId)
  const dashboard = buildRfqDashboardStats(packages, invitations, submissions)

  const now = Date.now()
  let expiredPackageCount = 0
  let nearestExpiry: string | null = null
  let nearestExpiryTime = Infinity

  for (const pkg of packages.filter(isOpenPackage)) {
    const exp = new Date(pkg.expiresAt).getTime()
    if (exp < now) expiredPackageCount++
    if (exp >= now && exp < nearestExpiryTime) {
      nearestExpiryTime = exp
      nearestExpiry = pkg.expiresAt
    }
  }

  const invCounts = countInvitedSubmitted(invitations)
  const submissionTotalHuf = submissions.reduce((sum, s) => sum + (s.totalAmount ?? 0), 0)
  const projectTotals = buildProjectAggregatedTotals(projectId)
  const tradeRows = buildProjectTradeOverviewRows(projectId)

  const unappliedCount = projectTotals.selected.reduce(
    (sum, s) => sum + s.summary.unappliedSubmissionCount,
    0
  )

  const projectFiles = listProjectFiles(projectId)
  const coverFile = getProjectCoverFile(projectId)
  const recentFiles = [...projectFiles]
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .slice(0, 3)

  const files = {
    total: projectFiles.length,
    sitePhotos: projectFiles.filter((f) => f.category === "site_photo").length,
    floorPlans: projectFiles.filter((f) => f.category === "floor_plan").length,
    technical: projectFiles.filter((f) => f.category === "technical").length,
    permits: projectFiles.filter((f) => f.category === "permit").length,
    hasCover: !!coverFile,
    coverFile: coverFile ?? null,
    lastUploadedAt: recentFiles[0]?.uploadedAt ?? null,
    recentFiles,
  }

  const { health, healthLabel } = resolveHealth(projectTotals, workingQuotes.length > 0)

  const marginTone: ProjectOverviewSummary["marginTone"] =
    projectTotals.costTotal <= 0 || projectTotals.lineCount === 0
      ? "neutral"
      : projectTotals.marginPercent != null &&
          projectTotals.marginPercent >= getMinAcceptableMarginPercent()
        ? "success"
        : "warning"

  const pricing = {
    pricedCount: quoteRows
      .filter((r) => r.quote.status !== "archived" && r.quote.status !== "rejected")
      .reduce((sum, r) => sum + r.summary.pricedCount, 0),
    rfqPendingCount: quoteRows
      .filter((r) => r.quote.status !== "archived" && r.quote.status !== "rejected")
      .reduce((sum, r) => sum + r.summary.rfqPendingCount, 0),
    unpricedNotRfqCount: quoteRows
      .filter((r) => r.quote.status !== "archived" && r.quote.status !== "rejected")
      .reduce((sum, r) => sum + r.summary.unpricedNotRfqCount, 0),
    lineCount: quoteRows
      .filter((r) => r.quote.status !== "archived" && r.quote.status !== "rejected")
      .reduce((sum, r) => sum + r.summary.lineCount, 0),
    pricedPercent: 0,
  }
  pricing.pricedPercent =
    pricing.lineCount > 0 ? Math.round((pricing.pricedCount / pricing.lineCount) * 100) : 0

  const rfq = {
    dashboard,
    packageCount: packages.length,
    openPackageCount: packages.filter(isOpenPackage).length,
    invitedCount: invCounts.invited,
    submittedCount: invCounts.submitted,
    pendingDecisionCount: dashboard.pendingDecisions,
    expiredPackageCount,
    nearestExpiry,
    awaitingNames: invCounts.awaitingNames,
    submissionTotalHuf,
    unappliedCount,
  }

  const attention = buildAttention(
    project,
    projectTotals,
    rfq,
    files,
    !!newerDraft,
    newerDraft?.title ?? null
  )

  const activity = buildDetailedProjectActivity(projectId)

  let lastActivityLabel: string | null = null
  let lastActivityTime = 0
  for (const { quote, summary } of quoteRows) {
    const quoteTime = new Date(quote.updatedAt).getTime()
    if (quoteTime > lastActivityTime && summary.lastActivityLabel) {
      lastActivityTime = quoteTime
      lastActivityLabel = summary.lastActivityLabel
    }
  }
  if (activity[0]) {
    const t = new Date(activity[0].at).getTime()
    if (t >= lastActivityTime) {
      lastActivityLabel = formatActivitySummary(activity[0])
    }
  }

  const vatTotals: QuoteVatTotals | null = buildAggregatedVatTotals(projectTotals)

  return {
    project,
    health,
    healthLabel,
    activeQuote,
    activeSummary,
    vatTotals,
    quoteRows: quoteRows.map((r) => ({
      ...r,
      isActive: r.quote.id === activeQuote?.id,
    })),
    workingQuotes: quoteRows
      .filter((r) => r.quote.status !== "archived")
      .map((r) => ({ ...r, isActive: r.quote.id === activeQuote?.id })),
    hasNewerDraftThanAccepted: !!newerDraft,
    newerDraftTitle: newerDraft?.title ?? null,
    pricing,
    rfq,
    files,
    attention,
    activity,
    marginTone,
    lastActivityLabel,
    projectTotals,
    tradeRows,
  }
}
