/**
 * Tenant-aware Supabase Client Management
 * 
 * This module provides functions to get Supabase clients for:
 * 1. Admin Database (for tenant management)
 * 2. Tenant Databases (for tenant-specific operations)
 * 3. Session-based tenant context management
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createBrowserClient } from '@supabase/ssr'

// Types
export interface TenantContext {
  id: string
  name: string
  slug: string
  supabase_url: string
  supabase_anon_key: string
  user_id_in_tenant_db: string
  user_role: string
}

/**
 * Get Admin Supabase Client
 * Used for tenant registry and admin operations
 */
/**
 * Get Admin Supabase client using SERVICE ROLE KEY
 * This bypasses RLS policies and is needed for admin operations
 */
export async function getAdminSupabase() {
  const adminSupabaseUrl = process.env.ADMIN_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const adminServiceRoleKey = process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY

  if (!adminSupabaseUrl) {
    throw new Error(
      'Missing Admin Supabase URL! ' +
      'Please check your .env.local file. ' +
      'Make sure ADMIN_SUPABASE_URL is set.'
    )
  }

  if (!adminServiceRoleKey) {
    throw new Error(
      'Missing Admin Supabase Service Role Key! ' +
      'Please check your .env.local file. ' +
      'Make sure ADMIN_SUPABASE_SERVICE_ROLE_KEY is set. ' +
      'This is required to bypass RLS policies for admin operations.'
    )
  }

  // Use createClient (not createServerClient) with service role key
  // This bypasses RLS and doesn't need cookies
  const { createClient } = await import('@supabase/supabase-js')
  
  return createClient(adminSupabaseUrl, adminServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/**
 * Get Tenant Context from Session/Cookie
 * Returns the tenant information stored in the session
 */
export async function getTenantFromSession(): Promise<TenantContext | null> {
  try {
    // First, try to get from cookie (set during login)
    const cookieStore = await cookies()
    const tenantContextCookie = cookieStore.get('tenant_context')
    
    if (tenantContextCookie) {
      try {
        const tenantContext = JSON.parse(tenantContextCookie.value) as TenantContext
        // Verify the tenant context is valid
        if (tenantContext.id && tenantContext.supabase_url) {
          return tenantContext
        }
      } catch (parseError) {
        console.warn('Failed to parse tenant_context cookie:', parseError)
      }
    }

    // Fallback: Get user from tenant database session and lookup tenant
    // Try to get user from default Supabase connection (tenant database)
    const cookieStore2 = await cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    
    if (supabaseUrl && supabaseAnonKey) {
      const { createServerClient } = await import('@supabase/ssr')
      const tenantSupabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            get(name: string) {
              return cookieStore2.get(name)?.value
            },
            set() {}, // Read-only
            remove() {}, // Read-only
          },
        }
      )

      const { data: { user }, error: userError } = await tenantSupabase.auth.getUser()
      
      if (!userError && user && user.email) {
        // Lookup tenant for this user in Admin DB
        const adminSupabase = await getAdminSupabase()
        const { data: tenantData, error: tenantError } = await adminSupabase
          .rpc('get_tenant_by_user_email', { user_email_param: user.email })

        if (!tenantError && tenantData && tenantData.length > 0) {
          const tenant = tenantData[0]
          
          return {
            id: tenant.tenant_id,
            name: tenant.tenant_name,
            slug: tenant.tenant_slug,
            supabase_url: tenant.supabase_url,
            supabase_anon_key: tenant.supabase_anon_key,
            user_id_in_tenant_db: tenant.user_id_in_tenant_db,
            user_role: tenant.user_role
          }
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('Error getting tenant from session:', error)
    return null
  }
}

/**
 * Get Tenant Supabase Client
 * Returns a Supabase client connected to the tenant's database
 */
export async function getTenantSupabase() {
  const tenant = await getTenantFromSession()
  
  if (!tenant) {
    throw new Error('No tenant context found. User must be logged in and associated with a tenant.')
  }

  const cookieStore = await cookies()

  return createServerClient(
    tenant.supabase_url,
    tenant.supabase_anon_key,
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

/**
 * Store Tenant Context in Cookie
 * Used after successful login to store tenant information
 */
export function storeTenantContext(tenant: TenantContext) {
  // This will be called from the login API route
  // The cookie will be set via the response
  return JSON.stringify(tenant)
}

/**
 * Browser-side: Get Tenant Supabase Client
 * For client components that need tenant-specific Supabase access
 */
export function getTenantSupabaseBrowser() {
  // For now, use the default Supabase client
  // In the future, this will read tenant context from cookie/localStorage
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables for browser client')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
