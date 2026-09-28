import { after, NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { resolveStorefrontTenant } from '@/lib/storefront/resolve-tenant'
import { logSearch } from '@/lib/storefront/search/log'
import { createServiceClient } from '@/lib/supabase/service'

const schema = z.object({
  q: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(1).max(200)
})

/** Kattintás egy keresési találatra (sendBeacon) — a rangsor ebből tanul. */
export async function POST(request: NextRequest) {
  let payload: unknown
  try {
    payload = JSON.parse(await request.text())
  } catch {
    return new NextResponse(null, { status: 400 })
  }
  const parsed = schema.safeParse(payload)
  if (!parsed.success) return new NextResponse(null, { status: 400 })

  const admin = createServiceClient()
  if (!admin) return new NextResponse(null, { status: 503 })
  const tenant = await resolveStorefrontTenant(admin)
  if (!tenant) return new NextResponse(null, { status: 404 })

  const { q, slug } = parsed.data
  after(async () => {
    const { data } = await admin
      .from('accessory_web')
      .select('accessory_id')
      .eq('tenant_id', tenant.id)
      .ilike('web_slug', slug.replace(/[%_\\]/g, '\\$&'))
      .limit(1)
      .maybeSingle()
    if (!data?.accessory_id) return
    await logSearch(admin, tenant.id, { q, source: 'click', clickedId: String(data.accessory_id) })
  })
  return new NextResponse(null, { status: 204 })
}
