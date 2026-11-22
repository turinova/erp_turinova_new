/**
 * Egyszerű memóriás csúszóablak limiter (instance-onként, best effort).
 * Kiosk submit spam ellen; a fő kapu az eszköz token (P1d).
 */
const buckets = new Map<string, number[]>()

export function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): boolean {
  const since = now - windowMs
  const hits = (buckets.get(key) ?? []).filter((t) => t > since)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return true
  }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.some((t) => t > since)) buckets.delete(k)
    }
  }
  return false
}
