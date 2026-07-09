import type { CostItem } from "@/types"
import type {
  Project,
  ProjectAuditEntry,
  ProjectDataBundle,
  CompositionSelection,
  CustomerPackage,
  CustomerPackageStatus,
  CustomerPackageType,
  PerformanceCertificate,
  ProjectComposition,
  Quote,
  QuoteLine,
  RfqCampaign,
  RfqDecisionLogEntry,
  RfqInvitation,
  SubcontractorRfq,
  SubcontractorRfqSubmission,
} from "@/types/projects"
import type { Trade } from "@/types"
import { getQuoteDisplayIdentifier } from "@/lib/item-identifier"
import { normalizeProjectBundle } from "@/lib/quote-migration"
import { isLineCosted, quoteCostTotals, quoteSellTotals } from "@/lib/quote-pricing"
import { loadCostItems } from "@/lib/data/cost-items-store"
import {
  buildPackagePreviewFromQuoteIds,
  type CustomerPackageResponseType,
} from "@/lib/customer-package"
import { applyCustomerPackageResponse } from "@/lib/customer-package-response"
import {
  buildQuoteWithSummary,
  type QuoteWithSummary,
} from "@/lib/project-quote-aggregation"
import {
  generateAccessCode,
  generateAccessToken,
} from "@/lib/quote-utils"
import { computeSubmissionTotal } from "@/lib/rfq-migration"
import { getTradeLabel } from "@/lib/trades"
import { getDefaultVatMode } from "@/lib/organization-profile"
import { getCurrentUser } from "@/lib/current-user"
import {
  buildOfferDefaultNotesText,
  getDefaultTradeMarkups,
  getOfferValidityDays,
  getRfqDefaultValidityDays,
} from "@/lib/app-settings"
import {
  buildTigPreviewModel,
  formatTigDocumentNumber,
  tigPreviewToCertificate,
} from "@/lib/tig-preview-build"

/**
 * A Supabase az egyetlen forrás. A kliens oldalon egy in-memory cache él,
 * amelyet a `syncBundleFromServer()` tölt fel (a projekt-oldalak a
 * `useProjectsBundleReady` hookon át hívják), minden mutáció pedig a teljes
 * bundle-t visszaszinkronizálja a szerverre (diff-alapú DB-írás).
 */
let bundleCache: ProjectDataBundle | null = null

function emptyBundle(): ProjectDataBundle {
  return {
    projects: [],
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

function newId(): string {
  // A DB uuid PK-t vár — a prefix csak az olvashatóságot szolgálta, megszűnt
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`
}

function loadBundle(): ProjectDataBundle {
  return bundleCache ?? emptyBundle()
}

function saveBundle(bundle: ProjectDataBundle): void {
  const normalized = normalizeProjectBundle(bundle)
  bundleCache = normalized
  void fetch("/api/projects-bundle", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalized),
  }).catch(() => {
    /* offline */
  })
}

function touch<T extends { updatedAt: string }>(row: T): T {
  return { ...row, updatedAt: new Date().toISOString() }
}

function recordAudit(
  bundle: ProjectDataBundle,
  projectId: string,
  entry: Omit<
    ProjectAuditEntry,
    "id" | "projectId" | "at" | "actorUserId" | "actorEmail" | "actorName"
  >
): void {
  const user = getCurrentUser()
  if (!bundle.auditLog) bundle.auditLog = []
  bundle.auditLog.push({
    ...entry,
    id: newId(),
    projectId,
    actorUserId: user.id,
    actorEmail: user.email,
    actorName: user.displayName,
    at: new Date().toISOString(),
  })
}

export function listAuditForProject(projectId: string): ProjectAuditEntry[] {
  return (loadBundle().auditLog ?? [])
    .filter((a) => a.projectId === projectId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

export function recordProjectAudit(
  projectId: string,
  entry: Omit<
    ProjectAuditEntry,
    "id" | "projectId" | "at" | "actorUserId" | "actorEmail" | "actorName"
  >
): void {
  const bundle = loadBundle()
  recordAudit(bundle, projectId, entry)
  saveBundle(bundle)
}

function currentDecisionActor(): Pick<
  RfqDecisionLogEntry,
  "decidedByUserId" | "decidedByEmail" | "decidedByName"
> {
  const user = getCurrentUser()
  return {
    decidedByUserId: user.id,
    decidedByEmail: user.email,
    decidedByName: user.displayName,
  }
}

// ——— Projects ———

export function listProjects(): Project[] {
  return loadBundle().projects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export function getProject(id: string): Project | undefined {
  return loadBundle().projects.find((p) => p.id === id)
}

export function createProject(
  input: Omit<Project, "id" | "orgId" | "createdAt" | "updatedAt"> & { orgId?: string }
): Project {
  const bundle = loadBundle()
  const now = new Date().toISOString()
  const project: Project = {
    id: newId(),
    orgId: input.orgId ?? "org-1",
    code: input.code,
    name: input.name,
    clientId: input.clientId,
    clientName: input.clientName,
    siteAddress: input.siteAddress,
    description: input.description,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  }
  bundle.projects.push(project)
  recordAudit(bundle, project.id, {
    kind: "project",
    action: "Projekt létrehozva",
    context: project.code,
  })
  saveBundle(bundle)
  return project
}

export function updateProject(id: string, patch: Partial<Project>): Project | undefined {
  const bundle = loadBundle()
  const idx = bundle.projects.findIndex((p) => p.id === id)
  if (idx < 0) return undefined
  bundle.projects[idx] = touch({ ...bundle.projects[idx], ...patch, id })
  recordAudit(bundle, id, {
    kind: "project",
    action: "Projekt adatok módosítva",
    context: bundle.projects[idx].code,
  })
  saveBundle(bundle)
  return bundle.projects[idx]
}

// ——— Quotes ———

export function listQuotesForProject(projectId: string): Quote[] {
  return loadBundle()
    .quotes.filter((q) => q.projectId === projectId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getQuote(id: string): Quote | undefined {
  return loadBundle().quotes.find((q) => q.id === id)
}

export function createQuote(
  projectId: string,
  title: string,
  options: {
    primaryTrade: Trade
    supersedesQuoteId?: string
  }
): Quote {
  const bundle = loadBundle()
  const now = new Date().toISOString()
  const isVersion = !!options.supersedesQuoteId
  const quote: Quote = {
    id: newId(),
    projectId,
    title,
    status: "draft",
    version: 1,
    notes: "",
    quoteScope: isVersion ? "version" : "trade",
    primaryTrade: options.primaryTrade,
    supersedesQuoteId: options.supersedesQuoteId,
    tradeMarkups: { ...getDefaultTradeMarkups() },
    vatMode: getDefaultVatMode(),
    createdAt: now,
    updatedAt: now,
  }
  bundle.quotes.push(quote)
  recordAudit(bundle, projectId, {
    kind: "quote",
    action: "Költségvetés létrehozva",
    context: [title, getTradeLabel(options.primaryTrade)].filter(Boolean).join(" · "),
  })
  saveBundle(bundle)
  return quote
}

export function duplicateQuote(sourceQuoteId: string): Quote | undefined {
  const bundle = loadBundle()
  const source = bundle.quotes.find((q) => q.id === sourceQuoteId)
  if (!source) return undefined

  const now = new Date().toISOString()
  const newQuoteId = newId()
  const projectQuotes = bundle.quotes.filter((q) => q.projectId === source.projectId)
  const nextVersion =
    Math.max(source.version, ...projectQuotes.map((q) => q.version), 0) + 1

  const newQuote: Quote = {
    ...source,
    id: newQuoteId,
    title: `${source.title.replace(/\s*\(v\d+\)\s*$/, "")} (v${nextVersion})`,
    status: "draft",
    version: nextVersion,
    quoteScope: "version",
    supersedesQuoteId: sourceQuoteId,
    createdAt: now,
    updatedAt: now,
  }

  for (const line of bundle.quoteLines.filter((l) => l.quoteId === sourceQuoteId)) {
    const copied: QuoteLine = {
      ...line,
      id: newId(),
      quoteId: newQuoteId,
      costSourceSubcontractor: null,
      costSourceRfqSubmissionId: null,
      executionStatus: undefined,
    }
    if (copied.pricingStatus === "rfq_pending") {
      copied.pricingStatus = "unpriced"
      copied.costSource = "unpriced"
    } else if (copied.costSource === "subcontractor") {
      copied.costSource = copied.costLaborUnitPrice > 0 || copied.costMaterialUnitPrice > 0
        ? "manual"
        : "unpriced"
      if (!isLineCosted(copied)) copied.pricingStatus = "unpriced"
    }
    bundle.quoteLines.push(copied)
  }

  bundle.quotes.push(newQuote)
  recordAudit(bundle, source.projectId, {
    kind: "quote",
    action: "Költségvetés másolva",
    context: newQuote.title,
  })
  saveBundle(bundle)
  return newQuote
}

export function deleteQuote(quoteId: string): boolean {
  const bundle = loadBundle()
  const hasRfqs = bundle.rfqs.some((r) => r.quoteId === quoteId)
  if (hasRfqs) return false

  const quoteIdx = bundle.quotes.findIndex((q) => q.id === quoteId)
  if (quoteIdx < 0) return false

  bundle.quotes.splice(quoteIdx, 1)
  bundle.quoteLines = bundle.quoteLines.filter((l) => l.quoteId !== quoteId)
  saveBundle(bundle)
  return true
}

export function archiveQuote(quoteId: string): Quote | undefined {
  return updateQuote(quoteId, { status: "archived" })
}

export function isQuoteLocked(quoteId: string): boolean {
  const quote = getQuote(quoteId)
  // Puha lock: elfogadott költségvetés szerkeszthető (bekerülés-követés), csak archivált zárt.
  return quote?.status === "archived"
}

function assertQuoteEditable(quoteId: string): boolean {
  if (isQuoteLocked(quoteId)) return false
  return true
}

export function updateQuote(id: string, patch: Partial<Quote>): Quote | undefined {
  if (
    isQuoteLocked(id) &&
    patch.status !== "archived" &&
    patch.status !== "rejected" &&
    patch.status !== undefined
  ) {
    return undefined
  }

  const bundle = loadBundle()
  const idx = bundle.quotes.findIndex((q) => q.id === id)
  if (idx < 0) return undefined
  bundle.quotes[idx] = touch({ ...bundle.quotes[idx], ...patch, id })
  const quote = bundle.quotes[idx]
  recordAudit(bundle, quote.projectId, {
    kind: "quote",
    action: patch.status === "archived" ? "Költségvetés archiválva" : "Költségvetés módosítva",
    context: [
      quote.title,
      quote.primaryTrade ? getTradeLabel(quote.primaryTrade) : null,
    ]
      .filter(Boolean)
      .join(" · "),
  })
  saveBundle(bundle)
  return quote
}

export function updateQuoteTradeMarkup(
  quoteId: string,
  trade: Trade,
  markupPercent: number
): Quote | undefined {
  const bundle = loadBundle()
  const idx = bundle.quotes.findIndex((q) => q.id === quoteId)
  if (idx < 0) return undefined
  const quote = bundle.quotes[idx]
  bundle.quotes[idx] = touch({
    ...quote,
    tradeMarkups: { ...quote.tradeMarkups, [trade]: markupPercent },
  })
  saveBundle(bundle)
  return bundle.quotes[idx]
}

/** Szakági fedezet explicit beállítása minden tételsoron */
export function applyMarkupToTradeLines(
  quoteId: string,
  trade: Trade,
  markupPercent: number
): number {
  const bundle = loadBundle()
  let updated = 0
  for (const line of bundle.quoteLines) {
    if (line.quoteId !== quoteId || line.trade !== trade) continue
    line.markupPercent = markupPercent
    updated += 1
  }
  if (updated > 0) {
    const qIdx = bundle.quotes.findIndex((q) => q.id === quoteId)
    if (qIdx >= 0) bundle.quotes[qIdx] = touch(bundle.quotes[qIdx])
    saveBundle(bundle)
  }
  return updated
}

/** Tételek visszaállítása szakági alap fedezetre (öröklés) */
export function clearLineMarkupsForTrade(quoteId: string, trade: Trade): number {
  const bundle = loadBundle()
  let updated = 0
  for (const line of bundle.quoteLines) {
    if (line.quoteId !== quoteId || line.trade !== trade) continue
    if (line.markupPercent != null) {
      line.markupPercent = null
      updated += 1
    }
  }
  if (updated > 0) {
    const qIdx = bundle.quotes.findIndex((q) => q.id === quoteId)
    if (qIdx >= 0) bundle.quotes[qIdx] = touch(bundle.quotes[qIdx])
    saveBundle(bundle)
  }
  return updated
}

// ——— Quote lines ———

export function listQuoteLines(quoteId: string): QuoteLine[] {
  return loadBundle()
    .quoteLines.filter((l) => l.quoteId === quoteId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Árazatlan tétel az ártükörből — csak szöveg + mennyiség, ár később */
export function addQuoteLineFromCostItem(quoteId: string, item: CostItem): QuoteLine {
  if (!assertQuoteEditable(quoteId)) throw new Error("Az archivált költségvetés nem szerkeszthető")
  const bundle = loadBundle()
  const quote = bundle.quotes.find((q) => q.id === quoteId)
  if (!quote) throw new Error("Az árajánlat nem található")
  if (quote.primaryTrade && item.trade !== quote.primaryTrade) {
    throw new Error(
      `Ez az ajánlat csak a(z) ${getTradeLabel(quote.primaryTrade)} szakágra vonatkozik`
    )
  }
  const existing = bundle.quoteLines.filter((l) => l.quoteId === quoteId)
  const line: QuoteLine = {
    id: newId(),
    quoteId,
    sortOrder: existing.length + 1,
    costItemId: item.id,
    identifierSnapshot: getQuoteDisplayIdentifier(item),
    textSnapshot: item.text,
    trade: item.trade,
    unitId: item.unitId,
    quantity: 1,
    costMaterialUnitPrice: 0,
    costLaborUnitPrice: 0,
    markupPercent: null,
    costSource: "unpriced",
    costSourceSubcontractor: null,
    costSourceRfqSubmissionId: null,
    pricingStatus: "unpriced",
  }
  bundle.quoteLines.push(line)
  const qIdx = bundle.quotes.findIndex((q) => q.id === quoteId)
  if (qIdx >= 0) bundle.quotes[qIdx] = touch(bundle.quotes[qIdx])
  saveBundle(bundle)
  return line
}

/** Szabad tétel — nincs ártükör-hivatkozás, a szakág a költségvetés szakága */
export function addManualQuoteLine(
  quoteId: string,
  input: { text: string; unitId: string; quantity?: number }
): QuoteLine {
  if (!assertQuoteEditable(quoteId)) throw new Error("Az archivált költségvetés nem szerkeszthető")
  const bundle = loadBundle()
  const quote = bundle.quotes.find((q) => q.id === quoteId)
  if (!quote) throw new Error("Az árajánlat nem található")
  const text = input.text.trim()
  if (!text) throw new Error("Add meg a tétel leírását")
  if (!quote.primaryTrade) throw new Error("A költségvetésnek nincs szakága")

  const existing = bundle.quoteLines.filter((l) => l.quoteId === quoteId)
  const line: QuoteLine = {
    id: newId(),
    quoteId,
    sortOrder: existing.length + 1,
    costItemId: null,
    identifierSnapshot: "EGYEDI",
    textSnapshot: text,
    trade: quote.primaryTrade,
    unitId: input.unitId,
    quantity: input.quantity ?? 1,
    costMaterialUnitPrice: 0,
    costLaborUnitPrice: 0,
    markupPercent: null,
    costSource: "unpriced",
    costSourceSubcontractor: null,
    costSourceRfqSubmissionId: null,
    pricingStatus: "unpriced",
  }
  bundle.quoteLines.push(line)
  const qIdx = bundle.quotes.findIndex((q) => q.id === quoteId)
  if (qIdx >= 0) bundle.quotes[qIdx] = touch(bundle.quotes[qIdx])
  saveBundle(bundle)
  return line
}

export function updateQuoteLine(id: string, patch: Partial<QuoteLine>): QuoteLine | undefined {
  const bundle = loadBundle()
  const idx = bundle.quoteLines.findIndex((l) => l.id === id)
  if (idx < 0) return undefined
  const prev = bundle.quoteLines[idx]
  if (!assertQuoteEditable(prev.quoteId)) return undefined
  const next = { ...prev, ...patch, id }

  if (
    patch.costMaterialUnitPrice !== undefined ||
    patch.costLaborUnitPrice !== undefined
  ) {
    const hasCost = next.costMaterialUnitPrice > 0 || next.costLaborUnitPrice > 0
    if (hasCost && next.costSource === "unpriced") {
      next.costSource = "manual"
      next.pricingStatus = "estimated"
    }
    if (!hasCost) {
      next.costSource = "unpriced"
      next.pricingStatus = "unpriced"
      next.costSourceSubcontractor = null
      next.costSourceRfqSubmissionId = null
    }
  }

  bundle.quoteLines[idx] = next
  const quoteId = next.quoteId
  const qIdx = bundle.quotes.findIndex((q) => q.id === quoteId)
  if (qIdx >= 0) bundle.quotes[qIdx] = touch(bundle.quotes[qIdx])
  saveBundle(bundle)
  return bundle.quoteLines[idx]
}

export function setQuoteLineExecutionStatus(
  lineId: string,
  status: "pending" | "done"
): QuoteLine | undefined {
  return updateQuoteLine(lineId, { executionStatus: status })
}

export function toggleQuoteLineExecution(lineId: string): QuoteLine | undefined {
  const bundle = loadBundle()
  const line = bundle.quoteLines.find((l) => l.id === lineId)
  if (!line) return undefined
  if (line.tigDocumentId) return line
  const next = line.executionStatus === "done" ? "pending" : "done"
  return setQuoteLineExecutionStatus(lineId, next)
}

export function setAllQuoteLinesExecution(
  quoteId: string,
  status: "pending" | "done",
  trade?: Trade
): number {
  const bundle = loadBundle()
  if (!assertQuoteEditable(quoteId)) return 0
  let updated = 0
  for (const line of bundle.quoteLines) {
    if (line.quoteId !== quoteId) continue
    if (trade != null && line.trade !== trade) continue
    // TIG-ben rögzített tétel készültsége nem módosítható bulkban sem
    if (line.tigDocumentId) continue
    const prev = line.executionStatus === "done" ? "done" : "pending"
    if (prev === status) continue
    line.executionStatus = status
    updated += 1
  }
  if (updated > 0) {
    const qIdx = bundle.quotes.findIndex((q) => q.id === quoteId)
    if (qIdx >= 0) bundle.quotes[qIdx] = touch(bundle.quotes[qIdx])
    saveBundle(bundle)
  }
  return updated
}

/** Alvállalkozói forrás → saját kivitelezés / kézi ár (ár megmarad) */
export function convertQuoteLineToManualCost(lineId: string): QuoteLine | undefined {
  const bundle = loadBundle()
  const idx = bundle.quoteLines.findIndex((l) => l.id === lineId)
  if (idx < 0) return undefined
  const prev = bundle.quoteLines[idx]
  const hasCost = isLineCosted(prev)
  bundle.quoteLines[idx] = {
    ...prev,
    costSource: "manual",
    costSourceSubcontractor: null,
    costSourceRfqSubmissionId: null,
    pricingStatus: hasCost
      ? "costed"
      : prev.pricingStatus === "rfq_pending"
        ? "unpriced"
        : prev.pricingStatus,
  }
  const qIdx = bundle.quotes.findIndex((q) => q.id === prev.quoteId)
  if (qIdx >= 0) bundle.quotes[qIdx] = touch(bundle.quotes[qIdx])
  saveBundle(bundle)
  return bundle.quoteLines[idx]
}

export function applyCatalogPricesToLine(
  lineId: string,
  material: number,
  labor: number
): QuoteLine | undefined {
  return updateQuoteLine(lineId, {
    costMaterialUnitPrice: material,
    costLaborUnitPrice: labor,
    costSource: "catalog",
    costSourceSubcontractor: null,
    costSourceRfqSubmissionId: null,
    pricingStatus: "estimated",
  })
}

/** Árazatlan tételek kitöltése az ártükörből (opcionális szakág szűrő) */
export function applyCatalogToUnpricedLines(quoteId: string, trade?: Trade): number {
  const bundle = loadBundle()
  const items = loadCostItems()
  let updated = 0

  for (const line of bundle.quoteLines) {
    if (line.quoteId !== quoteId) continue
    if (trade && line.trade !== trade) continue
    if (!line.costItemId) continue
    if (line.costMaterialUnitPrice > 0 || line.costLaborUnitPrice > 0) continue

    const item = items.find((c) => c.id === line.costItemId)
    if (!item) continue

    const idx = bundle.quoteLines.findIndex((l) => l.id === line.id)
    if (idx < 0) continue
    bundle.quoteLines[idx] = {
      ...bundle.quoteLines[idx],
      costMaterialUnitPrice: item.materialUnitPrice,
      costLaborUnitPrice: item.laborUnitPrice,
      costSource: "catalog",
      costSourceSubcontractor: null,
      costSourceRfqSubmissionId: null,
      pricingStatus: "estimated",
    }
    updated += 1
  }

  if (updated > 0) {
    const qIdx = bundle.quotes.findIndex((q) => q.id === quoteId)
    if (qIdx >= 0) bundle.quotes[qIdx] = touch(bundle.quotes[qIdx])
    saveBundle(bundle)
  }
  return updated
}

export function deleteQuoteLine(id: string): void {
  const bundle = loadBundle()
  const line = bundle.quoteLines.find((l) => l.id === id)
  if (line && !assertQuoteEditable(line.quoteId)) return
  bundle.quoteLines = bundle.quoteLines.filter((l) => l.id !== id)
  if (line) {
    const rest = bundle.quoteLines
      .filter((l) => l.quoteId === line.quoteId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    rest.forEach((l, i) => {
      l.sortOrder = i + 1
    })
    const qIdx = bundle.quotes.findIndex((q) => q.id === line.quoteId)
    if (qIdx >= 0) bundle.quotes[qIdx] = touch(bundle.quotes[qIdx])
  }
  saveBundle(bundle)
}

// ——— RFQ (csomag + meghívások) ———

export function listRfqsForProject(projectId: string): SubcontractorRfq[] {
  return loadBundle()
    .rfqs.filter((r) => r.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function listRfqsForQuote(quoteId: string): SubcontractorRfq[] {
  return loadBundle()
    .rfqs.filter((r) => r.quoteId === quoteId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getRfq(id: string): SubcontractorRfq | undefined {
  return loadBundle().rfqs.find((r) => r.id === id)
}

export function listInvitationsForPackage(packageId: string): RfqInvitation[] {
  return loadBundle().rfqInvitations.filter((i) => i.packageId === packageId)
}

export function listInvitationsForProject(projectId: string): RfqInvitation[] {
  const bundle = loadBundle()
  const pkgIds = new Set(bundle.rfqs.filter((r) => r.projectId === projectId).map((r) => r.id))
  return bundle.rfqInvitations.filter((i) => pkgIds.has(i.packageId))
}

export function getInvitation(id: string): RfqInvitation | undefined {
  return loadBundle().rfqInvitations.find((i) => i.id === id)
}

export function getInvitationByToken(token: string): RfqInvitation | undefined {
  return loadBundle().rfqInvitations.find((i) => i.accessToken === token)
}

/** @deprecated token a meghíváson van */
export function getRfqByToken(token: string): SubcontractorRfq | undefined {
  const inv = getInvitationByToken(token)
  if (!inv) return undefined
  return getRfq(inv.packageId)
}

export function getRfqPackageByToken(token: string): {
  invitation: RfqInvitation
  pkg: SubcontractorRfq
} | null {
  const invitation = getInvitationByToken(token)
  if (!invitation) return null
  const pkg = getRfq(invitation.packageId)
  if (!pkg) return null
  return { invitation, pkg }
}

export function listSubmissionsForPackage(packageId: string): SubcontractorRfqSubmission[] {
  return loadBundle()
    .submissions.filter((s) => s.rfqId === packageId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function listSubmissionsForRfq(rfqId: string): SubcontractorRfqSubmission[] {
  return listSubmissionsForPackage(rfqId)
}

export function listSubmissionsForProject(projectId: string): SubcontractorRfqSubmission[] {
  const bundle = loadBundle()
  const rfqIds = new Set(bundle.rfqs.filter((r) => r.projectId === projectId).map((r) => r.id))
  return bundle.submissions
    .filter((s) => rfqIds.has(s.rfqId))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function listSubmissionsForQuote(quoteId: string): SubcontractorRfqSubmission[] {
  const bundle = loadBundle()
  const rfqIds = new Set(bundle.rfqs.filter((r) => r.quoteId === quoteId).map((r) => r.id))
  return bundle.submissions.filter((s) => rfqIds.has(s.rfqId))
}

export function listDecisionLogsForPackage(packageId: string): RfqDecisionLogEntry[] {
  return loadBundle()
    .rfqDecisionLogs.filter((l) => l.packageId === packageId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function listDecisionLogsForQuote(quoteId: string): RfqDecisionLogEntry[] {
  return loadBundle()
    .rfqDecisionLogs.filter((l) => l.quoteId === quoteId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function listDecisionLogsForProject(projectId: string): RfqDecisionLogEntry[] {
  const bundle = loadBundle()
  const pkgIds = new Set(
    bundle.rfqs.filter((r) => r.projectId === projectId).map((r) => r.id)
  )
  return bundle.rfqDecisionLogs
    .filter((l) => pkgIds.has(l.packageId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function createRfqPackageWithInvitations(input: {
  projectId: string
  quoteId: string
  trade: Trade
  title: string
  lineIds: string[]
  subcontractors: {
    subcontractorId: string
    name: string
    phone?: string
    email?: string
  }[]
  expiresInDays?: number
  expiresAt?: string
  campaignId?: string
}): { pkg: SubcontractorRfq; invitations: RfqInvitation[] } {
  const bundle = loadBundle()
  const lines = bundle.quoteLines.filter(
    (l) => l.quoteId === input.quoteId && input.lineIds.includes(l.id)
  )

  const expiresAt = input.expiresAt
    ? new Date(input.expiresAt)
    : (() => {
        const d = new Date()
        d.setDate(d.getDate() + (input.expiresInDays ?? getRfqDefaultValidityDays()))
        return d
      })()

  const pkg: SubcontractorRfq = {
    id: newId(),
    projectId: input.projectId,
    quoteId: input.quoteId,
    trade: input.trade,
    title: input.title,
    status: "open",
    expiresAt: expiresAt.toISOString(),
    lines: lines.map((l) => ({
      id: newId(),
      quoteLineId: l.id,
      text: l.textSnapshot,
      unitId: l.unitId,
      quantity: l.quantity,
    })),
    createdAt: new Date().toISOString(),
    campaignId: input.campaignId,
  }

  const invitations: RfqInvitation[] = input.subcontractors
    .filter((s) => s.subcontractorId && s.name.trim())
    .map((s) => ({
      id: newId(),
      packageId: pkg.id,
      subcontractorId: s.subcontractorId,
      subcontractorName: s.name.trim(),
      contactPhone: s.phone?.trim() ?? "",
      accessToken: generateAccessToken(),
      accessCode: generateAccessCode(),
      status: "invited" as const,
      createdAt: new Date().toISOString(),
    }))

  bundle.rfqs.push(pkg)
  bundle.rfqInvitations.push(...invitations)

  for (const ql of lines) {
    const li = bundle.quoteLines.findIndex((l) => l.id === ql.id)
    if (li >= 0 && !isLineCosted(bundle.quoteLines[li])) {
      bundle.quoteLines[li] = {
        ...bundle.quoteLines[li],
        pricingStatus: "rfq_pending",
      }
    }
  }

  const quote = bundle.quotes.find((q) => q.id === input.quoteId)
  recordAudit(bundle, input.projectId, {
    kind: "rfq",
    action: "Bekérés indítva",
    context: [
      pkg.title,
      quote?.primaryTrade ? getTradeLabel(quote.primaryTrade) : getTradeLabel(input.trade),
      `${pkg.lines.length} tétel`,
    ]
      .filter(Boolean)
      .join(" · "),
  })

  saveBundle(bundle)
  return { pkg, invitations }
}

export type RfqCampaignPackageInput = {
  quoteId: string
  trade: Trade
  title: string
  lineIds: string[]
  subcontractors: {
    subcontractorId: string
    name: string
    phone?: string
    email?: string
  }[]
}

export type RfqCampaignResult = {
  campaign: RfqCampaign
  packages: Array<{ pkg: SubcontractorRfq; invitations: RfqInvitation[] }>
}

export function getRfqCampaign(campaignId: string): RfqCampaign | undefined {
  return loadBundle().rfqCampaigns?.find((c) => c.id === campaignId)
}

export function createRfqCampaign(input: {
  projectId: string
  message?: string
  expiresInDays?: number
  attachedFolderIds: string[]
  attachedFolderSnapshots: RfqCampaign["attachedFolderSnapshots"]
  packages: RfqCampaignPackageInput[]
}): RfqCampaignResult {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? getRfqDefaultValidityDays()))
  const expiresIso = expiresAt.toISOString()

  const campaign: RfqCampaign = {
    id: newId(),
    projectId: input.projectId,
    message: input.message?.trim() || undefined,
    expiresAt: expiresIso,
    attachedFolderIds: input.attachedFolderIds,
    attachedFolderSnapshots: input.attachedFolderSnapshots,
    createdAt: new Date().toISOString(),
  }

  const packages: RfqCampaignResult["packages"] = []

  for (const pkgInput of input.packages) {
    if (pkgInput.subcontractors.length === 0 || pkgInput.lineIds.length === 0) continue
    const { pkg, invitations } = createRfqPackageWithInvitations({
      ...pkgInput,
      projectId: input.projectId,
      expiresAt: expiresIso,
      campaignId: campaign.id,
    })
    packages.push({ pkg, invitations })
  }

  if (packages.length === 0) {
    throw new Error("Nincs létrehozható bekérés — ellenőrizd a szakágokat és partnereket")
  }

  const bundle = loadBundle()
  bundle.rfqCampaigns = [...(bundle.rfqCampaigns ?? []), campaign]
  saveBundle(bundle)

  return { campaign, packages }
}

export function listInvitationsForQuote(quoteId: string): RfqInvitation[] {
  const bundle = loadBundle()
  const pkgIds = new Set(bundle.rfqs.filter((r) => r.quoteId === quoteId).map((r) => r.id))
  return bundle.rfqInvitations.filter((i) => pkgIds.has(i.packageId))
}

export function getSubmission(submissionId: string): SubcontractorRfqSubmission | undefined {
  return loadBundle().submissions.find((s) => s.id === submissionId)
}

export function getSubmissionForInvitation(
  invitationId: string
): SubcontractorRfqSubmission | undefined {
  return loadBundle().submissions.find((s) => s.invitationId === invitationId)
}

export function submitInvitationBid(
  invitationId: string,
  input: Omit<SubcontractorRfqSubmission, "id" | "rfqId" | "invitationId" | "submittedAt" | "updatedAt">
): SubcontractorRfqSubmission | null {
  const bundle = loadBundle()
  const invitation = bundle.rfqInvitations.find((i) => i.id === invitationId)
  if (!invitation) return null
  const pkg = bundle.rfqs.find((r) => r.id === invitation.packageId)
  if (!pkg) return null
  if (new Date(pkg.expiresAt) < new Date()) return null
  if (invitation.status === "accepted" || invitation.status === "rejected") return null

  const now = new Date().toISOString()
  const existingIdx = bundle.submissions.findIndex((s) => s.invitationId === invitationId)

  const lineBids = input.lineBids.map((b) => ({
    rfqLineId: b.rfqLineId,
    materialUnitPrice: b.materialUnitPrice ?? 0,
    laborUnitPrice: b.laborUnitPrice ?? b.unitPrice ?? 0,
    declined: b.declined ?? false,
  }))

  const draft: SubcontractorRfqSubmission = {
    id: existingIdx >= 0 ? bundle.submissions[existingIdx].id : newId(),
    rfqId: pkg.id,
    invitationId,
    subcontractorId: input.subcontractorId ?? invitation.subcontractorId,
    subcontractorName: input.subcontractorName || invitation.subcontractorName,
    contactEmail: input.contactEmail ?? "",
    contactPhone: input.contactPhone ?? invitation.contactPhone,
    notes: input.notes ?? "",
    lineBids,
    totalAmount: 0,
    submittedAt: existingIdx >= 0 ? bundle.submissions[existingIdx].submittedAt : now,
    updatedAt: now,
  }
  draft.totalAmount = computeSubmissionTotal(draft, pkg)

  const hasAnyPrice = lineBids.some(
    (b) => !b.declined && (b.materialUnitPrice > 0 || b.laborUnitPrice > 0)
  )
  if (!hasAnyPrice) return null

  if (existingIdx >= 0) {
    const prev = bundle.submissions[existingIdx]
    const history = [...(prev.revisionHistory ?? [])]
    if (prev.totalAmount !== draft.totalAmount || prev.updatedAt !== draft.updatedAt) {
      history.push({
        totalAmount: prev.totalAmount,
        updatedAt: prev.updatedAt,
        notes: prev.notes || undefined,
      })
    }
    draft.revisionHistory = history
    draft.submittedAt = prev.submittedAt
    bundle.submissions[existingIdx] = draft
  } else {
    bundle.submissions.push(draft)
  }

  const invIdx = bundle.rfqInvitations.findIndex((i) => i.id === invitationId)
  if (invIdx >= 0) {
    bundle.rfqInvitations[invIdx] = {
      ...bundle.rfqInvitations[invIdx],
      status: "submitted",
      subcontractorName: draft.subcontractorName,
      contactPhone: draft.contactPhone || bundle.rfqInvitations[invIdx].contactPhone,
    }
  }

  saveBundle(bundle)
  return draft
}

function logDecision(
  bundle: ProjectDataBundle,
  entry: Omit<RfqDecisionLogEntry, "id" | "createdAt" | "decidedByUserId" | "decidedByEmail" | "decidedByName">
): void {
  bundle.rfqDecisionLogs.push({
    ...entry,
    ...currentDecisionActor(),
    id: newId(),
    createdAt: new Date().toISOString(),
  })
}

function applyBidToQuoteLine(
  bundle: ProjectDataBundle,
  quoteLineId: string,
  bid: { materialUnitPrice: number; laborUnitPrice: number; declined?: boolean; unitPrice?: number },
  subcontractorName: string,
  submissionId: string
): boolean {
  if (bid.declined) return false
  const mat = bid.materialUnitPrice ?? 0
  const lab = bid.laborUnitPrice ?? bid.unitPrice ?? 0
  if (mat <= 0 && lab <= 0) return false

  const li = bundle.quoteLines.findIndex((l) => l.id === quoteLineId)
  if (li < 0) return false

  bundle.quoteLines[li] = {
    ...bundle.quoteLines[li],
    costMaterialUnitPrice: mat,
    costLaborUnitPrice: lab,
    costSource: "subcontractor",
    costSourceSubcontractor: subcontractorName,
    costSourceRfqSubmissionId: submissionId,
    pricingStatus: "costed",
  }
  return true
}

export function applyRfqPackageDecision(
  packageId: string,
  winningInvitationId: string
): { updated: number } {
  const bundle = loadBundle()
  const pkg = bundle.rfqs.find((r) => r.id === packageId)
  if (!pkg) return { updated: 0 }

  const submission = bundle.submissions.find((s) => s.invitationId === winningInvitationId)
  const invitation = bundle.rfqInvitations.find((i) => i.id === winningInvitationId)
  if (!submission || !invitation) return { updated: 0 }

  const quote = bundle.quotes.find((q) => q.id === pkg.quoteId)
  const lines = bundle.quoteLines.filter((l) => l.quoteId === pkg.quoteId)
  const marginBefore = quote
    ? (() => {
        const c = quoteCostTotals(lines)
        const s = quoteSellTotals(lines, quote)
        return c.total > 0 ? Math.round(((s.total - c.total) / c.total) * 100) : null
      })()
    : null

  let updated = 0
  for (const rfl of pkg.lines) {
    if (!rfl.quoteLineId) continue
    const bid = submission.lineBids.find((b) => b.rfqLineId === rfl.id)
    if (!bid) continue
    if (applyBidToQuoteLine(bundle, rfl.quoteLineId, bid, submission.subcontractorName, submission.id)) {
      updated += 1
    }
  }

  for (const inv of bundle.rfqInvitations.filter((i) => i.packageId === packageId)) {
    const idx = bundle.rfqInvitations.findIndex((i) => i.id === inv.id)
    if (idx < 0) continue
    bundle.rfqInvitations[idx] = {
      ...bundle.rfqInvitations[idx],
      status: inv.id === winningInvitationId ? "accepted" : "rejected",
    }
  }

  const pkgIdx = bundle.rfqs.findIndex((r) => r.id === packageId)
  const isChange = pkgIdx >= 0 && bundle.rfqs[pkgIdx].status === "decided"
  if (pkgIdx >= 0) bundle.rfqs[pkgIdx] = { ...bundle.rfqs[pkgIdx], status: "decided" }

  const marginAfter = quote
    ? (() => {
        const patched = bundle.quoteLines.filter((l) => l.quoteId === pkg.quoteId)
        const c = quoteCostTotals(patched)
        const s = quoteSellTotals(patched, quote)
        return c.total > 0 ? Math.round(((s.total - c.total) / c.total) * 100) : null
      })()
    : null

  logDecision(bundle, {
    packageId,
    quoteId: pkg.quoteId,
    invitationId: winningInvitationId,
    quoteLineId: null,
    action: isChange ? "change_package_winner" : "accept_package",
    subcontractorName: submission.subcontractorName,
    marginPercentBefore: marginBefore,
    marginPercentAfter: marginAfter,
  })

  const qIdx = bundle.quotes.findIndex((q) => q.id === pkg.quoteId)
  if (qIdx >= 0) bundle.quotes[qIdx] = touch(bundle.quotes[qIdx])
  saveBundle(bundle)
  return { updated }
}

// ——— Projekt összeállítás & ügyfélcsomag ———

export function getProjectComposition(projectId: string): ProjectComposition | undefined {
  return loadBundle().compositions.find((c) => c.projectId === projectId)
}

export function saveProjectComposition(
  projectId: string,
  selections: CompositionSelection[]
): ProjectComposition {
  const bundle = loadBundle()
  const now = new Date().toISOString()
  const idx = bundle.compositions.findIndex((c) => c.projectId === projectId)
  const row: ProjectComposition = { projectId, selections, updatedAt: now }
  if (idx >= 0) bundle.compositions[idx] = row
  else bundle.compositions.push(row)
  recordAudit(bundle, projectId, {
    kind: "project",
    action: "Projekt összeállítás mentve",
    context: `${selections.length} szakág`,
  })
  saveBundle(bundle)
  return row
}

export function listCustomerPackagesForProject(projectId: string): CustomerPackage[] {
  return loadBundle()
    .customerPackages.filter((p) => p.projectId === projectId)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
}

export function getCustomerPackage(id: string): CustomerPackage | undefined {
  return loadBundle().customerPackages.find((p) => p.id === id)
}

export function getCustomerPackageByToken(token: string): CustomerPackage | undefined {
  return loadBundle().customerPackages.find((p) => p.accessToken === token)
}

function quoteIdsInDraftPackages(projectId: string, exceptPackageId?: string): Set<string> {
  const ids = new Set<string>()
  for (const pkg of loadBundle().customerPackages) {
    if (pkg.projectId !== projectId || pkg.status !== "draft") continue
    if (exceptPackageId && pkg.id === exceptPackageId) continue
    for (const snap of pkg.snapshots) ids.add(snap.quoteId)
  }
  return ids
}

function quoteIdsInPackagesWithStatus(
  projectId: string,
  statuses: CustomerPackageStatus[],
  exceptPackageId?: string
): Set<string> {
  const ids = new Set<string>()
  for (const pkg of loadBundle().customerPackages) {
    if (pkg.projectId !== projectId || !statuses.includes(pkg.status)) continue
    if (exceptPackageId && pkg.id === exceptPackageId) continue
    for (const snap of pkg.snapshots) ids.add(snap.quoteId)
  }
  return ids
}

function activePackageQuoteIds(bundle: ProjectDataBundle, projectId: string): Set<string> {
  const ids = new Set<string>()
  for (const pkg of bundle.customerPackages) {
    if (pkg.projectId !== projectId) continue
    if (pkg.status !== "sent" && pkg.status !== "accepted") continue
    for (const snap of pkg.snapshots) ids.add(snap.quoteId)
  }
  return ids
}

function revertSupersededPackageQuotes(
  bundle: ProjectDataBundle,
  projectId: string,
  supersededPkg: CustomerPackage
): void {
  const activeIds = activePackageQuoteIds(bundle, projectId)
  for (const snap of supersededPkg.snapshots) {
    if (activeIds.has(snap.quoteId)) continue
    const qIdx = bundle.quotes.findIndex((q) => q.id === snap.quoteId)
    if (qIdx < 0) continue
    if (bundle.quotes[qIdx].status === "sent") {
      bundle.quotes[qIdx] = touch({ ...bundle.quotes[qIdx], status: "draft" })
    }
  }
}

function supersedeSentPackagesInBundle(
  bundle: ProjectDataBundle,
  projectId: string,
  exceptPackageId?: string
): void {
  for (const pkg of bundle.customerPackages) {
    if (pkg.projectId !== projectId || pkg.status !== "sent") continue
    if (exceptPackageId && pkg.id === exceptPackageId) continue
    pkg.status = "superseded"
    revertSupersededPackageQuotes(bundle, projectId, pkg)
  }
}

export function listQuoteIdsInDraftPackages(projectId: string): string[] {
  return [...quoteIdsInDraftPackages(projectId)]
}

export function listQuoteIdsInSentPackages(projectId: string): string[] {
  return [...quoteIdsInPackagesWithStatus(projectId, ["sent"])]
}

export function listContractedQuoteIds(projectId: string): string[] {
  const ids = new Set<string>()
  for (const pkg of loadBundle().customerPackages) {
    if (pkg.projectId !== projectId || pkg.status !== "accepted") continue
    const snaps = pkg.acceptedSnapshots ?? pkg.snapshots
    for (const snap of snaps) ids.add(snap.quoteId)
  }
  return [...ids]
}

export function listOfferLockedQuoteIds(projectId: string, exceptDraftId?: string): string[] {
  const draft = quoteIdsInDraftPackages(projectId, exceptDraftId)
  const sent = quoteIdsInPackagesWithStatus(projectId, ["sent", "accepted"])
  return [...new Set([...draft, ...sent])]
}

export function listOfferSelectableQuotes(projectId: string): QuoteWithSummary[] {
  return loadBundle()
    .quotes.filter((q) => q.projectId === projectId && q.status !== "archived")
    .map(buildQuoteWithSummary)
    .sort((a, b) => {
      const ta = a.primaryTrade ?? ""
      const tb = b.primaryTrade ?? ""
      if (ta !== tb) return ta.localeCompare(tb, "hu")
      return a.quote.title.localeCompare(b.quote.title, "hu")
    })
}

export function createCustomerPackageDraft(input: {
  projectId: string
  title: string
  quoteIds: string[]
  type?: CustomerPackageType
}): CustomerPackage {
  const bundle = loadBundle()
  const project = bundle.projects.find((p) => p.id === input.projectId)
  if (!project) throw new Error("A projekt nem található")

  const title = input.title.trim()
  if (!title) throw new Error("Add meg az árajánlat nevét")

  const uniqueIds = [...new Set(input.quoteIds)]
  if (uniqueIds.length === 0) throw new Error("Legalább egy költségvetést válassz ki")

  const inOtherDraft = quoteIdsInDraftPackages(input.projectId)
  const contracted = new Set(listContractedQuoteIds(input.projectId))
  const rows = listOfferSelectableQuotes(input.projectId)
  const extraBlockers: string[] = []
  const type = input.type ?? "full"

  for (const id of uniqueIds) {
    if (inOtherDraft.has(id)) {
      const row = rows.find((r) => r.quote.id === id)
      extraBlockers.push(
        `${row?.quote.title ?? "Költségvetés"}: már szerepel egy másik piszkozat árajánlatban`
      )
    }
    if (type === "supplement" && contracted.has(id)) {
      const row = rows.find((r) => r.quote.id === id)
      extraBlockers.push(
        `${row?.quote.title ?? "Költségvetés"}: már szerződésben van — kiegészítőbe nem tehető`
      )
    }
  }

  const preview = buildPackagePreviewFromQuoteIds(input.projectId, uniqueIds, rows)
  const blockers = [...preview.blockers, ...extraBlockers]
  if (blockers.length > 0 || !preview.canSend) {
    throw new Error(blockers.join("\n") || "Az árajánlat nem hozható létre")
  }

  const now = new Date().toISOString()
  const pkg: CustomerPackage = {
    id: newId(),
    projectId: input.projectId,
    type,
    status: "draft",
    title,
    snapshots: preview.snapshots,
    sellNetTotal: preview.sellNetTotal,
    grossTotal: preview.grossTotal,
    sentAt: now,
    notes: buildOfferDefaultNotesText() || undefined,
  }
  bundle.customerPackages.push(pkg)

  recordAudit(bundle, input.projectId, {
    kind: "quote",
    action: "Árajánlat piszkozat létrehozva",
    context: `${preview.snapshots.length} költségvetés · ${Math.round(preview.grossTotal).toLocaleString("hu-HU")} Ft bruttó`,
  })
  saveBundle(bundle)
  return pkg
}

export function deleteCustomerPackageDraft(packageId: string): boolean {
  const bundle = loadBundle()
  const idx = bundle.customerPackages.findIndex((p) => p.id === packageId)
  if (idx < 0) return false
  if (bundle.customerPackages[idx].status !== "draft") return false
  const pkg = bundle.customerPackages[idx]
  bundle.customerPackages.splice(idx, 1)
  recordAudit(bundle, pkg.projectId, {
    kind: "quote",
    action: "Árajánlat piszkozat törölve",
    context: pkg.title,
  })
  saveBundle(bundle)
  return true
}

export function publishCustomerPackageDraft(packageId: string): CustomerPackage {
  const bundle = loadBundle()
  const idx = bundle.customerPackages.findIndex((p) => p.id === packageId)
  if (idx < 0) throw new Error("Az árajánlat nem található")

  const pkg = bundle.customerPackages[idx]
  if (pkg.status !== "draft") throw new Error("Csak piszkozat küldhető el")

  const quoteIds = pkg.snapshots.map((s) => s.quoteId)
  const rows = listOfferSelectableQuotes(pkg.projectId)
  const preview = buildPackagePreviewFromQuoteIds(pkg.projectId, quoteIds, rows)
  if (!preview.canSend) {
    throw new Error(preview.blockers.join("\n") || "Az árajánlat nem küldhető")
  }

  const now = new Date().toISOString()
  const expiresAt = new Date(
    Date.now() + getOfferValidityDays() * 24 * 60 * 60 * 1000
  ).toISOString()

  supersedeSentPackagesInBundle(bundle, pkg.projectId, packageId)

  bundle.customerPackages[idx] = {
    ...pkg,
    status: "sent",
    snapshots: preview.snapshots,
    sellNetTotal: preview.sellNetTotal,
    grossTotal: preview.grossTotal,
    sentAt: now,
    accessToken: generateAccessToken(),
    accessCode: generateAccessCode(),
    expiresAt,
  }

  for (const quoteId of quoteIds) {
    const qIdx = bundle.quotes.findIndex((q) => q.id === quoteId)
    if (qIdx < 0) continue
    if (bundle.quotes[qIdx].status === "draft") {
      bundle.quotes[qIdx] = touch({ ...bundle.quotes[qIdx], status: "sent" })
    }
  }

  archiveSupersededVersionsInBundle(bundle, pkg.projectId, quoteIds)

  recordAudit(bundle, pkg.projectId, {
    kind: "quote",
    action: "Árajánlat elküldve ügyfélnek",
    context: `${preview.snapshots.length} költségvetés · ${Math.round(preview.grossTotal).toLocaleString("hu-HU")} Ft bruttó`,
  })
  saveBundle(bundle)
  return bundle.customerPackages[idx]
}

/**
 * Új verzió küldésekor a lánc régi verziói automatikusan archiválódnak,
 * hogy a projekt-összesítőben ne számoljanak duplán.
 * Elfogadott (szerződött) vagy más aktív csomagban lévő verziót nem bánt.
 */
function archiveSupersededVersionsInBundle(
  bundle: ProjectDataBundle,
  projectId: string,
  sentQuoteIds: string[]
): void {
  const lockedIds = new Set<string>()
  for (const p of bundle.customerPackages) {
    if (p.projectId !== projectId) continue
    if (p.status !== "sent" && p.status !== "accepted") continue
    const snaps = p.acceptedSnapshots ?? p.snapshots
    for (const s of snaps) lockedIds.add(s.quoteId)
  }

  for (const quoteId of sentQuoteIds) {
    let current = bundle.quotes.find((q) => q.id === quoteId)
    const visited = new Set<string>()
    while (current?.supersedesQuoteId && !visited.has(current.supersedesQuoteId)) {
      visited.add(current.supersedesQuoteId)
      const prevIdx = bundle.quotes.findIndex((q) => q.id === current?.supersedesQuoteId)
      if (prevIdx < 0) break
      const prev = bundle.quotes[prevIdx]
      if (
        prev.status !== "accepted" &&
        prev.status !== "archived" &&
        !lockedIds.has(prev.id)
      ) {
        bundle.quotes[prevIdx] = touch({ ...prev, status: "archived" })
        recordAudit(bundle, projectId, {
          kind: "quote",
          action: "Régi verzió automatikusan archiválva",
          context: prev.title,
        })
      }
      current = prev
    }
  }
}

export function recordCustomerPackageResponse(
  packageId: string,
  input: {
    type: CustomerPackageResponseType
    acceptedQuoteIds?: string[]
    clientNotes?: string
    respondedByName?: string
    viaLink?: boolean
  }
): CustomerPackage | undefined {
  const bundle = loadBundle()
  const pkgBefore = bundle.customerPackages.find((p) => p.id === packageId)
  if (!pkgBefore) return undefined

  const result = applyCustomerPackageResponse(bundle, packageId, input)
  if (!result.ok) {
    throw new Error(result.error)
  }

  const actionLabel =
    input.type === "reject_all"
      ? "Ügyfél elutasította az ajánlatot"
      : input.type === "partial"
        ? `Részleges elfogadás (${result.pkg.acceptedSnapshots?.length ?? 0}/${pkgBefore.snapshots.length} szakág)`
        : "Ügyfél elfogadta az ajánlatot"

  const who = input.respondedByName
    ? input.viaLink
      ? `${input.respondedByName} (linken)`
      : input.respondedByName
    : input.viaLink
      ? "Ügyfél (linken)"
      : undefined

  recordAudit(bundle, pkgBefore.projectId, {
    kind: "decision",
    action: actionLabel,
    context: [who, input.clientNotes ?? result.pkg.title].filter(Boolean).join(" · "),
  })
  saveBundle(bundle)
  return result.pkg
}

export function getProjectBundle(): ProjectDataBundle {
  return loadBundle()
}

export function listPerformanceCertificatesForProject(
  projectId: string
): PerformanceCertificate[] {
  return (loadBundle().performanceCertificates ?? [])
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
}

export function getPerformanceCertificate(id: string): PerformanceCertificate | undefined {
  return (loadBundle().performanceCertificates ?? []).find((c) => c.id === id)
}

export type CreatePerformanceCertificateInput = {
  projectId: string
  quoteId: string
  lineIds: string[]
  periodTo?: string
  periodFrom?: string
  notes?: string
}

export function createPerformanceCertificate(
  input: CreatePerformanceCertificateInput
): PerformanceCertificate | null {
  const bundle = loadBundle()
  const project = bundle.projects.find((p) => p.id === input.projectId)
  const quote = bundle.quotes.find((q) => q.id === input.quoteId)
  if (!project || !quote) return null

  const lineSet = new Set(input.lineIds)
  const selected = bundle.quoteLines.filter(
    (l) => l.quoteId === input.quoteId && lineSet.has(l.id)
  )
  if (selected.length === 0 || selected.length !== input.lineIds.length) return null

  for (const line of selected) {
    if (line.executionStatus !== "done" || line.tigDocumentId) return null
  }

  const contractedMap = new Map<string, import("@/types/projects").CustomerPackageSnapshotLine>()
  for (const pkg of bundle.customerPackages.filter(
    (p) => p.projectId === input.projectId && p.status === "accepted"
  )) {
    const snaps = pkg.acceptedSnapshots ?? pkg.snapshots
    const snap = snaps.find((s) => s.quoteId === input.quoteId)
    if (!snap?.lines) continue
    for (const row of snap.lines) {
      contractedMap.set(row.lineId, row)
    }
  }

  const contractRef = (() => {
    for (const pkg of bundle.customerPackages.filter(
      (p) => p.projectId === input.projectId && p.status === "accepted"
    )) {
      const snaps = pkg.acceptedSnapshots ?? pkg.snapshots
      if (snaps.some((s) => s.quoteId === input.quoteId)) {
        return {
          reference: `${pkg.title} — ${quote.title}`,
          packageId: pkg.id as string | undefined,
          packageTitle: pkg.title as string | undefined,
        }
      }
    }
    return {
      reference: quote.title,
      packageId: undefined as string | undefined,
      packageTitle: undefined as string | undefined,
    }
  })()
  const issuedAt = new Date().toISOString().slice(0, 10)
  const periodTo = input.periodTo ?? issuedAt
  const documentNumber = formatTigDocumentNumber(
    project,
    (bundle.performanceCertificates ?? []).filter((c) => c.projectId === input.projectId).length + 1,
    issuedAt
  )
  const preview = buildTigPreviewModel({
    project,
    quote,
    selectedLines: selected,
    contractedMap,
    contractReference: contractRef.reference,
    contractPackageId: contractRef.packageId,
    contractPackageTitle: contractRef.packageTitle,
    documentNumber,
    issuedAt,
    periodTo,
    periodFrom: input.periodFrom,
    notes: input.notes,
  })

  const cert: PerformanceCertificate = {
    ...tigPreviewToCertificate(preview, input.projectId),
    id: newId(),
  }

  if (!bundle.performanceCertificates) bundle.performanceCertificates = []
  bundle.performanceCertificates.push(cert)

  for (const line of selected) {
    const idx = bundle.quoteLines.findIndex((l) => l.id === line.id)
    if (idx >= 0) {
      bundle.quoteLines[idx] = { ...bundle.quoteLines[idx], tigDocumentId: cert.id }
    }
  }

  const qIdx = bundle.quotes.findIndex((q) => q.id === input.quoteId)
  if (qIdx >= 0) bundle.quotes[qIdx] = touch(bundle.quotes[qIdx])

  recordAudit(bundle, input.projectId, {
    kind: "project",
    action: `Teljesítésigazolás rögzítve (${cert.documentNumber})`,
    context: `${selected.length} tétel · ${preview.grossTotal.toLocaleString("hu-HU")} Ft bruttó`,
  })

  saveBundle(bundle)
  return cert
}

export function closeProject(projectId: string): Project | undefined {
  const bundle = loadBundle()
  const idx = bundle.projects.findIndex((p) => p.id === projectId)
  if (idx < 0) return undefined

  const project = bundle.projects[idx]
  if (project.status === "done" || project.status === "archived") return undefined
  if (project.status !== "won" && project.status !== "in_progress") return undefined

  bundle.projects[idx] = touch({ ...project, status: "done" })
  recordAudit(bundle, projectId, {
    kind: "project",
    action: "Projekt lezárva",
    context: project.code,
  })
  saveBundle(bundle)
  return bundle.projects[idx]
}

/** DB → in-memory cache frissítés (oldalbetöltéskor / publikus válasz után) */
export async function syncBundleFromServer(): Promise<boolean> {
  if (typeof window === "undefined") return false
  try {
    const res = await fetch("/api/projects-bundle")
    if (!res.ok) return false
    bundleCache = normalizeProjectBundle((await res.json()) as ProjectDataBundle)
    return true
  } catch {
    return false
  }
}
