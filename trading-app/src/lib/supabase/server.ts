import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/** Szerver-oldali Supabase kliens (server components, route handlers). */
export async function createSupabaseServer() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component-ből hívva nem írhat cookie-t — a middleware frissíti a sessiont.
          }
        },
      },
    }
  )
}
