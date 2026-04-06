// Auth Redirect Utilities
// Helper functions to determine where to redirect users based on their permissions

import { getUserPermissionsFromDB } from './permissions-server'
import { UserPermission } from './permissions'

const LANDING_HOME = '/home'

/** Prefer Kezdőlap when permitted; else first row with can_access (DB order). */
function resolveLandingPath(permissions: UserPermission[]): string {
  if (!permissions?.length) return '/login'
  const hasHome = permissions.some(p => p.page_path === LANDING_HOME && p.can_access === true)
  if (hasHome) return LANDING_HOME
  const firstAllowed = permissions.find(p => p.can_access === true)
  return firstAllowed?.page_path ?? '/login'
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
    
    const path = resolveLandingPath(permissions)
    if (path !== '/login' && process.env.NODE_ENV === 'development') {
      console.log('[AUTH REDIRECT] Redirecting to:', path)
    }
    if (path === '/login' && process.env.NODE_ENV === 'development') {
      console.log('[AUTH REDIRECT] No permitted page, redirecting to login')
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
  return resolveLandingPath(permissions)
}

