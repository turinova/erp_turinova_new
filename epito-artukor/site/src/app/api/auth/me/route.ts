import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { parseSessionCookie, SESSION_COOKIE } from "@/lib/auth/session"
import { buildAuthSession } from "@/lib/auth/supabase-auth"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ user: null, organization: null }, { status: 401 })
    }

    const session = await buildAuthSession(supabase, user.id, user.email ?? "")
    return NextResponse.json({
      mode: "supabase",
      user: session.user,
      organization: session.organization,
    })
  }

  const cookieStore = await cookies()
  const mockSession = parseSessionCookie(cookieStore.get(SESSION_COOKIE)?.value)
  if (!mockSession) {
    return NextResponse.json({ user: null, organization: null }, { status: 401 })
  }

  return NextResponse.json({
    mode: "mock",
    user: mockSession.user,
    organization: null,
  })
}
