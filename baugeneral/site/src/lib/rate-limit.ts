const hits = new Map<string, number[]>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_HITS = 8

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown"
  return req.headers.get("x-real-ip") || "unknown"
}

export function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const prev = hits.get(key) ?? []
  const recent = prev.filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_HITS) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}
