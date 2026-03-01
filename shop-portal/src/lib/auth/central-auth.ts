/**
 * Central Authentication System
 * 
 * Handles two-step authentication:
 * 1. Lookup tenant in Admin Database
 * 2. Authenticate in Tenant Database
 */

import { getAdminSupabase } from '../tenant-supabase'
import type { TenantContext } from '../tenant-supabase'

export interface AuthResult {
  type: 'admin' | 'tenant'
  user: any
  tenant: TenantContext | null
  error?: string
}

/**
 * Authenticate User (Two-Step Process)
 * 
 * 1. First, try to authenticate in Admin DB (for admin users)
 * 2. If not admin, lookup tenant in Admin DB
 * 3. Then authenticate in Tenant DB
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    console.log('[AUTH] Starting authentication for:', email.trim().toLowerCase())
    
    // Get admin supabase for tenant lookup
    const adminSupabase = await getAdminSupabase()
    console.log('[AUTH] Admin Supabase client created')
    
    // Step 1: FIRST check if user is a tenant user (priority)
    // This prevents tenant users from being authenticated as admin
    console.log('[AUTH] Looking up tenant for user...')
    let tenantData: any[] | null = null
    let tenantLookupError: any = null
    
    // Try RPC function first
    const { data: rpcTenantData, error: rpcError } = await adminSupabase
      .rpc('get_tenant_by_user_email', { user_email_param: email.trim().toLowerCase() })

    if (rpcError) {
      console.warn('[AUTH] RPC function failed, trying direct query:', rpcError)
      // Fallback: Query tables directly with proper join
      const { data: directTenantData, error: directError } = await adminSupabase
        .from('tenant_users')
        .select(`
          tenant_id,
          user_id_in_tenant_db,
          role,
          tenants (
            id,
            name,
            slug,
            supabase_url,
            supabase_anon_key,
            is_active,
            deleted_at
          )
        `)
        .eq('user_email', email.trim().toLowerCase())
        .limit(1)

      if (directError) {
        console.error('[AUTH] Direct query also failed:', directError)
        tenantLookupError = directError
      } else if (directTenantData && directTenantData.length > 0) {
        const tenant = directTenantData[0]
        // Check if tenant is active and not deleted
        if (tenant.tenants && tenant.tenants.is_active && !tenant.tenants.deleted_at) {
          // Transform the data to match RPC format
          tenantData = [{
            tenant_id: tenant.tenant_id || tenant.tenants.id,
            tenant_name: tenant.tenants.name,
            tenant_slug: tenant.tenants.slug,
            supabase_url: tenant.tenants.supabase_url,
            supabase_anon_key: tenant.tenants.supabase_anon_key,
            user_id_in_tenant_db: tenant.user_id_in_tenant_db,
            user_role: tenant.role
          }]
          console.log('[AUTH] Found tenant via direct query:', tenant.tenants.name)
        } else {
          console.warn('[AUTH] Tenant found but is inactive or deleted')
        }
      }
    } else {
      tenantData = rpcTenantData
      console.log('[AUTH] Tenant lookup result:', tenantData ? `Found ${tenantData.length} tenant(s)` : 'No tenant found')
    }

    // If user is found in tenant_users, they are a tenant user (not admin)
    if (!tenantLookupError && tenantData && tenantData.length > 0) {
      const tenantInfo = tenantData[0]
      console.log('[AUTH] User found in tenant:', tenantInfo.tenant_name, 'Tenant URL:', tenantInfo.supabase_url)

      // Step 2: Authenticate in Tenant Database
      const tenantAuthUrl = `${tenantInfo.supabase_url}/auth/v1/token?grant_type=password`
      console.log('[AUTH] Authenticating in tenant database:', tenantAuthUrl)
      
      const tenantAuthResponse = await fetch(tenantAuthUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': tenantInfo.supabase_anon_key,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })

      console.log('[AUTH] Tenant auth response status:', tenantAuthResponse.status, tenantAuthResponse.statusText)

      if (!tenantAuthResponse.ok) {
        const errorData = await tenantAuthResponse.json().catch(() => ({}))
        console.error('[AUTH] Tenant authentication failed:', errorData)
        return {
          type: 'tenant',
          user: null,
          tenant: null,
          error: errorData.error_description || errorData.message || `Authentication failed: ${tenantAuthResponse.statusText}`
        }
      }

      const tenantAuthData = await tenantAuthResponse.json()
      console.log('[AUTH] Tenant auth successful, user ID:', tenantAuthData.user?.id)
      
      // Create a user object from the auth response
      const tenantUser = {
        id: tenantAuthData.user?.id || tenantInfo.user_id_in_tenant_db,
        email: tenantAuthData.user?.email || email.trim().toLowerCase(),
        ...tenantAuthData.user
      }

      if (!tenantUser || !tenantUser.id) {
        console.error('[AUTH] Failed to create tenant user object')
        return {
          type: 'tenant',
          user: null,
          tenant: null,
          error: 'Failed to authenticate in tenant database'
        }
      }

      // Return tenant context
      const tenantContext: TenantContext = {
        id: tenantInfo.tenant_id,
        name: tenantInfo.tenant_name,
        slug: tenantInfo.tenant_slug,
        supabase_url: tenantInfo.supabase_url,
        supabase_anon_key: tenantInfo.supabase_anon_key,
        user_id_in_tenant_db: tenantInfo.user_id_in_tenant_db,
        user_role: tenantInfo.user_role
      }

      console.log('[AUTH] Authentication successful, returning tenant context')
      return {
        type: 'tenant',
        user: tenantUser,
        tenant: tenantContext
      }
    }
    
    console.log('[AUTH] User not found in tenant_users table')

    // Step 3: If not a tenant user, try Admin Database authentication
    // Only if we have a separate admin database
    const hasSeparateAdminDB = process.env.ADMIN_SUPABASE_URL && 
                               process.env.ADMIN_SUPABASE_URL !== process.env.NEXT_PUBLIC_SUPABASE_URL
    
    if (hasSeparateAdminDB) {
      // Check if user exists in admin_users table
      const adminSupabaseForAuth = await getAdminSupabase()
      const { data: adminUser, error: adminUserError } = await adminSupabaseForAuth
        .from('admin_users')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .eq('is_active', true)
        .maybeSingle()
      
      // Only try admin auth if user exists in admin_users table
      if (!adminUserError && adminUser) {
        const { data: adminAuth, error: adminError } = await adminSupabaseForAuth.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })

        if (adminAuth.user && !adminError) {
          // Admin user - return admin context
          return {
            type: 'admin',
            user: adminAuth.user,
            tenant: null
          }
        }
      }
    }

    // Step 4: User not found as tenant or admin
    console.log('[AUTH] User not found in any tenant or admin system')
    return {
      type: 'tenant',
      user: null,
      tenant: null,
      error: 'User not found in any tenant or admin system'
    }
  } catch (error) {
    console.error('[AUTH] Exception during authentication:', error)
    if (error instanceof Error) {
      console.error('[AUTH] Error message:', error.message)
      console.error('[AUTH] Error stack:', error.stack)
    }
    return {
      type: 'tenant',
      user: null,
      tenant: null,
      error: error instanceof Error ? error.message : 'Authentication failed'
    }
  }
}
