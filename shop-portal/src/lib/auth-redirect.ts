// Auth Redirect Utilities
// Helper functions to determine where to redirect users based on their permissions

import { getUserPermissionsFromDB } from './permissions-server'
import { UserPermission, hasPagePermission } from './permissions'

/**
 * Preferred post-login / logo landing path: /home first when the user may access it,
 * otherwise the first permitted page in DB order (from get_user_permissions).
 */
export function resolveLandingPageFromPermissions(permissions: UserPermission[]): string {
  if (!permissions || permissions.length === 0) {
    return '/home'
  }
  if (hasPagePermission('/home', permissions)) {
    return '/home'
  }
  const firstAllowed = permissions.find(p => p.can_access === true)
  return firstAllowed?.page_path ?? '/home'
}

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

    const path = resolveLandingPageFromPermissions(permissions)
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUTH REDIRECT] Redirecting to:', path)
    }
    return path
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
  return resolveLandingPageFromPermissions(permissions)
}
