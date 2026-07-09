/** Egyszerű szöveges parser gyors K-tétel / AI-asszisztens nélkül */
export type ParsedQuickItem = {
  text: string
  materialUnitPrice: number
  laborUnitPrice: number
  unitHint?: string
}

export function parseQuickItemText(input: string): ParsedQuickItem {
  const text = input.trim()
  let material = 0
  let labor = 0
  let unitHint: string | undefined

  const unitMatch = text.match(/\b(m2|m²|m3|m³|klt|db|fm|m|óra)\b/i)
  if (unitMatch) unitHint = unitMatch[1].toLowerCase().replace("m²", "m2").replace("m³", "m3")

  const anyagMatch = text.match(/anyag[:\s]*(\d[\d\s]*)/i)
  const dijMatch = text.match(/d[ií]j[:\s]*(\d[\d\s]*)/i)
  if (anyagMatch) material = Number(anyagMatch[1].replace(/\s/g, ""))
  if (dijMatch) labor = Number(dijMatch[1].replace(/\s/g, ""))

  if (!anyagMatch && !dijMatch) {
    const numbers = [...text.matchAll(/(\d[\d\s]{2,})/g)].map((m) =>
      Number(m[1].replace(/\s/g, ""))
    )
    if (numbers.length >= 2) {
      material = numbers[numbers.length - 2]
      labor = numbers[numbers.length - 1]
    } else if (numbers.length === 1) {
      labor = numbers[0]
    }
  }

  const cleanText = text
    .replace(/anyag[:\s]*\d[\d\s]*/gi, "")
    .replace(/d[ií]j[:\s]*\d[\d\s]*/gi, "")
    .replace(/\b(m2|m²|m3|m³|klt|db|fm|m|óra)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()

  return {
    text: cleanText || text,
    materialUnitPrice: material,
    laborUnitPrice: labor,
    unitHint,
  }
}
