import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Email link (jelszó-visszaállítás / megerősítés) → session → tovább a next oldalra.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const nextRaw = searchParams.get('next') || '/partner/uj-jelszo'
  const next =
    nextRaw.startsWith('/') && !nextRaw.startsWith('//')
      ? nextRaw
      : '/partner/uj-jelszo'

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.redirect(new URL('/partner/login', origin))
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('auth/confirm code', error.message)
      return NextResponse.redirect(
        new URL('/partner/elfelejtett-jelszo?reason=link_invalid', origin)
      )
    }
    return NextResponse.redirect(new URL(next, origin))
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash
    })
    if (error) {
      console.error('auth/confirm otp', error.message)
      return NextResponse.redirect(
        new URL('/partner/elfelejtett-jelszo?reason=link_invalid', origin)
      )
    }
    return NextResponse.redirect(new URL(next, origin))
  }

  return NextResponse.redirect(new URL('/partner/login', origin))
}
