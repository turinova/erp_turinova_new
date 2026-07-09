import { parseQuickItemText } from "@/lib/parse-quick-text"

export type ParsedPasteLine = {
  lineNumber: number
  raw: string
  text: string
  materialUnitPrice: number
  laborUnitPrice: number
  unitHint?: string
}

/** Soronkénti beillesztés: egy sor = egy tétel neve. Ár nem kell — mindig 0/0. */
export function parsePasteImportText(input: string): ParsedPasteLine[] {
  const lines = input.split(/\r?\n/)
  const result: ParsedPasteLine[] = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!trimmed) continue

    const parsed = parseQuickItemText(trimmed)

    result.push({
      lineNumber: i + 1,
      raw: trimmed,
      text: parsed.text || trimmed,
      materialUnitPrice: 0,
      laborUnitPrice: 0,
      unitHint: parsed.unitHint,
    })
  }

  return result
}
