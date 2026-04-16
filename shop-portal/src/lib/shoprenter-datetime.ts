/**
 * ShopRenter rejects PostgreSQL-style timestamps in query params (e.g. space instead of T,
 * fractional seconds, timezone). Error 40009 expects: "1990-01-01T00:00:00"
 */
export function toShopRenterUpdatedAfterParam(value: string | null | undefined): string | null {
  if (value == null || String(value).trim() === '') return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}
