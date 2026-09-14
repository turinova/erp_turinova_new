import type { SupabaseClient, User } from '@supabase/supabase-js'

const CACHE_TTL_MS = 60_000

type CacheEntry = {
  at: number
  users: User[]
}

let cache: CacheEntry | null = null
let inflight: Promise<User[]> | null = null

/** Auth users — paginált (a 1000-es listUsers limit miatt). */
export async function listAllAuthUsers(
  admin: SupabaseClient,
  maxPages = 20
): Promise<User[]> {
  const all: User[] = []
  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000
    })
    if (error) {
      console.error('listAllAuthUsers', error.message)
      break
    }
    const users = data?.users ?? []
    all.push(...users)
    if (users.length < 1000) break
  }
  return all
}

/**
 * Request + short TTL cache — overview + attention ugyanabban a requestben
 * és ~60s-ig a következő navigációk ne listázzák újra az összes usert.
 */
export async function listAllAuthUsersCached(
  admin: SupabaseClient,
  maxPages = 20
): Promise<User[]> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return cache.users
  }
  if (inflight) return inflight

  inflight = listAllAuthUsers(admin, maxPages)
    .then((users) => {
      cache = { at: Date.now(), users }
      inflight = null
      return users
    })
    .catch((err) => {
      inflight = null
      throw err
    })

  return inflight
}

export function invalidateAuthUsersCache(): void {
  cache = null
  inflight = null
}

export function lastSignInMap(users: User[]): Map<string, string | null> {
  return new Map(users.map((u) => [u.id, u.last_sign_in_at ?? null]))
}

export type AuthUserLite = {
  id: string
  email: string | null
  lastSignInAt: string | null
  emailConfirmed: boolean
  banned: boolean
}

/** Csak a megadott id-kre — tenant detail / audit. */
export async function getAuthUsersByIds(
  admin: SupabaseClient,
  userIds: string[]
): Promise<Map<string, AuthUserLite>> {
  const unique = [...new Set(userIds.filter(Boolean))]
  const out = new Map<string, AuthUserLite>()
  if (unique.length === 0) return out

  // Először cache-ből, ha van
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) {
    for (const id of unique) {
      const u = cache.users.find((x) => x.id === id)
      if (u) {
        out.set(id, toLite(u))
      }
    }
    const missing = unique.filter((id) => !out.has(id))
    if (missing.length === 0) return out
    await fillByIds(admin, missing, out)
    return out
  }

  await fillByIds(admin, unique, out)
  return out
}

async function fillByIds(
  admin: SupabaseClient,
  ids: string[],
  out: Map<string, AuthUserLite>
): Promise<void> {
  const CONCURRENCY = 8
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      chunk.map(async (id) => {
        const { data, error } = await admin.auth.admin.getUserById(id)
        if (error || !data.user) {
          if (error) console.error('getAuthUsersByIds', id, error.message)
          return null
        }
        return toLite(data.user)
      })
    )
    for (const row of results) {
      if (row) out.set(row.id, row)
    }
  }
}

function toLite(u: User): AuthUserLite {
  return {
    id: u.id,
    email: u.email ?? null,
    lastSignInAt: u.last_sign_in_at ?? null,
    emailConfirmed: Boolean(u.email_confirmed_at),
    banned: Boolean(u.banned_until)
  }
}
