// Server-side Permission System Utilities
// For use in middleware and API routes only

import { UserPermission } from './permissions'
import { matchPageAccess } from './permission-match'
import { getTenantSupabase } from './tenant-supabase'

/**
 * Get user permissions from database (server-side only)
 * Uses tenant-aware Supabase client
 */
export async function getUserPermissionsFromDB(userId: string): Promise<UserPermission[]> {
  const supabase = await getTenantSupabase()

  const { data, error } = await supabase.rpc('get_user_permissions', {
    user_uuid: userId
  })

  if (error) {
    console.error('Error fetching user permissions:', error)
    // Fail-closed: return empty permissions (deny access)
    return []
  }

  return data || []
}

/**
 * Check if user has permission to access a specific page (server-side)
 */
export async function hasPagePermission(
  userId: string, 
  pagePath: string, 
  sessionPermissions?: UserPermission[]
): Promise<boolean> {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Permission check (prefix match): ${pagePath}`)
    }

    if (sessionPermissions) {
      return matchPageAccess(pagePath, sessionPermissions)
    }

    const permissions = await getUserPermissionsFromDB(userId)
    return matchPageAccess(pagePath, permissions)
  } catch (error) {
    console.error('Error checking page permission:', error)
    // Fail-closed: deny access on error
    return false
  }
}

/**
 * Get all permissions for a user (server-side)
 */
export async function getAllUserPermissions(userId: string): Promise<UserPermission[]> {
  return await getUserPermissionsFromDB(userId)
}

/**
 * Get all users with their permissions (server-side)
 * Uses tenant-aware Supabase client
 */
export async function getAllUsersWithPermissions(): Promise<any[]> {
  const supabase = await getTenantSupabase()

  // Get all users from the public users table (excluding deleted users)
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, full_name, created_at, last_sign_in_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (usersError) {
    console.error('Error fetching users:', usersError)
    return []
  }

  return users || []
}

/**
 * Get all pages for permission management (server-side)
 * Uses tenant-aware Supabase client
 */
export async function getAllPages(): Promise<any[]> {
  const supabase = await getTenantSupabase()

  const { data: pages, error } = await supabase
    .from('pages')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching pages:', error)
    return []
  }

  return pages || []
}
