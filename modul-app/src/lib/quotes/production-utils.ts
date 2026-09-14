/** Client-safe date helpers for production assignment (not a server action file). */

function nextBusinessDay(from = new Date()): string {
  const d = new Date(from)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1)
  }
  return d.toISOString().slice(0, 10)
}

export function defaultProductionDateIso(): string {
  return nextBusinessDay()
}

export function normalizeBarcode(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^\x20-\x7E]/g, '')
}
