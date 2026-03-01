import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getTenantSupabase } from './tenant-supabase'

/**
 * Get Supabase Server Client
 * 
 * This function now uses tenant-aware Supabase client.
 * It automatically gets the tenant context from session and connects to the tenant's database.
 * 
 * For backward compatibility, if tenant context is not found, it falls back to default Supabase connection.
 */
export const supabaseServer = async () => {
  try {
    // Try to get tenant-aware Supabase client
    return await getTenantSupabase()
  } catch (error) {
    // Fallback to default Supabase connection if tenant context not found
    // This allows the system to work during migration period
    console.warn('Tenant context not found, falling back to default Supabase connection:', error)
    
    const cookieStore = await cookies()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    // Support both ANON_KEY and PUBLISHABLE_DEFAULT_KEY (newer Supabase versions)
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing Supabase environment variables! ' +
        'Please check your .env.local file in the shop-portal folder. ' +
        'Make sure NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY are set.'
      )
    }

    return createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set(name, value, options)
            } catch (error) {
              // The `set` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 })
            } catch (error) {
              // The `delete` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )
  }
}
