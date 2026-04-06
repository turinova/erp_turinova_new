// Auth redirect for middleware / server only (uses permissions-server → next/headers).

import { getUserPermissionsFromDB } from './permissions-server'
import { resolveLandingPath } from './auth-landing'

/**
 * Get the first page the user has permission to access
 * Returns the first permitted page path, or /login if no permissions
 */
export async function getFirstPermittedPage(userId: string): Promise<string> {
  try {
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
    return '/login'
  }
}
