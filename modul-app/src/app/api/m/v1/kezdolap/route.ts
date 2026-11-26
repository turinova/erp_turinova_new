import type { NextRequest } from 'next/server'

import { mobileJson, requireMobileContext } from '@/lib/mobile/auth'
import { getMobilePulse, parseMobilePeriod } from '@/lib/mobile/pulse'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const ctx = await requireMobileContext(request)
  if (!('tenantId' in ctx)) return ctx
  try {
    const period = parseMobilePeriod(request.nextUrl.searchParams.get('period'))
    return mobileJson(await getMobilePulse(ctx.supabase, ctx.tenantId, period, ctx.flags.lapszabaszat))
  } catch (err) {
    console.error('api/m/v1/kezdolap', err)
    return mobileJson({ error: 'load_failed' }, 500)
  }
}
