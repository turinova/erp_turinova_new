import type { Subcontractor } from "@/types/subcontractors"
import type { SubcontractorWriteInput } from "@/lib/subcontractors/subcontractor-map"
import { normalizeSubcontractorCode } from "@/lib/subcontractors/subcontractor-map"
import type { Trade } from "@/types"

export function validateSubcontractorInput(
  input: SubcontractorWriteInput,
  context: {
    existing: Subcontractor[]
    tradeCodes: Trade[]
    editingId?: string
  }
): { ok: true } | { ok: false; error: string } {
  const code = normalizeSubcontractorCode(input.code)
  if (!code || code.length < 2) {
    return { ok: false, error: "A partnerkód legalább 2 karakter (pl. klima-pro)." }
  }

  if (!input.legalName?.trim()) {
    return { ok: false, error: "A cég neve kötelező." }
  }

  if (!input.trades?.length) {
    return { ok: false, error: "Legalább egy szakág kötelező." }
  }

  for (const trade of input.trades) {
    if (!context.tradeCodes.includes(trade)) {
      return { ok: false, error: `Érvénytelen szakág: ${trade}` }
    }
  }

  const codeHit = context.existing.find(
    (s) => s.id !== context.editingId && s.code.toLowerCase() === code
  )
  if (codeHit) {
    return { ok: false, error: `Már létezik partner ezzel a kóddal: ${codeHit.displayName}` }
  }

  const tax = input.taxNumber?.trim()
  if (tax) {
    const taxHit = context.existing.find(
      (s) => s.id !== context.editingId && s.taxNumber === tax
    )
    if (taxHit) {
      return { ok: false, error: `Már létezik partner ezzel az adószámmal: ${taxHit.displayName}` }
    }
  }

  return { ok: true }
}
