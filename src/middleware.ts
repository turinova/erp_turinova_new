import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkPagePermission, shouldCheckPermission } from './middleware/permission'

export async function middleware(req: NextRequest) {
  // Skip middleware for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If user is not signed in and the current path is not /login, redirect to /login
  if (!session && req.nextUrl.pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // If user is signed in and the current path is /login, redirect to /home
  if (session && req.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/home', req.url))
  }

  // Temporarily disable permission checks to prevent memory issues
  // TODO: Implement lightweight permission checking
  // if (session) {
  //   const permissionCheck = shouldCheckPermission(req.nextUrl.pathname)
  //   if (permissionCheck) {
  //     return await checkPagePermission(req, permissionCheck.pagePath, permissionCheck.permissionType)
  //   }
  // }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
