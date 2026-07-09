export type AuthUser = {
  id: string
  email: string
  displayName: string
}

export type AuthOrganization = {
  id: string
  name: string
  slug: string
  role: string
}

export type AuthSession = {
  user: AuthUser
  organization: AuthOrganization | null
}

/** @deprecated Mock auth — csak Supabase nélküli fejlesztéshez */
export type LegacyMockSession = {
  user: AuthUser
}
