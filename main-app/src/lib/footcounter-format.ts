const MONTH_LABEL_FMT = new Intl.DateTimeFormat('hu-HU', { month: 'short', year: '2-digit' })

/** `2026-06` → `2026. jún.` */
export function formatMonthKeyLabel(monthKey: string): string {
  const m = /^([0-9]{4})-([0-9]{2})$/.exec(monthKey)
  if (!m) return monthKey
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, 1)
  return MONTH_LABEL_FMT.format(d)
}

export function last12MonthKeys(timeZone: string): string[] {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' })
  const base = new Date()
  const out: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(base)
    d.setMonth(base.getMonth() - i)
    const key = fmt.format(d)
    if (!out.includes(key)) out.push(key)
  }
  return out
}

export function formatAvg(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n >= 10 ? Math.round(n).toLocaleString('hu-HU') : n.toFixed(1)
}

export function pctVsAvg(today: number, avg: number): string | null {
  if (avg <= 0 || !Number.isFinite(avg)) return null
  const p = Math.round((today / avg - 1) * 100)
  if (p === 0) return '≈ átlag'
  return p > 0 ? `+${p}% az átlaghoz` : `${p}% az átlaghoz`
}
