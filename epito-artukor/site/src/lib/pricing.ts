export function calculateTotalUnitPrice(prices: {
  materialUnitPrice: number
  laborUnitPrice: number
}): number {
  return Math.round(prices.materialUnitPrice + prices.laborUnitPrice)
}

export function formatHuf(amount: number): string {
  return new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("hu-HU").format(amount)
}

export function deriveShortLabel(text: string, maxLen = 60): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen - 1)}…`
}
