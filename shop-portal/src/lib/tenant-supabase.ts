/**
 * Tenant-aware Supabase Client Management
 * 
 * This module provides functions to get Supabase clients for:
 * 1. Admin Database (for tenant management)
 * 2. Tenant Databases (for tenant-specific operations)
 * 3. Session-based tenant context management
 */

import { createBrowserClient } from '@supabase/ssr'
// Note: Server-only imports are done dynamically to avoid build errors

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
    // Dynamic import for server-only API
    const { cookies } = await import('next/headers')
    
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

    // Fallback: Try to get user email from any Supabase session cookie and lookup tenant
    // We'll try to get user from session cookies - Supabase cookies are named like "sb-<project-ref>-auth-token"
    // We need to try all possible tenant databases or get email from cookies directly
    
    // Better approach: Try to get user email from session cookies by attempting to decode them
    // Or try to authenticate with each known tenant database
    // For now, let's try a simpler approach: get all tenants and try to find which one has an active session
    
    // Actually, the best fallback is to try to get user from localStorage (client-side) or
    // try to decode the session token to get the email, then lookup tenant
    
    // For server-side, we can try to get user from any Supabase session cookie
    // by trying the default connection first, then if that fails, we need another strategy
    
    // Improved fallback: Try to get user email from session and lookup tenant directly
    // We'll try the default Supabase first (for first tenant), but also prepare for multi-tenant
    const cookieStore2 = await cookies()
    const { createServerClient } = await import('@supabase/ssr')
    
    // Try default Supabase connection first (for first tenant compatibility)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    
    let userEmail: string | null = null
    
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const defaultSupabase = createServerClient(
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

        const { data: { user }, error: userError } = await defaultSupabase.auth.getUser()
        
        if (!userError && user && user.email) {
          userEmail = user.email
        }
      } catch (error) {
        // Default Supabase failed, try to get email from other sources
        console.warn('[TENANT] Could not get user from default Supabase:', error)
      }
    }
    
    // If we got user email, lookup tenant
    if (userEmail) {
      try {
        const adminSupabase = await getAdminSupabase()
        const { data: tenantData, error: tenantError } = await adminSupabase
          .rpc('get_tenant_by_user_email', { user_email_param: userEmail })

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
      } catch (error) {
        console.warn('[TENANT] Error looking up tenant by email:', error)
      }
    }
    
    // Last resort: Try to get user from tenant database by checking all active tenants
    // This is expensive but necessary for fallback when cookie is missing
    // Only do this if we couldn't get user email from default Supabase
    if (!userEmail) {
      try {
        console.log('[TENANT] Trying to find tenant by checking all active tenants...')
        const adminSupabase = await getAdminSupabase()
        
        // Get all active tenants
        const { data: allTenants, error: tenantsError } = await adminSupabase
          .from('tenants')
          .select('id, name, slug, supabase_url, supabase_anon_key, is_active, deleted_at')
          .eq('is_active', true)
          .is('deleted_at', null)
        
        if (!tenantsError && allTenants && allTenants.length > 0) {
          console.log(`[TENANT] Found ${allTenants.length} active tenants, checking each for user session...`)
          
          // Try each tenant database to find which one has the user's session
          for (const tenantInfo of allTenants) {
            if (!tenantInfo.supabase_url || !tenantInfo.supabase_anon_key) continue
            
            try {
              const { createServerClient } = await import('@supabase/ssr')
              const testSupabase = createServerClient(
                tenantInfo.supabase_url,
                tenantInfo.supabase_anon_key,
                {
                  cookies: {
                    get(name: string) {
                      return cookieStore2.get(name)?.value
                    },
                    set() {},
                    remove() {},
                  },
                }
              )
              
              const { data: { user }, error: userError } = await testSupabase.auth.getUser()
              
              if (!userError && user && user.email) {
                console.log(`[TENANT] Found user session in tenant: ${tenantInfo.name} (${tenantInfo.slug})`)
                
                // Get full tenant info with user details
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
            } catch (error) {
              // This tenant database doesn't have the user, continue to next
              continue
            }
          }
          
          console.log('[TENANT] Could not find user session in any tenant database')
        }
      } catch (error) {
        console.error('[TENANT] Error in tenant lookup fallback:', error)
      }
    }
    
    console.log('[TENANT] No tenant context found after all fallback attempts')
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

  // Dynamic imports for server-only APIs
  const { cookies } = await import('next/headers')
  const { createServerClient } = await import('@supabase/ssr')
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
 * Reads tenant context from cookie and creates appropriate client
 */
export function getTenantSupabaseBrowser() {
  // Default Supabase URL and key (fallback for tenant 1 or when no tenant context)
  const defaultSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const defaultSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

  if (!defaultSupabaseUrl || !defaultSupabaseAnonKey) {
    throw new Error('Missing Supabase environment variables for browser client')
  }

  // Try to get tenant context from localStorage (browser-side only)
  // Note: Cookie is httpOnly, so we use localStorage for client-side access
  if (typeof window !== 'undefined') {
    try {
      const tenantContextJson = localStorage.getItem('tenant_context')
      
      if (tenantContextJson) {
        const tenantContext = JSON.parse(tenantContextJson) as TenantContext
        
        // Validate tenant context
        if (tenantContext.supabase_url && tenantContext.supabase_anon_key) {
          // Use tenant's Supabase URL and key
          return createBrowserClient(tenantContext.supabase_url, tenantContext.supabase_anon_key)
        }
      }
    } catch (error) {
      console.warn('Failed to parse tenant context from localStorage, using default Supabase client:', error)
    }
  }

  // Fallback to default Supabase client
  return createBrowserClient(defaultSupabaseUrl, defaultSupabaseAnonKey)
}
