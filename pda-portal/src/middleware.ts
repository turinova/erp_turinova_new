import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

export async function middleware(req: NextRequest) {
  const response = NextResponse.next()
  
  // Skip middleware for API routes and static files
  if (
    req.nextUrl.pathname.startsWith('/api/') ||
    req.nextUrl.pathname.startsWith('/_next/') ||
    req.nextUrl.pathname.startsWith('/favicon.ico')
  ) {
    return response
  }
  
  // Allow login page
  if (req.nextUrl.pathname === '/login') {
    return response
  }
  
  // Get token from cookie
  const token = req.cookies.get('pda_token')?.value
  
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  try {
    // Verify JWT token
    const secret = new TextEncoder().encode(process.env.PDA_JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    
    // Token is valid, add user info to headers
    response.headers.set('x-user-id', payload.userId as string)
    response.headers.set('x-user-email', payload.email as string)
    if (payload.workerId) {
      response.headers.set('x-worker-id', payload.workerId as string)
    }
    
    return response
  } catch (error) {
    // Token invalid or expired
    const redirectResponse = NextResponse.redirect(new URL('/login', req.url))
    redirectResponse.cookies.delete('pda_token')
    return redirectResponse
  }
}

export const config = {
  matcher: [
    '/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|eot)$).*)',
  ],
}

