import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

import { isSupabaseConfigured } from '@/lib/auth/config'

/** Request-scoped Supabase client — ne hozzunk létre újat layout + page között. */
export const createClient = cache(async () => {
  if (!isSupabaseConfigured()) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: {
            name: string
            value: string
            options?: Parameters<typeof cookieStore.set>[2]
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component — middleware frissíti a sessiont.
          }
        }
      }
    }
  )
})
