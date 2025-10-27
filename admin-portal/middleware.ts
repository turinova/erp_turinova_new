import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [Middleware] ======== START ========`)
  console.log(`[${timestamp}] [Middleware] Request:`, req.nextUrl.pathname)
  console.log(`[${timestamp}] [Middleware] Method:`, req.method)
  
  // Skip middleware for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    console.log(`[${timestamp}] [Middleware] Skipping API route`)
    return NextResponse.next()
  }

  // Skip middleware for static files
  if (req.nextUrl.pathname.startsWith('/_next/static/') || 
      req.nextUrl.pathname.startsWith('/_next/image/') ||
      req.nextUrl.pathname.includes('.') && !req.nextUrl.pathname.includes('/')) {
    console.log(`[${timestamp}] [Middleware] Skipping static file`)
    return NextResponse.next()
  }

  const response = NextResponse.next()
  
  // Add browser console logging headers
  response.headers.set('X-Debug-Timestamp', timestamp)
  response.headers.set('X-Debug-Path', req.nextUrl.pathname)

  // Define public routes that don't require authentication
  const publicRoutes = ['/login']
  const isPublicRoute = publicRoutes.includes(req.nextUrl.pathname)
  
  console.log(`[${timestamp}] [Middleware] Is public route:`, isPublicRoute)
  
  // Skip authentication for public routes
  if (isPublicRoute) {
    console.log(`[${timestamp}] [Middleware] ✅ Public route, allowing access`)
    return response
  }

  // Check authentication for all other routes
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  console.log(`[${timestamp}] [Middleware] Creating Supabase client...`)
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
  console.log(`[${timestamp}] [Middleware] Getting session...`)
  const { data: { session } } = await supabase.auth.getSession()
  console.log(`[${timestamp}] [Middleware] Has session:`, !!session?.user)
  console.log(`[${timestamp}] [Middleware] User email:`, session?.user?.email || 'N/A')

  // If no session, redirect to login
  if (!session?.user) {
    console.log(`[${timestamp}] [Middleware] ❌ No session, redirecting to /login`)
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Verify user is in admin_users table
  console.log(`[${timestamp}] [Middleware] Checking admin_users table...`)
  console.log(`[${timestamp}] [Middleware] Looking for email:`, session.user.email)
  
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('id, email, is_active')
    .eq('email', session.user.email)
    .eq('is_active', true)
    .single()

  console.log(`[${timestamp}] [Middleware] Admin user check:`, {
    found: !!adminUser,
    email: adminUser?.email,
    isActive: adminUser?.is_active,
    hasError: !!adminError,
    error: adminError ? {
      message: adminError.message,
      code: adminError.code,
      details: adminError.details,
      hint: adminError.hint
    } : null
  })

  // If not an admin or not active, sign out and redirect
  if (!adminUser) {
    console.error(`[${timestamp}] [Middleware] ❌❌❌ NOT AN ADMIN USER!`)
    console.error(`[${timestamp}] [Middleware] User email:`, session.user.email)
    console.error(`[${timestamp}] [Middleware] Error details:`, adminError)
    console.error(`[${timestamp}] [Middleware] This user will be signed out and redirected to /login`)
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login', req.url))
  }

  console.log(`[${timestamp}] [Middleware] ✅ Admin verified, allowing access`)
  console.log(`[${timestamp}] [Middleware] ======== END ========`)
  
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}

