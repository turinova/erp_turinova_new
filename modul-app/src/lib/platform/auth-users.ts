import type { SupabaseClient, User } from '@supabase/supabase-js'

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

export function lastSignInMap(users: User[]): Map<string, string | null> {
  return new Map(users.map((u) => [u.id, u.last_sign_in_at ?? null]))
}
