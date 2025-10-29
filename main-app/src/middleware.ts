import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { createServerClient } from '@supabase/ssr'
import { hasPagePermission } from '@/lib/permissions-server'
import { getFirstPermittedPage } from '@/lib/auth-redirect'

export async function middleware(req: NextRequest) {
  // Skip middleware for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Skip middleware for static files
  if (req.nextUrl.pathname.startsWith('/_next/static/') || 
      req.nextUrl.pathname.startsWith('/_next/image/') ||
      req.nextUrl.pathname.includes('.') && !req.nextUrl.pathname.includes('/')) {
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
  const publicRoutes = ['/', '/login']
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
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Try to get session with better error handling
  let session = null
  try {
    // First try to get session from cookies
    const { data: { session: sessionData }, error } = await supabase.auth.getSession()
    if (error) {
      console.log('Middleware - Session error:', error.message)
    } else {
      session = sessionData
    }
    
    // If no session found, try to get user directly
    if (!session) {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.log('Middleware - User error:', userError.message)
      } else if (user) {
        console.log('Middleware - Found user without session:', user.email)
        // Create a minimal session object
        session = { user }
      }
    }
  } catch (error) {
    console.log('Middleware - Session exception:', error)
  }

  console.log('Middleware - Path:', req.nextUrl.pathname, 'Session:', !!session, 'User:', session?.user?.email)
  console.log('Middleware - Cookies:', req.cookies.getAll().map(c => c.name).join(', '))

  // If user is not signed in and the current path is not /login, redirect to /login
  if (!session && req.nextUrl.pathname !== '/login') {
    console.log('Middleware - Redirecting to login (no session)')
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // If user is signed in and the current path is /login or /, redirect to first permitted page
  if (session && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/')) {
    console.log('Middleware - User signed in, finding first permitted page')
    const firstPage = await getFirstPermittedPage(session.user.id)
    console.log('Middleware - Redirecting to:', firstPage)
    return NextResponse.redirect(new URL(firstPage, req.url))
  }

  // Check page permissions for authenticated users
  if (session && session.user) {
    try {
      const hasPermission = await hasPagePermission(session.user.id, req.nextUrl.pathname)
      
      if (!hasPermission) {
        console.log('Middleware - Access denied for:', req.nextUrl.pathname, 'User:', session.user.email)
        const firstPage = await getFirstPermittedPage(session.user.id)
        console.log('Middleware - Redirecting to first permitted page:', firstPage)
        return NextResponse.redirect(new URL(firstPage, req.url))
      }
      
      console.log('Middleware - Access granted for:', req.nextUrl.pathname, 'User:', session.user.email)
    } catch (error) {
      console.error('Middleware - Permission check error:', error)
      // Fail-closed: redirect to first permitted page on permission check error
      const firstPage = await getFirstPermittedPage(session.user.id)
      return NextResponse.redirect(new URL(firstPage, req.url))
    }
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
    '/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|eot)$).*)',
  ],
}
