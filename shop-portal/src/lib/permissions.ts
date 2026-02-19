// Simple Permission System Utilities
// Fast, session-based permission checking

export interface UserPermission {
  page_path: string
  can_access: boolean
}

export interface PermissionCache {
  permissions: UserPermission[]
  cached_at: number
  expires_at: number
}

// Cache duration: 1 hour (same as typical session duration)
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds

/**
 * Check if user has permission to access a specific page
 * This is the main function used by client-side components
 */
export function hasPagePermission(
  pagePath: string, 
  sessionPermissions: UserPermission[]
): boolean {
  try {
    const permission = sessionPermissions.find(p => p.page_path === pagePath)
    return permission?.can_access ?? false
  } catch (error) {
    console.error('Error checking page permission:', error)
    // Fail-closed: deny access on error
    return false
  }
}

/**
 * Check if permission cache is still valid
 */
export function isPermissionCacheValid(cache: PermissionCache | null): boolean {
  if (!cache) return false
  return Date.now() < cache.expires_at
}

/**
 * Create a new permission cache
 */
export function createPermissionCache(permissions: UserPermission[]): PermissionCache {
  const now = Date.now()
  return {
    permissions,
    cached_at: now,
    expires_at: now + CACHE_DURATION
  }
}
