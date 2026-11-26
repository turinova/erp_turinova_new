import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { isSupabaseConfigured } from '@/lib/auth/config'

/**
 * Vezetői mobil app API (`/api/m/v1/*`).
 * Auth: Supabase access token Bearer-ben → a kliens a user JWT-jével fut, így az RLS él.
 * A tenant a `?tenant=` paraméter; aktív staff tagság kötelező.
 */

export type MobileContext = {
  supabase: SupabaseClient
  userId: string
  tenantId: string
  flags: { lapszabaszat: boolean }
}

const LAPSZAB_KEYS = ['lapszabaszat', '/ajanlatok', '/opti']

export function mobileJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  })
}

export async function requireMobileContext(
  request: NextRequest
): Promise<MobileContext | NextResponse> {
  if (!isSupabaseConfigured()) return mobileJson({ error: 'not_configured' }, 503)

  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return mobileJson({ error: 'unauthorized' }, 401)

  const tenantId = request.nextUrl.searchParams.get('tenant')?.trim() ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) return mobileJson({ error: 'bad_tenant' }, 400)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    }
  )

  const { data: userRes, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userRes.user) return mobileJson({ error: 'unauthorized' }, 401)

  const [membershipRes, entRes] = await Promise.all([
    supabase
      .from('tenant_memberships')
      .select('id')
      .eq('user_id', userRes.user.id)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('tenant_entitlements')
      .select('feature_key')
      .eq('tenant_id', tenantId)
      .in('feature_key', LAPSZAB_KEYS)
  ])

  if (membershipRes.error || !membershipRes.data) {
    return mobileJson({ error: 'forbidden' }, 403)
  }

  return {
    supabase,
    userId: userRes.user.id,
    tenantId,
    flags: { lapszabaszat: (entRes.data ?? []).length > 0 }
  }
}
