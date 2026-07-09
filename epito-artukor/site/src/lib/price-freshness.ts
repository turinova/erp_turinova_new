export type PriceFreshness = "fresh" | "aging" | "stale"

export function getPriceFreshness(updatedAt: string): PriceFreshness {
  const days = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (days < 90) return "fresh"
  if (days < 180) return "aging"
  return "stale"
}

export function formatRelativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return "ma"
  if (days === 1) return "tegnap"
  if (days < 30) return `${days} napja`
  if (days < 365) return `${Math.floor(days / 30)} hónapja`
  return `${Math.floor(days / 365)} éve`
}

export const freshnessClass: Record<PriceFreshness, string> = {
  fresh: "text-emerald-600",
  aging: "text-amber-600",
  stale: "text-red-600",
}
