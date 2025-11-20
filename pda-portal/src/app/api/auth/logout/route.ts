import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })
  
  // Clear cookie - for localhost, don't set domain
  const cookieDomain = process.env.NODE_ENV === 'production' ? '.turinova.hu' : undefined
  
  response.cookies.set('pda_token', '', {
    ...(cookieDomain && { domain: cookieDomain }),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  })
  
  return response
}

