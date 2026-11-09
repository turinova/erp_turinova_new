/**
 * In-memory rate limit for partner password claim (first-login).
 * Best-effort on serverless (per-instance); still blocks bursts on one node.
 */

const WINDOW_MS = 60 * 60 * 1000
const MAX_ATTEMPTS = 5

type Bucket = { timestamps: number[] }

const byKey = new Map<string, Bucket>()

function prune(bucket: Bucket, now: number) {
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS)
}

function getBucket(key: string): Bucket {
  let bucket = byKey.get(key)
  if (!bucket) {
    bucket = { timestamps: [] }
    byKey.set(key, bucket)
  }
  return bucket
}

/** True if all keys are under the limit; records one attempt on each key. */
export function allowPartnerPasswordClaim(keys: string[]): boolean {
  const now = Date.now()
  const buckets = keys.map((key) => {
    const bucket = getBucket(key)
    prune(bucket, now)
    return bucket
  })

  if (buckets.some((b) => b.timestamps.length >= MAX_ATTEMPTS)) {
    return false
  }

  for (const bucket of buckets) {
    bucket.timestamps.push(now)
  }
  return true
}

export function partnerClaimRateLimitMessage(): string {
  return 'Túl sok próbálkozás. Várj egy órát, vagy kérj segítséget a bolttól.'
}
