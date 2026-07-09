import type { SupabaseClient } from "@supabase/supabase-js"
import type { AuthOrganization, AuthSession, AuthUser } from "@/lib/auth/types"

type ProfileRow = {
  display_name: string | null
  email: string
}

type MembershipRow = {
  role: string
  organizations: {
    id: string
    name: string
    slug: string
  } | null
}

export async function buildAuthSession(
  supabase: SupabaseClient,
  userId: string,
  email: string
): Promise<AuthSession> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", userId)
    .maybeSingle<ProfileRow>()

  const displayName =
    profile?.display_name?.trim() ||
    email.split("@")[0] ||
    "Felhasználó"

  const authUser: AuthUser = {
    id: userId,
    email: profile?.email ?? email,
    displayName,
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations ( id, name, slug )")
    .eq("user_id", userId)
    .limit(1)

  const row = (memberships?.[0] ?? null) as MembershipRow | null
  const org = row?.organizations

  const organization: AuthOrganization | null = org
    ? {
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: row.role,
      }
    : null

  return { user: authUser, organization }
}

export function authSessionToAppUser(session: AuthSession): AuthUser {
  return session.user
}
