import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

// Permission checks are now handled client-side by the PermissionProvider

export async function middleware(req: NextRequest) {
  // Skip middleware for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Performance optimizations
  const response = NextResponse.next()
  
  // Add performance headers
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Add cache headers for static assets
  if (req.nextUrl.pathname.startsWith('/_next/static/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  }
  
  // Add cache headers for brand pages
  if (req.nextUrl.pathname.startsWith('/brands/')) {
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60')
  }
  
  // Temporarily disable auth middleware to test login flow
  console.log('Middleware - Path:', req.nextUrl.pathname, 'Auth middleware disabled for testing')
  return response

  // const res = NextResponse.next()
  // const supabase = createMiddlewareClient({ req, res })

  // const {
  //   data: { session },
  // } = await supabase.auth.getSession()

  // console.log('Middleware - Path:', req.nextUrl.pathname, 'Session:', !!session, 'User:', session?.user?.email)

  // // If user is not signed in and the current path is not /login, redirect to /login
  // if (!session && req.nextUrl.pathname !== '/login') {
  //   console.log('Middleware - Redirecting to login (no session)')
  //   return NextResponse.redirect(new URL('/login', req.url))
  // }

  // // If user is signed in and the current path is /login, redirect to /home
  // if (session && req.nextUrl.pathname === '/login') {
  //   console.log('Middleware - Redirecting to home (user signed in)')
  //   return NextResponse.redirect(new URL('/home', req.url))
  // }

  // return res
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
