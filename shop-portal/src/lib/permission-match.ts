import type { UserPermission } from './permissions'

/**
 * Normalize pathname for permission checks (no query string).
 * Supports nested routes: e.g. permission /orders matches /orders/abc;
 * permission /settings/email matches only that path and deeper /settings/email/...
 */
export function normalizePathForPermission(pagePath: string): string {
  const path = pagePath.split('?')[0] || ''
  if (path.length > 1 && path.endsWith('/')) {
    return path.replace(/\/+$/, '') || '/'
  }
  return path || '/'
}

/**
 * True if the user may access this URL path given their page permissions.
 * - Exact path match with can_access wins.
 * - Else longest registered prefix: path === p or path.startsWith(p + '/').
 */
export function matchPageAccess(pathname: string, sessionPermissions: UserPermission[]): boolean {
  const normalizedPath = normalizePathForPermission(pathname)

  const exact = sessionPermissions.find((p) => p.page_path === normalizedPath && p.can_access)
  if (exact) return true

  const accessible = sessionPermissions.filter((p) => p.can_access)
  const sorted = [...accessible].sort((a, b) => b.page_path.length - a.page_path.length)

  for (const p of sorted) {
    if (normalizedPath === p.page_path) return true
    if (normalizedPath.startsWith(p.page_path + '/')) return true
  }

  return false
}
