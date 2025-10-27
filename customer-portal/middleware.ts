import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { createServerClient } from '@supabase/ssr'

// Permission checks are now handled client-side by the PermissionProvider

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
  const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/terms-and-conditions', '/privacy-policy', '/cookie-policy']
  const isPublicRoute = publicRoutes.includes(req.nextUrl.pathname)
  
  // Skip authentication for public routes - return immediately
  if (isPublicRoute) {
    console.log('Middleware - Public route, allowing access:', req.nextUrl.pathname)
    return NextResponse.next() // Return fresh response without auth checks
  }
  
  // Allow /home for authenticated users (will check below)
  const protectedRoutes = ['/home']
  const isProtectedRoute = protectedRoutes.some(route => req.nextUrl.pathname.startsWith(route))

  // Enable authentication for all other routes
  // Customer portal specific Supabase credentials (no custom storageKey - use default)
  const supabaseUrl = 'https://oatbbtbkerxogzvwicxx.supabase.co'
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGJidGJrZXJ4b2d6dndpY3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NTI1OTIsImV4cCI6MjA3NjUyODU5Mn0.-FWyh76bc2QrFGx13FllP2Vhhk6XvpY1rAm4bOU5Ipc'
  
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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
  let hasValidSession = false
  
  try {
    // Get session from cookies
    const { data: { session: sessionData }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.log('Middleware - Session error:', error.message)
      session = null
    } else if (sessionData) {
      // Verify the session is actually valid by checking the user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.log('Middleware - Invalid session, user not found')
        session = null
        hasValidSession = false
      } else {
        session = sessionData
        hasValidSession = true
      }
    }
  } catch (error) {
    console.log('Middleware - Session exception:', error)
    session = null
    hasValidSession = false
  }

  console.log('Middleware - Path:', req.nextUrl.pathname, 'Valid Session:', hasValidSession, 'User:', session?.user?.email)
  console.log('Middleware - Cookies:', req.cookies.getAll().map(c => c.name).join(', '))

  // If user is not signed in and the current path is not /login or /register, redirect to /login
  if (!hasValidSession && req.nextUrl.pathname !== '/login' && req.nextUrl.pathname !== '/register') {
    console.log('Middleware - Redirecting to login (no valid session)')
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // If user is signed in and the current path is /login or /register, redirect to /home
  if (hasValidSession && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/register')) {
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
    '/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|eot)$).*)',
  ],
}
