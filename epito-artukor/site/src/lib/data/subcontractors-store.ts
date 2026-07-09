import type {
  Subcontractor,
  SubcontractorFilters,
} from "@/types/subcontractors"
import { normalizeSubcontractorCode } from "@/lib/subcontractors/subcontractor-map"

/** In-memory cache — a DB (/api/subcontractors) az egyetlen forrás, a primer tölti fel. */
let subcontractorsCache: Subcontractor[] = []

export function setSubcontractorsCache(items: Subcontractor[]): void {
  subcontractorsCache = items
}

export function loadSubcontractors(): Subcontractor[] {
  return subcontractorsCache
}

export function listSubcontractors(filters: SubcontractorFilters = {}): Subcontractor[] {
  let rows = loadSubcontractors()

  if (filters.trade && filters.trade !== "all") {
    rows = rows.filter((s) => s.trades.includes(filters.trade as Subcontractor["trades"][number]))
  }
  if (filters.status && filters.status !== "all") {
    rows = rows.filter((s) => s.status === filters.status)
  }
  if (filters.tier && filters.tier !== "all") {
    rows = rows.filter((s) => s.tier === filters.tier)
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase()
    rows = rows.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        s.legalName.toLowerCase().includes(q) ||
        s.code?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.taxNumber?.includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    )
  }

  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName, "hu"))
}

export function getSubcontractorByCode(code: string): Subcontractor | undefined {
  const normalized = normalizeSubcontractorCode(code)
  return loadSubcontractors().find((s) => s.code?.toLowerCase() === normalized)
}

export function getSubcontractor(idOrCode: string): Subcontractor | undefined {
  const byId = loadSubcontractors().find((s) => s.id === idOrCode)
  if (byId) return byId
  return getSubcontractorByCode(idOrCode)
}

export function findSubcontractorByName(name: string): Subcontractor | undefined {
  const n = name.trim().toLowerCase()
  return loadSubcontractors().find(
    (s) => s.legalName.toLowerCase() === n || s.displayName.toLowerCase() === n
  )
}

export type DuplicateWarning = {
  field: "taxNumber" | "displayName" | "code"
  existingId: string
  existingCode: string
  existingName: string
}

export function checkSubcontractorDuplicates(
  input: { displayName: string; taxNumber?: string; code?: string },
  excludeId?: string,
  rows?: Subcontractor[]
): DuplicateWarning[] {
  const warnings: DuplicateWarning[] = []
  const list = (rows ?? loadSubcontractors()).filter((s) => s.id !== excludeId)

  const code = input.code ? normalizeSubcontractorCode(input.code) : ""
  if (code) {
    const hit = list.find((s) => s.code?.toLowerCase() === code)
    if (hit) {
      warnings.push({ field: "code", existingId: hit.id, existingCode: hit.code, existingName: hit.displayName })
    }
  }

  if (input.taxNumber?.trim()) {
    const tax = input.taxNumber.trim()
    const hit = list.find((s) => s.taxNumber === tax)
    if (hit) {
      warnings.push({
        field: "taxNumber",
        existingId: hit.id,
        existingCode: hit.code,
        existingName: hit.displayName,
      })
    }
  }

  const name = input.displayName.trim().toLowerCase()
  if (name) {
    const hit = list.find(
      (s) =>
        s.displayName.toLowerCase() === name || s.legalName.toLowerCase() === name
    )
    if (hit) {
      warnings.push({
        field: "displayName",
        existingId: hit.id,
        existingCode: hit.code,
        existingName: hit.displayName,
      })
    }
  }

  return warnings
}

/** RFQ meghíváshoz — választható partnerek adott szakágon (inaktív kizárva) */
export function listSubcontractorsForTrade(trade: Subcontractor["trades"][number]): Subcontractor[] {
  return listSubcontractors({ trade }).filter((s) => s.status !== "inactive")
}

export function resolveSubcontractorInviteFields(sub: Subcontractor): {
  subcontractorId: string
  name: string
  phone: string
  email: string
} {
  const primary = sub.contacts.find((c) => c.isPrimary) ?? sub.contacts[0]
  return {
    subcontractorId: sub.id,
    name: sub.legalName,
    phone: primary?.phone ?? sub.phone ?? "",
    email: primary?.email ?? sub.email ?? "",
  }
}
