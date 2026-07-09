import type { Client } from "@/types/clients"
import type { ClientWriteInput } from "@/lib/clients/client-map"
import { normalizeClientCode } from "@/lib/clients/client-map"

export function validateClientInput(
  input: ClientWriteInput,
  context: {
    existing: Client[]
    editingId?: string
  }
): { ok: true } | { ok: false; error: string } {
  const code = normalizeClientCode(input.code)
  if (!code || code.length < 2) {
    return { ok: false, error: "Az ügyfélkód legalább 2 karakter (pl. kovacs-anna)." }
  }

  if (!input.legalName?.trim()) {
    return { ok: false, error: "A név kötelező." }
  }

  if (input.clientType === "company" && !input.taxNumber?.trim()) {
    return { ok: false, error: "Cégnél az adószám kötelező." }
  }

  const codeHit = context.existing.find(
    (c) => c.id !== context.editingId && c.code.toLowerCase() === code
  )
  if (codeHit) {
    return { ok: false, error: `Már létezik ügyfél ezzel a kóddal: ${codeHit.displayName}` }
  }

  const tax = input.taxNumber?.trim()
  if (tax) {
    const taxHit = context.existing.find(
      (c) => c.id !== context.editingId && c.taxNumber === tax
    )
    if (taxHit) {
      return { ok: false, error: `Már létezik ügyfél ezzel az adószámmal: ${taxHit.displayName}` }
    }
  }

  return { ok: true }
}
