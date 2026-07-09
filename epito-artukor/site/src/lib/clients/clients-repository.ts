import type { SupabaseClient } from "@supabase/supabase-js"
import type { Client, ClientContact } from "@/types/clients"
import {
  assembleClient,
  CLIENT_CONTACT_SELECT,
  CLIENT_SELECT,
  mapContactRow,
  type ClientContactRow,
  type ClientRow,
  type ClientWriteInput,
} from "@/lib/clients/client-map"

async function fetchContactsForClients(
  supabase: SupabaseClient,
  clientIds: string[]
): Promise<Map<string, ClientContact[]>> {
  if (!clientIds.length) return new Map()

  const { data, error } = await supabase
    .from("client_contacts")
    .select(CLIENT_CONTACT_SELECT)
    .in("client_id", clientIds)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })

  if (error) throw error

  const result = new Map<string, ClientContact[]>()
  for (const row of (data ?? []) as ClientContactRow[]) {
    const list = result.get(row.client_id) ?? []
    list.push(mapContactRow(row))
    result.set(row.client_id, list)
  }
  return result
}

export async function fetchOrgClients(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("display_name", { ascending: true })

  if (error) throw error

  const rows = (data ?? []) as ClientRow[]
  const ids = rows.map((r) => r.id)
  const contactsByClient = await fetchContactsForClients(supabase, ids)

  return rows.map((row) =>
    assembleClient(row, contactsByClient.get(row.id) ?? [])
  )
}

export async function fetchClientById(
  supabase: SupabaseClient,
  organizationId: string,
  id: string
): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<ClientRow>()

  if (error) throw error
  if (!data) return null

  const contactsByClient = await fetchContactsForClients(supabase, [data.id])
  return assembleClient(data, contactsByClient.get(data.id) ?? [])
}

export async function fetchClientByCode(
  supabase: SupabaseClient,
  organizationId: string,
  code: string
): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("organization_id", organizationId)
    .ilike("code", code)
    .is("deleted_at", null)
    .maybeSingle<ClientRow>()

  if (error) throw error
  if (!data) return null
  return fetchClientById(supabase, organizationId, data.id)
}

export async function syncClientContacts(
  supabase: SupabaseClient,
  clientId: string,
  input: ClientWriteInput
): Promise<void> {
  await supabase
    .from("client_contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .is("deleted_at", null)

  const contacts = input.contacts ?? []
  if (!contacts.length) return

  const { error } = await supabase.from("client_contacts").insert(
    contacts.map((c, idx) => ({
      client_id: clientId,
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
