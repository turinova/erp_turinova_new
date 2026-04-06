// Client-safe landing path logic (no next/headers). Use from Login and other client code.

import type { UserPermission } from './permissions'

export const LANDING_HOME_PATH = '/home'

/** Prefer Kezdőlap when permitted; else first row with can_access (DB order). */
export function resolveLandingPath(permissions: UserPermission[]): string {
  if (!permissions?.length) return '/login'
  const hasHome = permissions.some(
    p => p.page_path === LANDING_HOME_PATH && p.can_access === true
  )
  if (hasHome) return LANDING_HOME_PATH
  const firstAllowed = permissions.find(p => p.can_access === true)
  return firstAllowed?.page_path ?? '/login'
}

export function getFirstPermittedPageClient(permissions: UserPermission[]): string {
  return resolveLandingPath(permissions)
}
