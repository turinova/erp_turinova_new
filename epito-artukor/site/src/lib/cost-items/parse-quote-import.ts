import { parseQuickItemText } from "@/lib/parse-quick-text"
import type { QuoteImportInputRow } from "@/lib/cost-items/quote-import-types"

const SKIP_LINE_PATTERNS = [
  /^összesen\s*:?\s*$/i,
  /^no\.?$/i,
  /^azonosító$/i,
  /^mennyiség$/i,
  /^egys\.?$/i,
  /^szöveg$/i,
  /^---\s*.+\s*---$/,
]

function parseHuNumber(value: string): number | null {
  const trimmed = value.trim().replace(/\s/g, "").replace(",", ".")
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeUnitHint(value: string | undefined): string | null {
  if (!value?.trim()) return null
  return value.trim().toLowerCase().replace("m²", "m2").replace("m³", "m3")
}

function shouldSkipLine(trimmed: string): boolean {
  if (!trimmed) return true
  return SKIP_LINE_PATTERNS.some((pattern) => pattern.test(trimmed))
}

/** Soronkénti beillesztés: egy sor = egy tétel. Opcionális TAB: szöveg, mennyiség, ME */
export function parseQuoteImportText(input: string): QuoteImportInputRow[] {
  const lines = input.split(/\r?\n/)
  const result: QuoteImportInputRow[] = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (shouldSkipLine(trimmed)) continue

    const parts = trimmed.split("\t")
    const textPart = parts[0]?.trim() ?? ""
    if (!textPart) continue

    const parsed = parseQuickItemText(textPart)
    const quantityFromTab = parts[1] ? parseHuNumber(parts[1]) : null
    const unitFromTab = normalizeUnitHint(parts[2])

    result.push({
      lineNumber: i + 1,
      rawInput: trimmed,
      text: parsed.text || textPart,
      quantity: quantityFromTab ?? 1,
      unitHint: unitFromTab ?? parsed.unitHint ?? null,
      identifierHint: null,
    })
  }

  return result
}
