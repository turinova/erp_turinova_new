import type { SupabaseClient } from "@supabase/supabase-js"
import type { Subcontractor, SubcontractorContact, SubcontractorReference } from "@/types/subcontractors"
import type { Trade } from "@/types"
import { fetchOrgTrades } from "@/lib/cost-items/cost-items-repository"
import {
  assembleSubcontractor,
  mapContactRow,
  mapReferenceRow,
  SUBCONTRACTOR_CONTACT_SELECT,
  SUBCONTRACTOR_REFERENCE_SELECT,
  SUBCONTRACTOR_SELECT,
  type SubcontractorContactRow,
  type SubcontractorReferenceRow,
  type SubcontractorRow,
  type SubcontractorWriteInput,
} from "@/lib/subcontractors/subcontractor-map"

async function fetchTradeMaps(supabase: SupabaseClient, organizationId: string) {
  const trades = await fetchOrgTrades(supabase, organizationId)
  const idByCode = new Map(trades.map((t) => [t.code, t.id]))
  const codeById = new Map(trades.map((t) => [t.id, t.code]))
  return { trades, idByCode, codeById }
}

async function fetchSubcontractorTrades(
  supabase: SupabaseClient,
  subcontractorIds: string[],
  codeById: Map<string, Trade>
): Promise<Map<string, Trade[]>> {
  if (!subcontractorIds.length) return new Map()

  const { data, error } = await supabase
    .from("subcontractor_trades")
    .select("subcontractor_id, trade_id")
    .in("subcontractor_id", subcontractorIds)

  if (error) throw error

  const result = new Map<string, Trade[]>()
  for (const row of data ?? []) {
    const trade = codeById.get(row.trade_id as string)
    if (!trade) continue
    const list = result.get(row.subcontractor_id as string) ?? []
    list.push(trade)
    result.set(row.subcontractor_id as string, list)
  }
  return result
}

async function fetchContactsForSubs(
  supabase: SupabaseClient,
  subcontractorIds: string[]
): Promise<Map<string, SubcontractorContact[]>> {
  if (!subcontractorIds.length) return new Map()

  const { data, error } = await supabase
    .from("subcontractor_contacts")
    .select(SUBCONTRACTOR_CONTACT_SELECT)
    .in("subcontractor_id", subcontractorIds)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })

  if (error) throw error

  const result = new Map<string, SubcontractorContact[]>()
  for (const row of (data ?? []) as SubcontractorContactRow[]) {
    const list = result.get(row.subcontractor_id) ?? []
    list.push(mapContactRow(row))
    result.set(row.subcontractor_id, list)
  }
  return result
}

async function fetchReferencesForSubs(
  supabase: SupabaseClient,
  subcontractorIds: string[],
  codeById: Map<string, Trade>
): Promise<Map<string, SubcontractorReference[]>> {
  if (!subcontractorIds.length) return new Map()

  const { data, error } = await supabase
    .from("subcontractor_references")
    .select(SUBCONTRACTOR_REFERENCE_SELECT)
    .in("subcontractor_id", subcontractorIds)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })

  if (error) throw error

  const result = new Map<string, SubcontractorReference[]>()
  for (const row of (data ?? []) as SubcontractorReferenceRow[]) {
    const list = result.get(row.subcontractor_id) ?? []
    list.push(mapReferenceRow(row, codeById))
    result.set(row.subcontractor_id, list)
  }
  return result
}

export async function fetchOrgSubcontractors(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Subcontractor[]> {
  const { data, error } = await supabase
    .from("subcontractors")
    .select(SUBCONTRACTOR_SELECT)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("display_name", { ascending: true })

  if (error) throw error

  const rows = (data ?? []) as SubcontractorRow[]
  const ids = rows.map((r) => r.id)
  const { codeById } = await fetchTradeMaps(supabase, organizationId)

  const [tradesBySub, contactsBySub, refsBySub] = await Promise.all([
    fetchSubcontractorTrades(supabase, ids, codeById),
    fetchContactsForSubs(supabase, ids),
    fetchReferencesForSubs(supabase, ids, codeById),
  ])

  return rows.map((row) =>
    assembleSubcontractor(
      row,
      tradesBySub.get(row.id) ?? [],
      contactsBySub.get(row.id) ?? [],
      refsBySub.get(row.id) ?? []
    )
  )
}

export async function fetchSubcontractorById(
  supabase: SupabaseClient,
  organizationId: string,
  id: string
): Promise<Subcontractor | null> {
  const { data, error } = await supabase
    .from("subcontractors")
    .select(SUBCONTRACTOR_SELECT)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<SubcontractorRow>()

  if (error) throw error
  if (!data) return null

  const { codeById } = await fetchTradeMaps(supabase, organizationId)
  const [tradesBySub, contactsBySub, refsBySub] = await Promise.all([
    fetchSubcontractorTrades(supabase, [data.id], codeById),
    fetchContactsForSubs(supabase, [data.id]),
    fetchReferencesForSubs(supabase, [data.id], codeById),
  ])

  return assembleSubcontractor(
    data,
    tradesBySub.get(data.id) ?? [],
    contactsBySub.get(data.id) ?? [],
    refsBySub.get(data.id) ?? []
  )
}

export async function fetchSubcontractorByCode(
  supabase: SupabaseClient,
  organizationId: string,
  code: string
): Promise<Subcontractor | null> {
  const { data, error } = await supabase
    .from("subcontractors")
    .select(SUBCONTRACTOR_SELECT)
    .eq("organization_id", organizationId)
    .ilike("code", code)
    .is("deleted_at", null)
    .maybeSingle<SubcontractorRow>()

  if (error) throw error
  if (!data) return null
  return fetchSubcontractorById(supabase, organizationId, data.id)
}

export async function syncSubcontractorRelations(
  supabase: SupabaseClient,
  organizationId: string,
  subcontractorId: string,
  input: SubcontractorWriteInput
): Promise<void> {
  const { idByCode } = await fetchTradeMaps(supabase, organizationId)

  await supabase.from("subcontractor_trades").delete().eq("subcontractor_id", subcontractorId)

  const tradeRows = input.trades
    .map((code) => idByCode.get(code))
    .filter((id): id is string => Boolean(id))
    .map((tradeId) => ({ subcontractor_id: subcontractorId, trade_id: tradeId }))

  if (tradeRows.length) {
    const { error } = await supabase.from("subcontractor_trades").insert(tradeRows)
    if (error) throw error
  }

  await supabase
    .from("subcontractor_contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("subcontractor_id", subcontractorId)
    .is("deleted_at", null)

  const contacts = input.contacts ?? []
  if (contacts.length) {
    const { error } = await supabase.from("subcontractor_contacts").insert(
      contacts.map((c, idx) => ({
        subcontractor_id: subcontractorId,
        name: c.name.trim(),
        role: c.role?.trim() || null,
        email: c.email?.trim() || null,
        phone: c.phone?.trim() || null,
        is_primary: c.isPrimary,
        sort_order: idx + 1,
      }))
    )
    if (error) throw error
  }

  await supabase
    .from("subcontractor_references")
    .update({ deleted_at: new Date().toISOString() })
    .eq("subcontractor_id", subcontractorId)
    .is("deleted_at", null)

  const references = input.references ?? []
  if (references.length) {
    const { error } = await supabase.from("subcontractor_references").insert(
      references.map((r, idx) => ({
        subcontractor_id: subcontractorId,
        title: r.title.trim(),
        project_name: r.projectName?.trim() || null,
        trade_id: r.trade ? idByCode.get(r.trade) ?? null : null,
        year: r.year ?? null,
        description: r.description?.trim() || null,
        sort_order: r.sortOrder ?? idx + 1,
      }))
    )
    if (error) throw error
  }
}
