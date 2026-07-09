export function normalizeTradeCodeInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32)
}

export function isValidTradeCode(code: string): boolean {
  return /^[a-z][a-z0-9_-]{1,31}$/.test(code)
}

export function validateNewTradeInput(
  code: string,
  name: string,
  existingCodes: string[]
): { ok: true; code: string; name: string } | { ok: false; error: string } {
  const normalizedCode = normalizeTradeCodeInput(code)
  const normalizedName = name.trim()

  if (!normalizedCode) {
    return { ok: false, error: "Add meg a szakág kódját (pl. burkolas)." }
  }
  if (!isValidTradeCode(normalizedCode)) {
    return {
      ok: false,
      error: "A kód 2–32 karakter, kisbetű, szám, _ vagy - lehet (betűvel kezdődjön).",
    }
  }
  if (!normalizedName) {
    return { ok: false, error: "Add meg a szakág megnevezését." }
  }
  if (existingCodes.some((c) => c.toLowerCase() === normalizedCode)) {
    return { ok: false, error: "Már létezik szakág ezzel a kóddal." }
  }

  return { ok: true, code: normalizedCode, name: normalizedName }
}
