import type { NextRequest } from 'next/server'

import { mobileJson, requireMobileContext } from '@/lib/mobile/auth'
import { getMobileElmaradasDetail } from '@/lib/mobile/pulse'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const ctx = await requireMobileContext(request)
  if (!('tenantId' in ctx)) return ctx
  if (!ctx.flags.lapszabaszat) return mobileJson({ error: 'no_module' }, 403)
  try {
    return mobileJson(await getMobileElmaradasDetail(ctx.supabase, ctx.tenantId))
  } catch (err) {
    console.error('api/m/v1/elmaradas', err)
    return mobileJson({ error: 'load_failed' }, 500)
  }
}
