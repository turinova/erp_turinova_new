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

/**
 * Egy mondatos összehasonlítás, amit bárki ért:
 * „▲ 12%-kal több, mint tegnap ilyenkor”.
 */
export function formatCompareSentence(
  current: number,
  baseline: number,
  against: string
): { text: string; tone: 'muted' | 'success' | 'warning' } {
  if (baseline <= 0 && current <= 0) {
    return { text: `Még nincs rendelés, ${against} sem volt.`, tone: 'muted' }
  }
  if (baseline <= 0) {
    return { text: `▲ Több, mint ${against} (akkor még 0 Ft)`, tone: 'success' }
  }
  const pct = Math.round(((current - baseline) / baseline) * 100)
  if (pct === 0) return { text: `Ugyanannyi, mint ${against}`, tone: 'muted' }
  const n = new Intl.NumberFormat('hu-HU').format(Math.abs(pct))
  return pct > 0
    ? { text: `▲ ${n}%-kal több, mint ${against}`, tone: 'success' }
    : { text: `▼ ${n}%-kal kevesebb, mint ${against}`, tone: 'warning' }
}

export type Delta = { text: string; tone: 'muted' | 'success' | 'warning' }

/**
 * Kezdőlap delta: „▲ 18% · +158 000 Ft”. ±2% alatt „≈ ugyanannyi” (szürke),
 * nincs bázis → „Nincs összevetési adat”. Soha nem ír „+∞%”-ot.
 */
export function formatDelta(
  current: number,
  baseline: number | null,
  formatAbs?: (n: number) => string
): Delta {
  if (baseline == null) return { text: 'Nincs összevetési adat', tone: 'muted' }
  const diff = current - baseline
  const abs = formatAbs ? ` · ${diff >= 0 ? '+' : '−'}${formatAbs(Math.abs(diff))}` : ''
  if (baseline <= 0) {
    return current > 0
      ? { text: `▲ ${formatAbs ? formatAbs(current) : 'több'} (akkor 0)`, tone: 'success' }
      : { text: '≈ ugyanannyi', tone: 'muted' }
  }
  const pct = (diff / baseline) * 100
  if (Math.abs(pct) < 2) return { text: '≈ ugyanannyi', tone: 'muted' }
  const n = new Intl.NumberFormat('hu-HU').format(Math.round(Math.abs(pct)))
  return pct > 0
    ? { text: `▲ ${n}%${abs}`, tone: 'success' }
    : { text: `▼ ${n}%${abs}`, tone: 'warning' }
}

/** „10:42” Budapest idő szerint. */
export function formatClock(ms: number): string {
  return new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(ms))
}

export function formatMeters(n: number): string {
  return `${new Intl.NumberFormat('hu-HU').format(Math.round(n))} m`
}

export function formatCount(n: number, unit: string): string {
  return `${new Intl.NumberFormat('hu-HU').format(n)} ${unit}`
}

export function deltaBadgeTone(
  pct: number | null
): 'default' | 'success' | 'warning' {
  if (pct == null) return 'default'
  if (pct >= 0) return 'success'
  return 'warning'
}
