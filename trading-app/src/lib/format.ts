export function formatR(r: number | null): string {
  if (r == null) return "—"
  const sign = r > 0 ? "+" : ""
  return `${sign}${r.toFixed(2)}R`
}

export function formatPrice(p: number | null): string {
  if (p == null) return "—"
  return p.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatDateHu(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

export function formatTimeEt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/New_York",
  })
}
