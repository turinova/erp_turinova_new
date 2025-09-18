/**
 * Route guard helper function
 * Checks if user can access a path and redirects if not
 */
export function guard(
  path: string, 
  canAccess: (p: string) => boolean, 
  redirect: (p: string) => void
): void {
  if (!canAccess(path)) {
    redirect('/403')
  }
}
