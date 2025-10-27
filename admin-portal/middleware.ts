import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  console.log('[Middleware] Request:', req.nextUrl.pathname)
  
  // Skip middleware for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    console.log('[Middleware] Skipping API route')
    return NextResponse.next()
  }

  // Skip middleware for static files
  if (req.nextUrl.pathname.startsWith('/_next/static/') || 
      req.nextUrl.pathname.startsWith('/_next/image/') ||
      req.nextUrl.pathname.includes('.') && !req.nextUrl.pathname.includes('/')) {
    console.log('[Middleware] Skipping static file')
    return NextResponse.next()
  }

  const response = NextResponse.next()

  // Define public routes that don't require authentication
  const publicRoutes = ['/login']
  const isPublicRoute = publicRoutes.includes(req.nextUrl.pathname)
  
  console.log('[Middleware] Is public route:', isPublicRoute)
  
  // Skip authentication for public routes
  if (isPublicRoute) {
    return response
  }

  // Check authentication for all other routes
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
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

  // Get session
  const { data: { session } } = await supabase.auth.getSession()
  console.log('[Middleware] Has session:', !!session?.user)

  // If no session, redirect to login
  if (!session?.user) {
    console.log('[Middleware] No session, redirecting to /login')
    return NextResponse.redirect(new URL('/login', req.url))
  }

  console.log('[Middleware] User email:', session.user.email)

  // Verify user is in admin_users table
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('id, email, is_active')
    .eq('email', session.user.email)
    .eq('is_active', true)
    .single()

  console.log('[Middleware] Admin user check:', { adminUser, adminError })

  // If not an admin or not active, sign out and redirect
  if (!adminUser) {
    console.log('[Middleware] Not an admin, signing out and redirecting to /login')
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login', req.url))
  }

  console.log('[Middleware] Admin verified, allowing access')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}

