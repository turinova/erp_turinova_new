import type { AuthUser, LegacyMockSession } from "@/lib/auth/types"

export const SESSION_COOKIE = "epito-artukor-session"

export function parseSessionCookie(value: string | undefined): LegacyMockSession | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as LegacyMockSession
    if (!parsed?.user?.id || !parsed?.user?.email) return null
    return parsed
  } catch {
    return null
  }
}

export function serializeSession(session: LegacyMockSession): string {
  return JSON.stringify(session)
}

export type { AuthUser }
