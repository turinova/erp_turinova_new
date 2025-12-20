// Auth Redirect Utilities
// Helper functions to determine where to redirect users based on their permissions

import { getUserPermissionsFromDB } from './permissions-server'
import { UserPermission } from './permissions'

/**
 * Get the first page the user has permission to access
 * Returns the first permitted page path, or /login if no permissions
 * 
 * @param userId - The user's ID
 * @returns The path to redirect to
 */
export async function getFirstPermittedPage(userId: string): Promise<string> {
  try {
    // Only log in development to avoid performance impact in production
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUTH REDIRECT] Finding first permitted page for user:', userId)
    }
    
    const permissions = await getUserPermissionsFromDB(userId)
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUTH REDIRECT] User has', permissions.length, 'permissions loaded')
    }
    
    // Find first page with can_access = true
    const firstAllowed = permissions.find(p => p.can_access === true)
    
    if (firstAllowed) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AUTH REDIRECT] Redirecting to first permitted page:', firstAllowed.page_path)
      }
      return firstAllowed.page_path
    }
    
    // No permissions found - redirect to login
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUTH REDIRECT] No permissions found, redirecting to login')
    }
    return '/login'
    
  } catch (error) {
    console.error('[AUTH REDIRECT] Error getting first permitted page:', error)
    // On error, safe fallback to login
    return '/login'
  }
}

/**
 * Get first permitted page for client-side use (using fetched permissions)
 * 
 * @param permissions - Array of user permissions
 * @returns The path to redirect to
 */
export function getFirstPermittedPageClient(permissions: UserPermission[]): string {
  if (!permissions || permissions.length === 0) {
    return '/login'
  }
  
  const firstAllowed = permissions.find(p => p.can_access === true)
  return firstAllowed?.page_path || '/login'
}

