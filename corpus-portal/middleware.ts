import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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

  const response = NextResponse.next()

  // Define public routes that don't require authentication
  const publicRoutes = ['/login']
  const isPublicRoute = publicRoutes.includes(req.nextUrl.pathname)
  
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

  // If no session, redirect to login
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Verify user is in users table
  const { data: corpusUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', session.user.email)
    .single()

  // If not a corpus user, sign out and redirect
  if (!corpusUser) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}

