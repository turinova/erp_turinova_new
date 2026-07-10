import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  CustomerPackage,
  CustomerPackageSnapshot,
  PerformanceCertificate,
  Project,
  ProjectAuditEntry,
  ProjectComposition,
  ProjectDataBundle,
  Quote,
  QuoteLine,
  RfqCampaign,
  RfqDecisionLogEntry,
  RfqInvitation,
  SubcontractorRfq,
  SubcontractorRfqSubmission,
} from "@/types/projects"

/**
 * ProjectDataBundle ↔ Supabase konverziós és szinkron réteg.
 *
 * - A DB az egyetlen forrás; a kliens teljes bundle-t kap (GET) és teljes
 *   bundle-t küld vissza (PUT) — a szinkron diff-alapú (insert/update/delete).
 * - Legacy (nem-UUID) azonosítókat első íráskor UUID-ra képez, a JSONB
 *   snapshotok belsejében is (import-út).
 * - Trade: a bundle kódot tárol, a DB uuid-t — itt oldódik fel mindkét irányban.
 * - Blanket upsert biztonságos: a DB guard triggerek változás-alapúak
 *   (azonos értékű update átmegy rajtuk).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && UUID_RE.test(v)
}

function chunk<T>(arr: T[], size = 100): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : fallback
}

function dateOnly(iso: string | undefined | null): string | null {
  if (!iso) return null
  return iso.slice(0, 10)
}

async function selectAll<T>(
  supabase: SupabaseClient,
  table: string,
  column: string,
  ids: string[],
  columns = "*"
): Promise<T[]> {
  const rows: T[] = []
  for (const part of chunk(ids)) {
    if (part.length === 0) continue
    const { data, error } = await supabase.from(table).select(columns).in(column, part)
    if (error) throw new Error(`${table} select: ${error.message}`)
    rows.push(...((data ?? []) as T[]))
  }
  return rows
}

async function deleteByIds(
  supabase: SupabaseClient,
  table: string,
  ids: string[]
): Promise<void> {
  for (const part of chunk(ids)) {
    if (part.length === 0) continue
    const { error } = await supabase.from(table).delete().in("id", part)
    if (error) throw new Error(`${table} delete: ${error.message}`)
  }
}

async function upsertRows(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict = "id"
): Promise<void> {
  for (const part of chunk(rows, 200)) {
    if (part.length === 0) continue
    const { error } = await supabase.from(table).upsert(part, { onConflict })
    if (error) throw new Error(`${table} upsert: ${error.message}`)
  }
}

async function insertRows(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  for (const part of chunk(rows, 200)) {
    if (part.length === 0) continue
    const { error } = await supabase.from(table).insert(part)
    if (error) throw new Error(`${table} insert: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Törzsadat-feloldás (trade kód ↔ uuid, unit legacy id → uuid, client, user)
// ---------------------------------------------------------------------------

type RefMaps = {
  tradeIdByCode: Map<string, string>
  tradeCodeById: Map<string, string>
  unitIdByCode: Map<string, string>
  unitIds: Set<string>
  clientIds: Set<string>
  clientIdByName: Map<string, string>
  userIds: Set<string>
}

async function loadRefMaps(supabase: SupabaseClient, orgId: string): Promise<RefMaps> {
  const [trades, units, clients, profiles] = await Promise.all([
    supabase.from("trades").select("id, code").eq("organization_id", orgId).is("deleted_at", null),
    supabase.from("units").select("id, code").eq("organization_id", orgId).is("deleted_at", null),
    supabase
      .from("clients")
      .select("id, display_name, legal_name")
      .eq("organization_id", orgId)
      .is("deleted_at", null),
    supabase.from("profiles").select("id"),
  ])
  for (const r of [trades, units, clients, profiles]) {
    if (r.error) throw new Error(`ref maps: ${r.error.message}`)
  }

  const tradeIdByCode = new Map<string, string>()
  const tradeCodeById = new Map<string, string>()
  for (const t of trades.data ?? []) {
    tradeIdByCode.set(t.code.toLowerCase(), t.id)
    tradeCodeById.set(t.id, t.code)
  }

  const unitIdByCode = new Map<string, string>()
  const unitIds = new Set<string>()
  for (const u of units.data ?? []) {
    unitIdByCode.set(u.code.toLowerCase(), u.id)
    unitIds.add(u.id)
  }

  const clientIds = new Set<string>()
  const clientIdByName = new Map<string, string>()
  for (const c of clients.data ?? []) {
    clientIds.add(c.id)
    clientIdByName.set(c.display_name.trim().toLowerCase(), c.id)
    clientIdByName.set(c.legal_name.trim().toLowerCase(), c.id)
  }

  return {
    tradeIdByCode,
    tradeCodeById,
    unitIdByCode,
    unitIds,
    clientIds,
    clientIdByName,
    userIds: new Set((profiles.data ?? []).map((p) => p.id)),
  }
}

/** Ismeretlen trade kód → auto-létrehozás (import robusztusság) */
async function resolveTradeId(
  supabase: SupabaseClient,
  orgId: string,
  maps: RefMaps,
  code: string
): Promise<string> {
  const key = (code || "egyeb").toLowerCase()
  const existing = maps.tradeIdByCode.get(key)
  if (existing) return existing

  const { data, error } = await supabase
    .from("trades")
    .insert({ organization_id: orgId, code: key, name: code || "Egyéb", sort_order: 999 })
    .select("id, code")
    .single()
  if (error || !data) throw new Error(`trade auto-create (${code}): ${error?.message}`)
  maps.tradeIdByCode.set(key, data.id)
  maps.tradeCodeById.set(data.id, data.code)
  return data.id
}

/** Legacy unit id ("unit-m2") vagy uuid → DB unit uuid; ismeretlen → auto-létrehozás */
async function resolveUnitId(
  supabase: SupabaseClient,
  orgId: string,
  maps: RefMaps,
  unitId: string
): Promise<string> {
  if (isUuid(unitId) && maps.unitIds.has(unitId)) return unitId
  const code = (unitId.startsWith("unit-") ? unitId.slice(5) : unitId).toLowerCase() || "db"
  const existing = maps.unitIdByCode.get(code)
  if (existing) return existing

  const { data, error } = await supabase
    .from("units")
    .insert({ organization_id: orgId, code, name: code, sort_order: 999 })
    .select("id, code")
    .single()
  if (error || !data) throw new Error(`unit auto-create (${unitId}): ${error?.message}`)
  maps.unitIdByCode.set(code, data.id)
  maps.unitIds.add(data.id)
  return data.id
}

// ---------------------------------------------------------------------------
// Legacy ID → UUID átképzés (a JSONB snapshotok belsejében is)
// ---------------------------------------------------------------------------

class IdMapper {
  private map = new Map<string, string>()

  resolve(id: string | null | undefined): string | null {
    if (!id) return null
    if (isUuid(id)) return id
    let mapped = this.map.get(id)
    if (!mapped) {
      mapped = randomUUID()
      this.map.set(id, mapped)
    }
    return mapped
  }

  required(id: string): string {
    return this.resolve(id) as string
  }
}

function remapSnapshot(snap: CustomerPackageSnapshot, ids: IdMapper): CustomerPackageSnapshot {
  return {
    ...snap,
    quoteId: ids.required(snap.quoteId),
    lineIds: snap.lineIds?.map((l) => ids.required(l)),
    lines: snap.lines?.map((l) => ({ ...l, lineId: ids.required(l.lineId) })),
  }
}

/** A teljes bundle minden entitás-id-ját és hivatkozását UUID-ra képezi. */
export function remapBundleIds(bundle: ProjectDataBundle): ProjectDataBundle {
  const ids = new IdMapper()

  const projects = bundle.projects.map((p) => ({ ...p, id: ids.required(p.id) }))
  const quotes = bundle.quotes.map((q) => ({
    ...q,
    id: ids.required(q.id),
    projectId: ids.required(q.projectId),
    supersedesQuoteId: q.supersedesQuoteId ? ids.required(q.supersedesQuoteId) : undefined,
  }))
  const quoteLines = bundle.quoteLines.map((l) => ({
    ...l,
    id: ids.required(l.id),
    quoteId: ids.required(l.quoteId),
    costSourceRfqSubmissionId: l.costSourceRfqSubmissionId
      ? ids.required(l.costSourceRfqSubmissionId)
      : null,
    tigDocumentId: l.tigDocumentId ? ids.required(l.tigDocumentId) : undefined,
  }))
  const rfqCampaigns = (bundle.rfqCampaigns ?? []).map((c) => ({
    ...c,
    id: ids.required(c.id),
    projectId: ids.required(c.projectId),
  }))
  const rfqs = bundle.rfqs.map((r) => ({
    ...r,
    id: ids.required(r.id),
    projectId: ids.required(r.projectId),
    quoteId: ids.required(r.quoteId),
    campaignId: r.campaignId ? ids.required(r.campaignId) : undefined,
    lines: r.lines.map((l) => ({
      ...l,
      id: ids.required(l.id),
      quoteLineId: l.quoteLineId ? ids.required(l.quoteLineId) : null,
    })),
  }))
  const rfqInvitations = bundle.rfqInvitations.map((i) => ({
    ...i,
    id: ids.required(i.id),
    packageId: ids.required(i.packageId),
  }))
  const submissions = bundle.submissions.map((s) => ({
    ...s,
    id: ids.required(s.id),
    rfqId: ids.required(s.rfqId),
    invitationId: ids.required(s.invitationId),
    lineBids: s.lineBids.map((b) => ({ ...b, rfqLineId: ids.required(b.rfqLineId) })),
  }))
  const rfqDecisionLogs = bundle.rfqDecisionLogs.map((d) => ({
    ...d,
    id: ids.required(d.id),
    packageId: ids.required(d.packageId),
    quoteId: ids.required(d.quoteId),
    invitationId: d.invitationId ? ids.required(d.invitationId) : d.invitationId,
    quoteLineId: d.quoteLineId ? ids.required(d.quoteLineId) : null,
  }))
  const auditLog = (bundle.auditLog ?? []).map((a) => ({
    ...a,
    id: ids.required(a.id),
    projectId: ids.required(a.projectId),
  }))
  const compositions = bundle.compositions.map((c) => ({
    ...c,
    projectId: ids.required(c.projectId),
    selections: c.selections.map((s) => ({
      ...s,
      quoteId: ids.required(s.quoteId),
      lineIds: s.lineIds?.map((l) => ids.required(l)),
    })),
  }))
  const customerPackages = bundle.customerPackages.map((p) => ({
    ...p,
    id: ids.required(p.id),
    projectId: ids.required(p.projectId),
    snapshots: p.snapshots.map((s) => remapSnapshot(s, ids)),
    acceptedSnapshots: p.acceptedSnapshots?.map((s) => remapSnapshot(s, ids)),
  }))
  const performanceCertificates = (bundle.performanceCertificates ?? []).map((c) => ({
    ...c,
    id: ids.required(c.id),
    projectId: ids.required(c.projectId),
    contractPackageId: c.contractPackageId ? ids.required(c.contractPackageId) : undefined,
    lines: c.lines.map((l) => ({
      ...l,
      lineId: ids.required(l.lineId),
      quoteId: ids.required(l.quoteId),
    })),
  }))

  return {
    projects,
    quotes,
    quoteLines,
    rfqs,
    rfqCampaigns,
    rfqInvitations,
    submissions,
    rfqDecisionLogs,
    auditLog,
    compositions,
    customerPackages,
    performanceCertificates,
  }
}

// ---------------------------------------------------------------------------
// DB → bundle
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function loadBundleFromDb(
  supabase: SupabaseClient,
  orgId: string,
  options?: { projectId?: string }
): Promise<ProjectDataBundle> {
  const maps = await loadRefMaps(supabase, orgId)

  let projectQuery = supabase
    .from("projects")
    .select("*")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (options?.projectId) {
    projectQuery = projectQuery.eq("id", options.projectId)
  }

  const { data: projectRows, error: projErr } = await projectQuery
  if (projErr) throw new Error(`projects select: ${projErr.message}`)

  if (options?.projectId && (!projectRows || projectRows.length === 0)) {
    throw new Error("A projekt nem található.")
  }

  const projectIds = (projectRows ?? []).map((p: any) => p.id)

  const [
    quoteRows,
    campaignRows,
    rfqRows,
    packageRows,
    certRows,
    auditRows,
    compositionRows,
  ] = await Promise.all([
    selectAll<any>(supabase, "quotes", "project_id", projectIds),
    selectAll<any>(supabase, "rfq_campaigns", "project_id", projectIds),
    selectAll<any>(supabase, "rfqs", "project_id", projectIds),
    selectAll<any>(supabase, "customer_packages", "project_id", projectIds),
    selectAll<any>(supabase, "performance_certificates", "project_id", projectIds),
    selectAll<any>(supabase, "project_audit_log", "project_id", projectIds),
    selectAll<any>(supabase, "project_composition_selections", "project_id", projectIds),
  ])

  const quoteIds = quoteRows.map((q) => q.id)
  const rfqIds = rfqRows.map((r) => r.id)

  const [markupRows, lineRows, rfqLineRows, invitationRows, submissionRows, decisionRows] =
    await Promise.all([
      selectAll<any>(supabase, "quote_trade_markups", "quote_id", quoteIds),
      selectAll<any>(supabase, "quote_lines", "quote_id", quoteIds),
      selectAll<any>(supabase, "rfq_lines", "rfq_id", rfqIds),
      selectAll<any>(supabase, "rfq_invitations", "rfq_id", rfqIds),
      selectAll<any>(supabase, "rfq_submissions", "rfq_id", rfqIds),
      selectAll<any>(supabase, "rfq_decision_logs", "rfq_id", rfqIds),
    ])

  const submissionIds = submissionRows.map((s) => s.id)
  const bidRows = await selectAll<any>(
    supabase,
    "rfq_submission_bids",
    "submission_id",
    submissionIds
  )

  const tradeCode = (id: string | null | undefined): string =>
    (id && maps.tradeCodeById.get(id)) || "egyeb"

  const projects: Project[] = (projectRows ?? []).map((p: any) => ({
    id: p.id,
    orgId: p.organization_id,
    code: p.code,
    name: p.name,
    clientId: p.client_id ?? undefined,
    clientName: p.client_name,
    siteAddress: p.site_address,
    description: p.description,
    status: p.status,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }))

  const markupsByQuote = new Map<string, Record<string, number>>()
  for (const m of markupRows) {
    const rec = markupsByQuote.get(m.quote_id) ?? {}
    rec[tradeCode(m.trade_id)] = num(m.markup_percent)
    markupsByQuote.set(m.quote_id, rec)
  }

  const quotes: Quote[] = quoteRows.map((q) => ({
    id: q.id,
    projectId: q.project_id,
    title: q.title,
    status: q.status,
    version: q.version,
    notes: q.notes,
    quoteScope: q.quote_scope,
    primaryTrade: q.primary_trade_id ? tradeCode(q.primary_trade_id) : undefined,
    supersedesQuoteId: q.supersedes_quote_id ?? undefined,
    tradeMarkups: markupsByQuote.get(q.id) ?? {},
    vatMode: q.vat_mode ?? undefined,
    createdAt: q.created_at,
    updatedAt: q.updated_at,
  }))

  const quoteLines: QuoteLine[] = lineRows
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((l) => ({
      id: l.id,
      quoteId: l.quote_id,
      sortOrder: l.sort_order,
      costItemId: l.cost_item_id,
      identifierSnapshot: l.identifier_snapshot,
      textSnapshot: l.text_snapshot,
      trade: tradeCode(l.trade_id),
      unitId: l.unit_id,
      quantity: num(l.quantity, 1),
      costMaterialUnitPrice: num(l.cost_material_unit_price),
      costLaborUnitPrice: num(l.cost_labor_unit_price),
      markupPercent: l.markup_percent == null ? null : num(l.markup_percent),
      costSource: l.cost_source,
      costSourceSubcontractor: l.cost_source_subcontractor,
      costSourceRfqSubmissionId: l.cost_source_submission_id,
      pricingStatus: l.pricing_status,
      executionStatus: l.execution_status,
      tigDocumentId: l.tig_document_id ?? undefined,
    }))

  const rfqLinesByRfq = new Map<string, any[]>()
  for (const l of rfqLineRows) {
    const list = rfqLinesByRfq.get(l.rfq_id) ?? []
    list.push(l)
    rfqLinesByRfq.set(l.rfq_id, list)
  }

  const rfqs: SubcontractorRfq[] = rfqRows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    quoteId: r.quote_id,
    trade: tradeCode(r.trade_id),
    title: r.title,
    status: r.status,
    expiresAt: r.expires_at,
    campaignId: r.campaign_id ?? undefined,
    createdAt: r.created_at,
    lines: (rfqLinesByRfq.get(r.id) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => ({
        id: l.id,
        quoteLineId: l.quote_line_id,
        text: l.text,
        unitId: l.unit_id,
        quantity: num(l.quantity, 1),
      })),
  }))

  const rfqCampaigns: RfqCampaign[] = campaignRows.map((c) => ({
    id: c.id,
    projectId: c.project_id,
    message: c.message ?? undefined,
    expiresAt: c.expires_at,
    attachedFolderIds: c.attached_folder_ids ?? [],
    attachedFolderSnapshots: c.attached_folder_snapshots ?? [],
    createdAt: c.created_at,
  }))

  const rfqInvitations: RfqInvitation[] = invitationRows.map((i) => ({
    id: i.id,
    packageId: i.rfq_id,
    subcontractorId: i.subcontractor_id ?? undefined,
    subcontractorName: i.subcontractor_name,
    contactPhone: i.contact_phone,
    accessToken: i.access_token,
    accessCode: i.access_code,
    status: i.status,
    createdAt: i.created_at,
  }))

  const bidsBySubmission = new Map<string, any[]>()
  for (const b of bidRows) {
    const list = bidsBySubmission.get(b.submission_id) ?? []
    list.push(b)
    bidsBySubmission.set(b.submission_id, list)
  }

  const submissions: SubcontractorRfqSubmission[] = submissionRows.map((s) => ({
    id: s.id,
    rfqId: s.rfq_id,
    invitationId: s.invitation_id,
    subcontractorId: s.subcontractor_id ?? undefined,
    subcontractorName: s.subcontractor_name,
    contactEmail: s.contact_email,
    contactPhone: s.contact_phone,
    notes: s.notes,
    totalAmount: num(s.total_amount),
    submittedAt: s.submitted_at,
    updatedAt: s.updated_at,
    revisionHistory: s.revision_history ?? [],
    lineBids: (bidsBySubmission.get(s.id) ?? []).map((b) => ({
      rfqLineId: b.rfq_line_id,
      materialUnitPrice: num(b.material_unit_price),
      laborUnitPrice: num(b.labor_unit_price),
      declined: b.declined,
    })),
  }))

  const rfqDecisionLogs: RfqDecisionLogEntry[] = decisionRows
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .map((d) => ({
      id: d.id,
      packageId: d.rfq_id,
      quoteId: d.quote_id,
      invitationId: d.invitation_id ?? "",
      quoteLineId: d.quote_line_id,
      action: d.action,
      subcontractorName: d.subcontractor_name,
      marginPercentBefore: d.margin_percent_before == null ? null : num(d.margin_percent_before),
      marginPercentAfter: d.margin_percent_after == null ? null : num(d.margin_percent_after),
      createdAt: d.created_at,
      decidedByUserId: d.decided_by_user_id ?? undefined,
      decidedByEmail: d.decided_by_email ?? undefined,
      decidedByName: d.decided_by_name ?? undefined,
    }))

  const auditLog: ProjectAuditEntry[] = auditRows
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
    .map((a) => ({
      id: a.id,
      projectId: a.project_id,
      actorUserId: a.actor_user_id ?? "",
      actorEmail: a.actor_email,
      actorName: a.actor_name,
      kind: a.kind,
      action: a.action,
      context: a.context ?? undefined,
      at: a.created_at,
    }))

  const selectionsByProject = new Map<string, any[]>()
  for (const s of compositionRows) {
    const list = selectionsByProject.get(s.project_id) ?? []
    list.push(s)
    selectionsByProject.set(s.project_id, list)
  }
  const compositions: ProjectComposition[] = [...selectionsByProject.entries()].map(
    ([projectId, rows]) => ({
      projectId,
      selections: rows.map((s) => ({
        trade: tradeCode(s.trade_id),
        quoteId: s.quote_id,
        lineIds: s.line_ids ?? undefined,
      })),
      updatedAt: rows.reduce(
        (max, s) => (s.updated_at > max ? s.updated_at : max),
        rows[0]?.updated_at ?? new Date(0).toISOString()
      ),
    })
  )

  const customerPackages: CustomerPackage[] = packageRows
    .sort((a, b) => (a.sent_at < b.sent_at ? -1 : 1))
    .map((p) => ({
      id: p.id,
      projectId: p.project_id,
      type: p.type,
      status: p.status,
      title: p.title,
      snapshots: p.snapshots ?? [],
      sellNetTotal: num(p.sell_net_total),
      grossTotal: num(p.gross_total),
      sentAt: p.sent_at,
      notes: p.notes ?? undefined,
      respondedAt: p.responded_at ?? undefined,
      clientNotes: p.client_notes ?? undefined,
      acceptedSnapshots: p.accepted_snapshots ?? undefined,
      acceptedSellNetTotal: p.accepted_sell_net_total == null ? undefined : num(p.accepted_sell_net_total),
      acceptedGrossTotal: p.accepted_gross_total == null ? undefined : num(p.accepted_gross_total),
      accessToken: p.access_token ?? undefined,
      accessCode: p.access_code ?? undefined,
      expiresAt: p.expires_at ?? undefined,
      respondedByName: p.responded_by_name ?? undefined,
    }))

  const performanceCertificates: PerformanceCertificate[] = certRows
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .map((c) => ({
      id: c.id,
      projectId: c.project_id,
      documentNumber: c.document_number,
      issuedAt: c.issued_at,
      contractPackageId: c.contract_package_id ?? undefined,
      contractPackageTitle: c.contract_package_title ?? undefined,
      periodFrom: c.period_from ?? undefined,
      periodTo: c.period_to,
      performanceLocation: c.performance_location,
      lines: c.lines ?? [],
      sellNetTotal: num(c.sell_net_total),
      grossTotal: num(c.gross_total),
      vatMode: c.vat_mode,
      vatLabel: c.vat_label,
      vatAmount: num(c.vat_amount),
      notes: c.notes ?? undefined,
      createdAt: c.created_at,
    }))

  return {
    projects,
    quotes,
    quoteLines,
    rfqs,
    rfqCampaigns,
    rfqInvitations,
    submissions,
    rfqDecisionLogs,
    auditLog,
    compositions,
    customerPackages,
    performanceCertificates,
  }
}

// ---------------------------------------------------------------------------
// Bundle → DB (diff-szinkron)
// ---------------------------------------------------------------------------

export async function syncBundleToDb(
  supabase: SupabaseClient,
  orgId: string,
  input: ProjectDataBundle
): Promise<void> {
  const bundle = remapBundleIds(input)
  const maps = await loadRefMaps(supabase, orgId)

  // Trade / unit feloldó cache-ek (auto-create ismeretlen kódnál)
  const tradeIdOf = async (code: string) => resolveTradeId(supabase, orgId, maps, code)
  const unitIdOf = async (unitId: string) => resolveUnitId(supabase, orgId, maps, unitId)

  // --- Meglévő DB állapot (diff-hez) ---
  const { data: dbProjects, error: dbProjErr } = await supabase
    .from("projects")
    .select("id")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
  if (dbProjErr) throw new Error(`projects ids: ${dbProjErr.message}`)
  const dbProjectIds = new Set((dbProjects ?? []).map((p) => p.id))

  const bundleProjectIds = new Set(bundle.projects.map((p) => p.id))

  // 1) Törölt projektek (cascade viszi a gyerekeket)
  const projectsToDelete = [...dbProjectIds].filter((id) => !bundleProjectIds.has(id))
  await deleteByIds(supabase, "projects", projectsToDelete)

  const survivingProjectIds = [...dbProjectIds].filter((id) => bundleProjectIds.has(id))

  const [dbQuotes, dbCampaigns, dbRfqs, dbPackages, dbCerts, dbAudit] = await Promise.all([
    selectAll<{ id: string }>(supabase, "quotes", "project_id", survivingProjectIds, "id"),
    selectAll<{ id: string }>(supabase, "rfq_campaigns", "project_id", survivingProjectIds, "id"),
    selectAll<{ id: string }>(supabase, "rfqs", "project_id", survivingProjectIds, "id"),
    selectAll<{ id: string }>(supabase, "customer_packages", "project_id", survivingProjectIds, "id"),
    selectAll<{ id: string }>(supabase, "performance_certificates", "project_id", survivingProjectIds, "id"),
    selectAll<{ id: string }>(supabase, "project_audit_log", "project_id", survivingProjectIds, "id"),
  ])
  const dbQuoteIds = new Set(dbQuotes.map((r) => r.id))
  const dbRfqIds = new Set(dbRfqs.map((r) => r.id))
  const dbCertIds = new Set(dbCerts.map((r) => r.id))
  const dbAuditIds = new Set(dbAudit.map((r) => r.id))

  const [dbLines, dbRfqLines, dbInvitations, dbSubmissions, dbDecisions] = await Promise.all([
    selectAll<{ id: string }>(supabase, "quote_lines", "quote_id", [...dbQuoteIds], "id"),
    selectAll<{ id: string }>(supabase, "rfq_lines", "rfq_id", [...dbRfqIds], "id"),
    selectAll<{ id: string }>(supabase, "rfq_invitations", "rfq_id", [...dbRfqIds], "id"),
    selectAll<{ id: string }>(supabase, "rfq_submissions", "rfq_id", [...dbRfqIds], "id"),
    selectAll<{ id: string }>(supabase, "rfq_decision_logs", "rfq_id", [...dbRfqIds], "id"),
  ])
  const dbSubmissionIds = new Set(dbSubmissions.map((r) => r.id))
  const dbDecisionIds = new Set(dbDecisions.map((r) => r.id))

  // 2) Projektek upsert
  await upsertRows(
    supabase,
    "projects",
    await Promise.all(
      bundle.projects.map(async (p) => ({
        id: p.id,
        organization_id: orgId,
        code: p.code,
        name: p.name,
        client_id: isUuid(p.clientId) && maps.clientIds.has(p.clientId as string)
          ? p.clientId
          : (maps.clientIdByName.get(p.clientName.trim().toLowerCase()) ?? null),
        client_name: p.clientName,
        site_address: p.siteAddress,
        description: p.description,
        status: p.status,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      }))
    )
  )

  // 3) Quote-ok — két menet a supersedes self-FK miatt
  const quoteRows = await Promise.all(
    bundle.quotes.map(async (q) => ({
      id: q.id,
      project_id: q.projectId,
      title: q.title,
      status: q.status,
      version: q.version,
      notes: q.notes,
      quote_scope: q.quoteScope ?? "trade",
      primary_trade_id: q.primaryTrade ? await tradeIdOf(q.primaryTrade) : null,
      supersedes_quote_id: null as string | null,
      vat_mode: q.vatMode ?? null,
      created_at: q.createdAt,
      updated_at: q.updatedAt,
    }))
  )
  await upsertRows(supabase, "quotes", quoteRows)
  const quotesWithSupersedes = bundle.quotes.filter((q) => q.supersedesQuoteId)
  for (const q of quotesWithSupersedes) {
    const { error } = await supabase
      .from("quotes")
      .update({ supersedes_quote_id: q.supersedesQuoteId })
      .eq("id", q.id)
    if (error) throw new Error(`quotes supersedes update: ${error.message}`)
  }

  // 4) Szakági fedezetek — delete + reinsert (kompozit PK)
  {
    const bundleQuoteIds = bundle.quotes.map((q) => q.id)
    for (const part of chunk(bundleQuoteIds)) {
      if (part.length === 0) continue
      const { error } = await supabase.from("quote_trade_markups").delete().in("quote_id", part)
      if (error) throw new Error(`quote_trade_markups delete: ${error.message}`)
    }
    const markupRows: Record<string, unknown>[] = []
    for (const q of bundle.quotes) {
      for (const [code, pct] of Object.entries(q.tradeMarkups ?? {})) {
        if (pct == null) continue
        markupRows.push({
          quote_id: q.id,
          trade_id: await tradeIdOf(code),
          markup_percent: pct,
        })
      }
    }
    await insertRows(supabase, "quote_trade_markups", markupRows)
  }

  // 5) Quote sorok — submission/TIG hivatkozás csak akkor megy első körben,
  //    ha a cél már létezik a DB-ben; a többit a 10) lépés tölti fel.
  const deferredLineRefs: { id: string; submissionId: string | null; tigId: string | null }[] = []
  {
    const lineRows: Record<string, unknown>[] = []
    for (const l of bundle.quoteLines) {
      const submissionOk = l.costSourceRfqSubmissionId
        ? dbSubmissionIds.has(l.costSourceRfqSubmissionId)
        : true
      const tigOk = l.tigDocumentId ? dbCertIds.has(l.tigDocumentId) : true
      if (!submissionOk || !tigOk) {
        deferredLineRefs.push({
          id: l.id,
          submissionId: l.costSourceRfqSubmissionId ?? null,
          tigId: l.tigDocumentId ?? null,
        })
      }
      lineRows.push({
        id: l.id,
        quote_id: l.quoteId,
        sort_order: l.sortOrder,
        cost_item_id: isUuid(l.costItemId) ? l.costItemId : null,
        identifier_snapshot: l.identifierSnapshot,
        text_snapshot: l.textSnapshot,
        trade_id: await tradeIdOf(l.trade),
        unit_id: await unitIdOf(l.unitId),
        quantity: l.quantity,
        cost_material_unit_price: Math.round(l.costMaterialUnitPrice),
        cost_labor_unit_price: Math.round(l.costLaborUnitPrice),
        markup_percent: l.markupPercent,
        cost_source: l.costSource,
        cost_source_subcontractor: l.costSourceSubcontractor,
        cost_source_submission_id: submissionOk ? (l.costSourceRfqSubmissionId ?? null) : null,
        pricing_status: l.pricingStatus,
        execution_status: l.executionStatus ?? "pending",
        tig_document_id: tigOk ? (l.tigDocumentId ?? null) : null,
      })
    }
    await upsertRows(supabase, "quote_lines", lineRows)
  }

  // 6) RFQ lánc
  await upsertRows(
    supabase,
    "rfq_campaigns",
    (bundle.rfqCampaigns ?? []).map((c) => ({
      id: c.id,
      project_id: c.projectId,
      message: c.message ?? null,
      expires_at: c.expiresAt,
      attached_folder_ids: c.attachedFolderIds ?? [],
      attached_folder_snapshots: c.attachedFolderSnapshots ?? [],
      created_at: c.createdAt,
    }))
  )

  await upsertRows(
    supabase,
    "rfqs",
    await Promise.all(
      bundle.rfqs.map(async (r) => ({
        id: r.id,
        project_id: r.projectId,
        quote_id: r.quoteId,
        trade_id: await tradeIdOf(r.trade),
        campaign_id: r.campaignId ?? null,
        title: r.title,
        status: r.status,
        expires_at: r.expiresAt,
        created_at: r.createdAt,
      }))
    )
  )

  {
    const rfqLineRows: Record<string, unknown>[] = []
    for (const r of bundle.rfqs) {
      let sort = 0
      for (const l of r.lines) {
        rfqLineRows.push({
          id: l.id,
          rfq_id: r.id,
          quote_line_id: l.quoteLineId,
          text: l.text,
          unit_id: await unitIdOf(l.unitId),
          quantity: l.quantity,
          sort_order: ++sort,
        })
      }
    }
    await upsertRows(supabase, "rfq_lines", rfqLineRows)
  }

  await upsertRows(
    supabase,
    "rfq_invitations",
    bundle.rfqInvitations.map((i) => ({
      id: i.id,
      rfq_id: i.packageId,
      subcontractor_id: isUuid(i.subcontractorId) ? i.subcontractorId : null,
      subcontractor_name: i.subcontractorName,
      contact_phone: i.contactPhone,
      access_token: i.accessToken,
      access_code: i.accessCode,
      status: i.status,
      created_at: i.createdAt,
    }))
  )

  await upsertRows(
    supabase,
    "rfq_submissions",
    bundle.submissions.map((s) => ({
      id: s.id,
      rfq_id: s.rfqId,
      invitation_id: s.invitationId,
      subcontractor_id: isUuid(s.subcontractorId) ? s.subcontractorId : null,
      subcontractor_name: s.subcontractorName,
      contact_email: s.contactEmail,
      contact_phone: s.contactPhone,
      notes: s.notes,
      total_amount: Math.round(s.totalAmount),
      revision_history: s.revisionHistory ?? [],
      submitted_at: s.submittedAt,
      updated_at: s.updatedAt,
    }))
  )

  // Bidek — delete + reinsert (kompozit PK)
  {
    const bundleSubmissionIds = bundle.submissions.map((s) => s.id)
    for (const part of chunk(bundleSubmissionIds)) {
      if (part.length === 0) continue
      const { error } = await supabase
        .from("rfq_submission_bids")
        .delete()
        .in("submission_id", part)
      if (error) throw new Error(`rfq_submission_bids delete: ${error.message}`)
    }
    const bidRows: Record<string, unknown>[] = []
    for (const s of bundle.submissions) {
      const seen = new Set<string>()
      for (const b of s.lineBids) {
        if (seen.has(b.rfqLineId)) continue
        seen.add(b.rfqLineId)
        bidRows.push({
          submission_id: s.id,
          rfq_line_id: b.rfqLineId,
          material_unit_price: Math.round(b.materialUnitPrice ?? 0),
          labor_unit_price: Math.round(b.laborUnitPrice ?? 0),
          declined: b.declined ?? false,
        })
      }
    }
    await insertRows(supabase, "rfq_submission_bids", bidRows)
  }

  // Döntésnapló — INSERT-only (RLS), csak az új sorok
  await insertRows(
    supabase,
    "rfq_decision_logs",
    bundle.rfqDecisionLogs
      .filter((d) => !dbDecisionIds.has(d.id))
      .map((d) => ({
        id: d.id,
        rfq_id: d.packageId,
        quote_id: d.quoteId,
        invitation_id: isUuid(d.invitationId) ? d.invitationId : null,
        quote_line_id: d.quoteLineId,
        action: d.action,
        subcontractor_name: d.subcontractorName,
        margin_percent_before: d.marginPercentBefore,
        margin_percent_after: d.marginPercentAfter,
        decided_by_user_id:
          isUuid(d.decidedByUserId) && maps.userIds.has(d.decidedByUserId as string)
            ? d.decidedByUserId
            : null,
        decided_by_email: d.decidedByEmail ?? null,
        decided_by_name: d.decidedByName ?? null,
        created_at: d.createdAt,
      }))
  )

  // 7) Kompozíció — delete + reinsert (kompozit PK)
  {
    for (const part of chunk([...bundleProjectIds])) {
      if (part.length === 0) continue
      const { error } = await supabase
        .from("project_composition_selections")
        .delete()
        .in("project_id", part)
      if (error) throw new Error(`composition delete: ${error.message}`)
    }
    const rows: Record<string, unknown>[] = []
    for (const c of bundle.compositions) {
      if (!bundleProjectIds.has(c.projectId)) continue
      const seen = new Set<string>()
      for (const s of c.selections) {
        const tradeId = await tradeIdOf(s.trade)
        if (seen.has(tradeId)) continue
        seen.add(tradeId)
        rows.push({
          project_id: c.projectId,
          trade_id: tradeId,
          quote_id: s.quoteId,
          line_ids: s.lineIds?.filter(isUuid) ?? null,
          updated_at: c.updatedAt,
        })
      }
    }
    await insertRows(supabase, "project_composition_selections", rows)
  }

  // 8) Ügyfélcsomagok — két menet: előbb a nem-sent, aztán a sent
  //    (partial unique: projektenként egy sent)
  {
    const toRow = (p: CustomerPackage): Record<string, unknown> => ({
      id: p.id,
      project_id: p.projectId,
      type: p.type,
      status: p.status,
      title: p.title,
      snapshots: p.snapshots,
      sell_net_total: Math.round(p.sellNetTotal),
      gross_total: Math.round(p.grossTotal),
      accepted_snapshots: p.acceptedSnapshots ?? null,
      accepted_sell_net_total:
        p.acceptedSellNetTotal == null ? null : Math.round(p.acceptedSellNetTotal),
      accepted_gross_total: p.acceptedGrossTotal == null ? null : Math.round(p.acceptedGrossTotal),
      notes: p.notes ?? null,
      sent_at: p.sentAt,
      responded_at: p.respondedAt ?? null,
      client_notes: p.clientNotes ?? null,
      responded_by_name: p.respondedByName ?? null,
      access_token: p.accessToken ?? null,
      access_code: p.accessCode ?? null,
      expires_at: p.expiresAt ?? null,
    })
    await upsertRows(
      supabase,
      "customer_packages",
      bundle.customerPackages.filter((p) => p.status !== "sent").map(toRow)
    )
    await upsertRows(
      supabase,
      "customer_packages",
      bundle.customerPackages.filter((p) => p.status === "sent").map(toRow)
    )
  }

  // 9) TIG — immutábilis, csak az új sorok (INSERT-only RLS)
  await insertRows(
    supabase,
    "performance_certificates",
    (bundle.performanceCertificates ?? [])
      .filter((c) => !dbCertIds.has(c.id))
      .map((c) => ({
        id: c.id,
        project_id: c.projectId,
        document_number: c.documentNumber,
        issued_at: dateOnly(c.issuedAt),
        contract_package_id: c.contractPackageId ?? null,
        contract_package_title: c.contractPackageTitle ?? null,
        period_from: dateOnly(c.periodFrom),
        period_to: dateOnly(c.periodTo),
        performance_location: c.performanceLocation,
        lines: c.lines,
        sell_net_total: Math.round(c.sellNetTotal),
        gross_total: Math.round(c.grossTotal),
        vat_mode: c.vatMode,
        vat_label: c.vatLabel,
        vat_amount: Math.round(c.vatAmount),
        notes: c.notes ?? null,
        created_at: c.createdAt,
      }))
  )

  // 10) Halasztott quote-sor hivatkozások (submission / TIG, most már léteznek)
  for (const ref of deferredLineRefs) {
    const { error } = await supabase
      .from("quote_lines")
      .update({
        cost_source_submission_id: ref.submissionId,
        tig_document_id: ref.tigId,
      })
      .eq("id", ref.id)
    if (error) throw new Error(`quote_lines deferred update: ${error.message}`)
  }

  // 11) Audit — INSERT-only, csak az új sorok
  await insertRows(
    supabase,
    "project_audit_log",
    (bundle.auditLog ?? [])
      .filter((a) => !dbAuditIds.has(a.id) && bundleProjectIds.has(a.projectId))
      .map((a) => ({
        id: a.id,
        project_id: a.projectId,
        actor_user_id:
          isUuid(a.actorUserId) && maps.userIds.has(a.actorUserId) ? a.actorUserId : null,
        actor_email: a.actorEmail,
        actor_name: a.actorName,
        kind: a.kind,
        action: a.action,
        context: a.context ?? null,
        created_at: a.at,
      }))
  )

  // 12) Törlések (gyerek → szülő sorrendben; a projekt-szintű törlés már megvolt)
  {
    const keep = {
      submissions: new Set(bundle.submissions.map((s) => s.id)),
      invitations: new Set(bundle.rfqInvitations.map((i) => i.id)),
      rfqLines: new Set(bundle.rfqs.flatMap((r) => r.lines.map((l) => l.id))),
      rfqs: new Set(bundle.rfqs.map((r) => r.id)),
      campaigns: new Set((bundle.rfqCampaigns ?? []).map((c) => c.id)),
      packages: new Set(bundle.customerPackages.map((p) => p.id)),
      lines: new Set(bundle.quoteLines.map((l) => l.id)),
      quotes: new Set(bundle.quotes.map((q) => q.id)),
    }

    await deleteByIds(supabase, "rfq_submissions", dbSubmissions.map((r) => r.id).filter((id) => !keep.submissions.has(id)))
    await deleteByIds(supabase, "rfq_invitations", dbInvitations.map((r) => r.id).filter((id) => !keep.invitations.has(id)))
    await deleteByIds(supabase, "rfq_lines", dbRfqLines.map((r) => r.id).filter((id) => !keep.rfqLines.has(id)))
    await deleteByIds(supabase, "rfqs", dbRfqs.map((r) => r.id).filter((id) => !keep.rfqs.has(id)))
    await deleteByIds(supabase, "rfq_campaigns", dbCampaigns.map((r) => r.id).filter((id) => !keep.campaigns.has(id)))
    await deleteByIds(supabase, "customer_packages", dbPackages.map((r) => r.id).filter((id) => !keep.packages.has(id)))
    await deleteByIds(supabase, "quote_lines", dbLines.map((r) => r.id).filter((id) => !keep.lines.has(id)))
    await deleteByIds(supabase, "quotes", dbQuotes.map((r) => r.id).filter((id) => !keep.quotes.has(id)))
  }
}
