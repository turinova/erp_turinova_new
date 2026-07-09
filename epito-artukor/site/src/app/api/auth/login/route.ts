import { NextResponse } from "next/server"
import { buildAuthSession } from "@/lib/auth/supabase-auth"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string }
    const email = body.email?.trim() ?? ""
    const password = body.password ?? ""

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Add meg az e-mail címet és a jelszót." },
        { status: 400 }
      )
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase nincs beállítva (.env.local) — a bejelentkezés nem elérhető." },
        { status: 503 }
      )
    }

    {
      const supabase = await createSupabaseServerClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      })

      if (error || !data.user) {
        const devDetail =
          process.env.NODE_ENV === "development" && error?.message
            ? ` (${error.message})`
            : ""
        return NextResponse.json(
          { success: false, error: `Hibás e-mail vagy jelszó.${devDetail}` },
          { status: 401 }
        )
      }

      const session = await buildAuthSession(
        supabase,
        data.user.id,
        data.user.email ?? email
      )

      if (!session.organization) {
        await supabase.auth.signOut()
        return NextResponse.json(
          {
            success: false,
            error:
              "A fiók nincs céghez rendelve. Futtasd a supabase SQL-ben a membership insertet.",
          },
          { status: 403 }
        )
      }

      return NextResponse.json({
        success: true,
        mode: "supabase",
        user: session.user,
        organization: session.organization,
      })
    }
  } catch {
    return NextResponse.json({ success: false, error: "Bejelentkezés sikertelen." }, { status: 500 })
  }
}
