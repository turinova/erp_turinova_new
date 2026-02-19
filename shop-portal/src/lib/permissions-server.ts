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
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey!,
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

    // Only log in development to avoid performance impact in production
    if (process.env.NODE_ENV === 'development') {
      console.log(`Permission check: ${pagePath} -> ${checkPath}`)
    }

    // If permissions are provided (from session cache), use them
    if (sessionPermissions) {
      const permission = sessionPermissions.find(p => p.page_path === checkPath)
      return permission?.can_access ?? false
    }

    // Fallback to database check
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )
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
 */
export async function getAllUsersWithPermissions(): Promise<any[]> {
  const cookieStore = await cookies()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey!,
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
 */
export async function getAllPages(): Promise<any[]> {
  const cookieStore = await cookies()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey!,
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
