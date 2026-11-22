/** Magyar Ft megjelenítés (certainty: egység a szám mellett). */

export function formatFt(n: number): string {
  const v = Math.round(Number(n) || 0)
  return `${new Intl.NumberFormat('hu-HU').format(v)} Ft`
}

export function formatCompactFt(n: number): string {
  const v = Math.round(Number(n) || 0)
  if (Math.abs(v) >= 1_000_000) {
    const m = v / 1_000_000
    return `${new Intl.NumberFormat('hu-HU', {
      maximumFractionDigits: 1
    }).format(m)} M Ft`
  }
  if (Math.abs(v) >= 10_000) {
    const k = Math.round(v / 1000)
    return `${new Intl.NumberFormat('hu-HU').format(k)} e Ft`
  }
  return formatFt(v)
}

export function formatPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 0
  }).format(n)}%`
}

/** Toast/Shopify-style: badge = vs tegnap; hint záradék = vs múlt hét. */
export function formatVsYesterdayBadge(pct: number | null): string | undefined {
  if (pct == null) return undefined
  return formatPct(pct)
}

export function formatVsLastWeekHint(pct: number | null): string | null {
  if (pct == null) return null
  return `múlt hét ${formatPct(pct)}`
}

export function deltaBadgeTone(
  pct: number | null
): 'default' | 'success' | 'warning' {
  if (pct == null) return 'default'
  if (pct >= 0) return 'success'
  return 'warning'
}
