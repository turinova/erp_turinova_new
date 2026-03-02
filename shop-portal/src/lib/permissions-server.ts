// Server-side Permission System Utilities
// For use in middleware and API routes only

import { UserPermission } from './permissions'
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
    // Handle dynamic routes: /orders/[id] should check /orders
    const basePath = pagePath.split('/').slice(0, 2).join('/'); // e.g., /orders/123 -> /orders
    const checkPath = basePath.length > 1 ? basePath : pagePath; // If basePath is just '/', use original path

    // Only log in development to avoid performance impact in production
    if (process.env.NODE_ENV === 'development') {
      console.log(`Permission check: ${pagePath} -> ${checkPath}`)
    }

    // If permissions are provided (from session cache), use them
    if (sessionPermissions) {
      const permission = sessionPermissions.find(p => p.page_path === checkPath)
      return permission?.can_access ?? false
    }

    // Fallback to database check (uses tenant-aware client)
    const permissions = await getUserPermissionsFromDB(userId)
    const permission = permissions.find(p => p.page_path === checkPath)
    return permission?.can_access ?? false
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
