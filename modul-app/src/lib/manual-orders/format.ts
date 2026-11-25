export function moDaysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d <= 0) return 'ma'
  if (d === 1) return 'tegnap'
  return `${d} napja`
}

export function moDaysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

export function moFmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

export function moFmtDate(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium' }).format(new Date(iso))
}

export function moFmtQty(qty: number): string {
  return qty.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}
