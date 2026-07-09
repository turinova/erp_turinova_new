import type { Client, ClientFilters, ClientInput } from "@/types/clients"
import { normalizeClientCode } from "@/lib/clients/client-map"

/** In-memory cache — a DB (/api/clients) az egyetlen forrás, a primer tölti fel. */
let clientsCache: Client[] = []

export function setClientsCache(items: Client[]): void {
  clientsCache = items
}

export function loadClients(): Client[] {
  return clientsCache
}

export function listClients(filters: ClientFilters = {}): Client[] {
  let rows = loadClients()

  if (filters.status && filters.status !== "all") {
    rows = rows.filter((c) => c.status === filters.status)
  }
  if (filters.clientType && filters.clientType !== "all") {
    rows = rows.filter((c) => c.clientType === filters.clientType)
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase()
    rows = rows.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.legalName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.taxNumber?.includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    )
  }

  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName, "hu"))
}

export function getClientByCode(code: string): Client | undefined {
  const normalized = normalizeClientCode(code)
  return loadClients().find((c) => c.code.toLowerCase() === normalized)
}

export function getClient(idOrCode: string): Client | undefined {
  const byId = loadClients().find((c) => c.id === idOrCode)
  if (byId) return byId
  return getClientByCode(idOrCode)
}

export function findClientByName(name: string): Client | undefined {
  const q = name.trim().toLowerCase()
  if (!q) return undefined
  return loadClients().find(
    (c) =>
      c.displayName.toLowerCase() === q ||
      c.legalName.toLowerCase() === q ||
      c.displayName.toLowerCase().includes(q) ||
      c.legalName.toLowerCase().includes(q)
  )
}

export function checkClientDuplicates(
  input: { displayName: string; taxNumber?: string; code?: string },
  editingId?: string
): string | null {
  const list = loadClients()
  const code = input.code ? normalizeClientCode(input.code) : ""
  if (code) {
    const hit = list.find((c) => c.id !== editingId && c.code.toLowerCase() === code)
    if (hit) return `Már létezik ügyfél ezzel a kóddal: ${hit.displayName}`
  }
  const tax = input.taxNumber?.trim()
  if (tax) {
    const hit = list.find((c) => c.id !== editingId && c.taxNumber === tax)
    if (hit) return `Már létezik ügyfél ezzel az adószámmal: ${hit.displayName}`
  }
  return null
}

export function clientToInput(client: Client): ClientInput {
  return {
    code: client.code,
    clientType: client.clientType,
    legalName: client.legalName,
    displayName: client.displayName,
    taxNumber: client.taxNumber,
    companyRegNumber: client.companyRegNumber,
    email: client.email,
    phone: client.phone,
    website: client.website,
    billingAddress: { ...client.billingAddress },
    useSeparateMailingAddress: client.useSeparateMailingAddress,
    mailingAddress: client.mailingAddress ? { ...client.mailingAddress } : null,
    defaultVatMode: client.defaultVatMode,
    defaultPaymentTerms: client.defaultPaymentTerms,
    status: client.status,
    tags: [...client.tags],
    internalNotes: client.internalNotes,
    contacts: client.contacts.map((c) => ({ ...c })),
  }
}
