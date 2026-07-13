const INVALID = /[:\\/?*\[\]]/g

/** Excel lapnév — max 31 karakter, tiltott karakterek nélkül. */
export function sanitizeSheetName(raw: string, used: Set<string>): string {
  let base = raw
    .replace(INVALID, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!base) base = "Szakag"
  if (base.length > 31) base = base.slice(0, 31).trim()

  let name = base
  let n = 2
  while (used.has(name)) {
    const suffix = ` (${n})`
    const maxBase = 31 - suffix.length
    name = `${base.slice(0, Math.max(1, maxBase)).trim()}${suffix}`
    n += 1
  }
  used.add(name)
  return name
}

/** Lapnév idézőjelben cross-sheet formulákhoz. */
export function quoteSheetRef(sheetName: string, cell: string): string {
  const escaped = sheetName.replace(/'/g, "''")
  return `'${escaped}'!${cell}`
}
