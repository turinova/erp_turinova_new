import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import type { SupabaseClient } from "@supabase/supabase-js"
import { buildAuthSession } from "@/lib/auth/supabase-auth"
import { parseSessionCookie, SESSION_COOKIE } from "@/lib/auth/session"
import type { AuthOrganization, AuthUser } from "@/lib/auth/types"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type SupabaseApiSession = {
  ok: true
  mode: "supabase"
  supabase: SupabaseClient
  user: AuthUser
  organization: AuthOrganization
}

type MockApiSession = {
  ok: true
  mode: "mock"
  user: AuthUser
  organization: null
}

type ApiSessionError = {
  ok: false
  response: NextResponse
}

export type ApiSession = SupabaseApiSession | MockApiSession

export async function requireApiSession(): Promise<ApiSession | ApiSessionError> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 }),
      }
    }

    const session = await buildAuthSession(supabase, user.id, user.email ?? "")
    if (!session.organization) {
      return {
        ok: false,
        response: NextResponse.json({ error: "A fiók nincs céghez rendelve." }, { status: 403 }),
      }
    }

    return {
      ok: true,
      mode: "supabase",
      supabase,
      user: session.user,
      organization: session.organization,
    }
  }

  const cookieStore = await cookies()
  const mockSession = parseSessionCookie(cookieStore.get(SESSION_COOKIE)?.value)
  if (!mockSession) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 }),
    }
  }

  return {
    ok: true,
    mode: "mock",
    user: mockSession.user,
    organization: null,
  }
}
