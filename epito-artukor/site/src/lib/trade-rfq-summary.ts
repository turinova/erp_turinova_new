import type {
  Quote,
  QuoteLine,
  RfqInvitation,
  SubcontractorRfq,
  SubcontractorRfqSubmission,
} from "@/types/projects"
import {
  getWinningInvitationForPackage,
  packageNeedsDecision,
} from "@/lib/quote-rfq-context"
import { computePackageSubmissionTotal } from "@/lib/rfq-package-utils"
import { isLineCosted } from "@/lib/quote-pricing"
import { quoteTradeLabel } from "@/lib/quote-list-helpers"
import { formatHuf } from "@/lib/pricing"

export type RfqTodoTone = "success" | "warning" | "neutral"

export type RfqTodoAction =
  | "decide"
  | "wait"
  | "start"
  | "view"
  | "none"

export type RfqTodo = {
  label: string
  detail?: string
  tone: RfqTodoTone
  actionable: boolean
  action: RfqTodoAction
  packageId?: string
}

export type PackageSummary = {
  pkg: SubcontractorRfq
  invitations: RfqInvitation[]
  submissions: SubcontractorRfqSubmission[]
  roundIndex: number
  needsDecision: boolean
  canChangeWinner: boolean
  winningInvitation: RfqInvitation | null
  awaitingCount: number
  submittedCount: number
  isActive: boolean
}

export type TradeRfqSummary = {
  quote: Quote
  tradeLabel: string
  packages: PackageSummary[]
  activePackages: PackageSummary[]
  decidedPackages: PackageSummary[]
  todo: RfqTodo
  offerLabel: string | null
  nearestDeadline: string | null
  hasOverlapWarning: boolean
  overlappingLineLabels: string[]
}

function isActivePackage(pkg: SubcontractorRfq): boolean {
  return pkg.status === "open"
}

function buildPackageSummary(
  pkg: SubcontractorRfq,
  invitations: RfqInvitation[],
  submissions: SubcontractorRfqSubmission[],
  quoteLines: QuoteLine[],
  roundIndex: number
): PackageSummary {
  const winningInvitation = getWinningInvitationForPackage(pkg, invitations, quoteLines)
  const needsDecision = packageNeedsDecision(pkg, submissions, quoteLines)
  const canChangeWinner =
    pkg.status === "decided" && submissions.length >= 2 && winningInvitation != null

  return {
    pkg,
    invitations,
    submissions,
    roundIndex,
    needsDecision,
    canChangeWinner,
    winningInvitation,
    awaitingCount: invitations.filter((i) => i.status === "invited").length,
    submittedCount: invitations.filter(
      (i) =>
        i.status === "submitted" ||
        i.status === "accepted" ||
        submissions.some((s) => s.invitationId === i.id)
    ).length,
    isActive: isActivePackage(pkg),
  }
}

function detectOverlappingLines(
  packages: SubcontractorRfq[],
  quoteLines: QuoteLine[]
): { hasWarning: boolean; labels: string[] } {
  const openPkgs = packages.filter(isActivePackage)
  const lineToPackages = new Map<string, number>()

  for (const pkg of openPkgs) {
    for (const rfl of pkg.lines) {
      if (!rfl.quoteLineId) continue
      lineToPackages.set(rfl.quoteLineId, (lineToPackages.get(rfl.quoteLineId) ?? 0) + 1)
    }
  }

  const labels: string[] = []
  for (const [lineId, count] of lineToPackages) {
    if (count < 2) continue
    const line = quoteLines.find((l) => l.id === lineId)
    labels.push(line?.identifierSnapshot ?? line?.textSnapshot?.slice(0, 40) ?? lineId)
  }

  return { hasWarning: labels.length > 0, labels }
}

function buildOfferLabel(packages: PackageSummary[]): string | null {
  const activeNeedingDecision = packages.filter((p) => p.needsDecision && p.submissions.length > 0)
  const target =
    activeNeedingDecision[0] ?? packages.find((p) => p.isActive && p.submissions.length > 0)
  if (!target) {
    const decided = packages.find((p) => p.winningInvitation)
    if (decided?.winningInvitation) {
      const winSub = decided.submissions.find(
        (s) => s.invitationId === decided.winningInvitation?.id
      )
      if (winSub) {
        return `${decided.winningInvitation.subcontractorName} · ${formatHuf(winSub.totalAmount)}`
      }
      return decided.winningInvitation.subcontractorName
    }
    return null
  }

  const totals = target.submissions
    .map((s) => computePackageSubmissionTotal(s, target.pkg))
    .filter((t) => t > 0)
  if (totals.length === 0) return null
  const min = Math.min(...totals)
  const max = Math.max(...totals)
  if (min === max) return `${target.submissions.length} ajánlat · ${formatHuf(min)}`
  return `${target.submissions.length} ajánlat · ${formatHuf(min)} – ${formatHuf(max)}`
}

function buildTradeTodo(
  quote: Quote,
  packages: PackageSummary[],
  hasOverlap: boolean
): RfqTodo {
  const needingDecision = packages.filter((p) => p.needsDecision)
  if (needingDecision.length > 0) {
    const p = needingDecision[0]
    return {
      label: "Válaszd ki a nyertest",
      detail: `${p.submissions.length} beküldött ajánlat — ${p.pkg.title}`,
      tone: "warning",
      actionable: true,
      action: "decide",
      packageId: p.pkg.id,
    }
  }

  const waiting = packages.filter((p) => p.isActive && p.awaitingCount > 0 && p.submittedCount < p.invitations.length)
  if (waiting.length > 0) {
    const p = waiting[0]
    return {
      label: "Várj az alvállalkozókra",
      detail: `${p.awaitingCount} cég még nem válaszolt`,
      tone: "neutral",
      actionable: true,
      action: "wait",
      packageId: p.pkg.id,
    }
  }

  const activeNoSubs = packages.filter((p) => p.isActive && p.submissions.length === 0)
  if (activeNoSubs.length > 0) {
    const p = activeNoSubs[0]
    return {
      label: "Küldd ki a linkeket",
      detail: `${p.invitations.length} meghívott alvállalkozó`,
      tone: "warning",
      actionable: true,
      action: "view",
      packageId: p.pkg.id,
    }
  }

  if (packages.length === 0) {
    return {
      label: "Indíts árbekérést",
      detail: "Még nem kértél ajánlatot alvállalkozóktól",
      tone: "warning",
      actionable: true,
      action: "start",
    }
  }

  const decided = packages.filter((p) => p.pkg.status === "decided" && p.winningInvitation)
  if (decided.length > 0 && packages.every((p) => !p.isActive || p.pkg.status === "decided")) {
    const latest = decided[0]
    return {
      label: "Döntés megszületett",
      detail: latest.winningInvitation
        ? `Nyertes: ${latest.winningInvitation.subcontractorName}`
        : undefined,
      tone: "success",
      actionable: true,
      action: "view",
      packageId: latest.pkg.id,
    }
  }

  if (hasOverlap) {
    return {
      label: "Átfedő bekérések",
      detail: "Ugyanaz a tétel több nyitott bekérésben is szerepel",
      tone: "warning",
      actionable: true,
      action: "view",
      packageId: packages.find((p) => p.isActive)?.pkg.id,
    }
  }

  return {
    label: "Nincs teendő",
    detail: undefined,
    tone: "neutral",
    actionable: false,
    action: "none",
  }
}

export function buildTradeRfqSummary(
  quote: Quote,
  quoteLines: QuoteLine[],
  packages: SubcontractorRfq[],
  invitations: RfqInvitation[],
  submissions: SubcontractorRfqSubmission[]
): TradeRfqSummary {
  const quotePackages = [...packages]
    .filter((p) => p.quoteId === quote.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const totalRounds = quotePackages.length
  const packageSummaries = quotePackages.map((pkg, idx) =>
    buildPackageSummary(
      pkg,
      invitations.filter((i) => i.packageId === pkg.id),
      submissions.filter((s) => s.rfqId === pkg.id),
      quoteLines,
      totalRounds - idx
    )
  )

  const overlap = detectOverlappingLines(quotePackages, quoteLines)

  const activePackages = packageSummaries.filter((p) => p.isActive)
  const decidedPackages = packageSummaries.filter((p) => p.pkg.status === "decided")

  const deadlines = activePackages
    .map((p) => p.pkg.expiresAt)
    .filter(Boolean)
    .sort()
  const nearestDeadline = deadlines[0] ?? null

  let offerLabel = buildOfferLabel(packageSummaries)
  if (!offerLabel && decidedPackages[0]?.winningInvitation) {
    const d = decidedPackages[0]
    const sub = d.submissions.find((s) => s.invitationId === d.winningInvitation?.id)
    offerLabel = sub
      ? `${d.winningInvitation!.subcontractorName} · ${formatHuf(sub.totalAmount)}`
      : d.winningInvitation!.subcontractorName
  }

  return {
    quote,
    tradeLabel: quoteTradeLabel(quote),
    packages: packageSummaries,
    activePackages,
    decidedPackages,
    todo: buildTradeTodo(quote, packageSummaries, overlap.hasWarning),
    offerLabel,
    nearestDeadline,
    hasOverlapWarning: overlap.hasWarning,
    overlappingLineLabels: overlap.labels,
  }
}

export function buildProjectRfqStats(summaries: TradeRfqSummary[]) {
  let awaiting = 0
  let pendingDecision = 0
  let decided = 0

  for (const s of summaries) {
    for (const p of s.activePackages) {
      awaiting += p.awaitingCount
      if (p.needsDecision) pendingDecision++
    }
    decided += s.decidedPackages.length
  }

  return { awaiting, pendingDecision, decided }
}

export function linesWithManualPriceWarning(lines: QuoteLine[]): QuoteLine[] {
  return lines.filter((l) => l.costSource === "manual" && isLineCosted(l))
}
