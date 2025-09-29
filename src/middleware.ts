import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { createServerClient } from '@supabase/ssr'

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
  
  // Define public routes that don't require authentication
  const publicRoutes = ['/', '/home', '/login']
  const isPublicRoute = publicRoutes.includes(req.nextUrl.pathname)
  
  // Skip authentication for public routes
  if (isPublicRoute) {
    console.log('Middleware - Public route:', req.nextUrl.pathname)
    return response
  }

  // Enable authentication for all other routes
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => req.cookies.set(name, value))
          response.cookies.set(name, value, options)
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  console.log('Middleware - Path:', req.nextUrl.pathname, 'Session:', !!session, 'User:', session?.user?.email)

  // If user is not signed in and the current path is not /login, redirect to /login
  if (!session && req.nextUrl.pathname !== '/login') {
    console.log('Middleware - Redirecting to login (no session)')
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // If user is signed in and the current path is /login, redirect to /home
  if (session && req.nextUrl.pathname === '/login') {
    console.log('Middleware - Redirecting to home (user signed in)')
    return NextResponse.redirect(new URL('/home', req.url))
  }

  return response
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
