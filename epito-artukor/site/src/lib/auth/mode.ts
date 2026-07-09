import { isSupabaseConfigured } from "@/lib/supabase/env"
import { SESSION_COOKIE, parseSessionCookie } from "@/lib/auth/session"
import type { NextRequest } from "next/server"

/** Mock session ellenőrzés (Supabase nélküli mód) */
export function hasMockSession(request: NextRequest): boolean {
  if (isSupabaseConfigured()) return false
  return Boolean(parseSessionCookie(request.cookies.get(SESSION_COOKIE)?.value))
}

export function isAuthenticated(request: NextRequest, supabaseUserId: string | null): boolean {
  if (isSupabaseConfigured()) {
    return Boolean(supabaseUserId)
  }
  return hasMockSession(request)
}
