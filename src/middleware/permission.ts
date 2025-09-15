import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define pages that require specific permissions - ALL pages except home and login
const PROTECTED_PAGES = {
  '/users': 'view',
  '/company': 'view', 
  '/customers': 'view',
  '/vat': 'view',
  '/brands': 'view',
  '/currencies': 'view',
  '/units': 'view',
  '/tablas-anyagok': 'view',
  '/szalas-anyagok': 'view',
  '/elzarok': 'view',
  '/opti': 'view',
  '/opti-beallitasok': 'view',
  '/test-toast': 'view',
} as const

export async function checkPagePermission(req: NextRequest, pagePath: string, permissionType: string) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Check authentication first
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Check permission using simplified approach
  const { data: userPermissions } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('user_id', session.user.id)

  const { data: page } = await supabase
    .from('pages')
    .select('*')
    .eq('path', pagePath)
    .single()

  if (!page) {
    console.error('Page not found:', pagePath)
    return NextResponse.redirect(new URL('/home', req.url))
  }

  const permission = userPermissions?.find(perm => perm.page_id === page.id)
  const hasPermission = permission?.[`can_${permissionType}`] || false

  if (!hasPermission) {
    // Redirect to home if user doesn't have permission
    return NextResponse.redirect(new URL('/home', req.url))
  }

  return res
}

export function shouldCheckPermission(pathname: string): { pagePath: string; permissionType: string } | null {
  // Check if the current path requires permission
  for (const [pagePath, permissionType] of Object.entries(PROTECTED_PAGES)) {
    if (pathname === pagePath || pathname.startsWith(pagePath + '/')) {
      return { pagePath, permissionType }
    }
  }
  
  return null
}
