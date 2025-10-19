// Server-side Permission System Utilities
// For use in middleware and API routes only

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { UserPermission } from './permissions'

/**
 * Get user permissions from database (server-side only)
 */
export async function getUserPermissionsFromDB(userId: string): Promise<UserPermission[]> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  )

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

    console.log(`Permission check: ${pagePath} -> ${checkPath}`)

    // If permissions are provided (from session cache), use them
    if (sessionPermissions) {
      const permission = sessionPermissions.find(p => p.page_path === checkPath)
      return permission?.can_access ?? false
    }

    // Fallback to database check
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
 * Update user permission in database (server-side)
 */
export async function updateUserPermission(
  userId: string, 
  pagePath: string, 
  canAccess: boolean
): Promise<boolean> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  // First get the page ID
  const { data: page, error: pageError } = await supabase
    .from('pages')
    .select('id')
    .eq('path', pagePath)
    .eq('is_active', true)
    .single()

  if (pageError || !page) {
    console.error('Error finding page:', pageError)
    return false
  }

  // Update or insert permission
  const { error } = await supabase
    .from('user_permissions')
    .upsert({
      user_id: userId,
      page_id: page.id,
      can_access: canAccess
    }, {
      onConflict: 'user_id,page_id'
    })

  if (error) {
    console.error('Error updating user permission:', error)
    return false
  }

  return true
}

/**
 * Get all users with their permissions (server-side)
 */
export async function getAllUsersWithPermissions(): Promise<any[]> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  // Get all users from the public users table
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, full_name, created_at, last_sign_in_at')
    .order('created_at', { ascending: false })

  if (usersError) {
    console.error('Error fetching users:', usersError)
    return []
  }

  return users || []
}

/**
 * Get all pages for permission management (server-side)
 */
export async function getAllPages(): Promise<any[]> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const { data: pages, error } = await supabase
    .from('pages')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching pages:', error)
    return []
  }

  return pages || []
}
