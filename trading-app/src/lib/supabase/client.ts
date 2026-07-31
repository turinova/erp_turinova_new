"use client"

import { createBrowserClient } from "@supabase/ssr"

/** Böngésző-oldali Supabase kliens (login, logout). */
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
