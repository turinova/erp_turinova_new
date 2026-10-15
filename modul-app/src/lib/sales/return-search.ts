/** POS visszáru dátum-chipek (lokális nap határok). */

export type ReturnDateWindow = 'today' | 'yesterday' | '7d' | '30d'

export function returnDateWindowRange(
  window: ReturnDateWindow,
  now = new Date()
): { fromIso: string; toIso: string } {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

  if (window === 'today') {
    return {
      fromIso: startOfDay(now).toISOString(),
      toIso: endOfDay(now).toISOString()
    }
  }
  if (window === 'yesterday') {
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    return {
      fromIso: startOfDay(y).toISOString(),
      toIso: endOfDay(y).toISOString()
    }
  }
  const days = window === '7d' ? 7 : 30
  const from = startOfDay(now)
  from.setDate(from.getDate() - (days - 1))
  return { fromIso: from.toISOString(), toIso: endOfDay(now).toISOString() }
}
