import type { AuthUser } from "@/lib/auth/types"

const CLIENT_AUTH_USER_KEY = "epito-artukor:auth-user"

export function persistClientAuthUser(user: AuthUser): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CLIENT_AUTH_USER_KEY, JSON.stringify(user))
  } catch {
    /* ignore */
  }
}

export function clearClientAuthUser(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(CLIENT_AUTH_USER_KEY)
  } catch {
    /* ignore */
  }
}

export function readClientAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CLIENT_AUTH_USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthUser
    if (!parsed?.id || !parsed?.email) return null
    return parsed
  } catch {
    return null
  }
}
