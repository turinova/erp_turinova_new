'use server'

import { revalidatePath } from 'next/cache'
import { getTenantFromSession, getAdminSupabase } from '@/lib/tenant-supabase'
import { createClient } from '@supabase/supabase-js'

// Create user action
export async function createUserAction(formData: { email: string; password: string; full_name?: string }) {
  try {
    const { email, password, full_name } = formData

    if (!email || !password) {
      return { success: false, error: 'Email és jelszó megadása kötelező' }
    }

    // Get tenant context - CRITICAL: No fallback to default database
    const tenant = await getTenantFromSession()
    if (!tenant) {
      return { success: false, error: 'Nincs aktív tenant munkamenet. Kérjük, jelentkezzen be újra.' }
    }

    // Get tenant's service role key from Admin DB
    const adminSupabase = await getAdminSupabase()
    const { data: tenantData, error: tenantError } = await adminSupabase
      .from('tenants')
      .select('supabase_url, supabase_service_role_key')
      .eq('id', tenant.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    if (tenantError || !tenantData || !tenantData.supabase_service_role_key) {
      console.error('Error fetching tenant service role key:', tenantError)
      return { success: false, error: 'Nem sikerült lekérni a tenant adatokat' }
    }

    // Create admin client for TENANT database (not default)
    const supabaseAdmin = createClient(
      tenantData.supabase_url,
      tenantData.supabase_service_role_key,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || ''
      }
    })

    if (authError) {
      return { success: false, error: authError.message }
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' }
    }

    // CRITICAL: Add user to tenant_users table in Admin DB for login system
    // This allows the login system to find which tenant the user belongs to
    // Use upsert to handle case where user already exists (unique constraint on tenant_id, user_email)
    const { error: tenantUserError } = await adminSupabase
      .from('tenant_users')
      .upsert({
        tenant_id: tenant.id,
        user_email: email.trim().toLowerCase(),
        user_id_in_tenant_db: authData.user.id,
        role: 'user', // Default role
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,user_email'
      })

    if (tenantUserError) {
      console.error('Error adding user to tenant_users table:', tenantUserError)
      // Don't fail the entire operation, but log the error
      // The user was created in the tenant DB, but login might not work until this is fixed
      console.warn('User created in tenant DB but not added to Admin DB tenant_users table. Login may fail.')
    } else {
      console.log('User successfully added/updated in tenant_users table in Admin DB')
    }

    revalidatePath('/users')
    return { success: true, user: authData.user }
  } catch (error) {
    console.error('Error creating user:', error)
    return { success: false, error: 'Hiba a felhasználó létrehozásakor' }
  }
}

// Delete users action
export async function deleteUsersAction(userIds: string[]) {
  try {
    if (!userIds || userIds.length === 0) {
      return { success: false, error: 'Nincs kiválasztott felhasználó' }
    }

    // Get tenant context - CRITICAL: No fallback to default database
    const tenant = await getTenantFromSession()
    if (!tenant) {
      return { success: false, error: 'Nincs aktív tenant munkamenet. Kérjük, jelentkezzen be újra.' }
    }

    // Get tenant's service role key from Admin DB
    const adminSupabase = await getAdminSupabase()
    const { data: tenantData, error: tenantError } = await adminSupabase
      .from('tenants')
      .select('supabase_url, supabase_service_role_key')
      .eq('id', tenant.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    if (tenantError || !tenantData || !tenantData.supabase_service_role_key) {
      console.error('Error fetching tenant service role key:', tenantError)
      return { success: false, error: 'Nem sikerült lekérni a tenant adatokat' }
    }

    // Create regular client for tenant database (for public.users operations)
    const { getTenantSupabase } = await import('@/lib/tenant-supabase')
    const supabase = await getTenantSupabase()

    // Create admin client for tenant database (for auth.admin operations)
    const supabaseAdmin = createClient(
      tenantData.supabase_url,
      tenantData.supabase_service_role_key,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Soft delete from public.users in TENANT database
    const { error: deleteError } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', userIds)

    if (deleteError) {
      return { success: false, error: 'Failed to delete users' }
    }

    // Ban users in auth.users in TENANT database
    const banResults = await Promise.allSettled(
      userIds.map(userId =>
        supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
      )
    )

    const failedBans = banResults.filter(result =>
      result.status === 'rejected' ||
      (result.status === 'fulfilled' && result.value.error)
    )

    if (failedBans.length > 0) {
      console.warn(`Failed to ban ${failedBans.length} users`)
    }

    revalidatePath('/users')
    return { success: true, count: userIds.length }
  } catch (error) {
    console.error('Error deleting users:', error)
    return { success: false, error: 'Hiba a felhasználók törlésekor' }
  }
}
