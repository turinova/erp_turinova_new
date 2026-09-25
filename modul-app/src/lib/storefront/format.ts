const huf = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 })

export function formatFt(value: number): string {
  return `${huf.format(Math.round(value))} Ft`
}
