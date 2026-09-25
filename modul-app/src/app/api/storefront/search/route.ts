import { NextResponse, type NextRequest } from 'next/server'

import { searchCatalog } from '@/lib/storefront/catalog'
import { resolveStorefrontTenant } from '@/lib/storefront/resolve-tenant'
import { createServiceClient } from '@/lib/supabase/service'

const SUGGEST_LIMIT = 8

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 120)
  if (q.length < 2) return NextResponse.json({ items: [], total: 0 })

  const admin = createServiceClient()
  if (!admin) return NextResponse.json({ items: [], total: 0 }, { status: 503 })
  const tenant = await resolveStorefrontTenant(admin)
  if (!tenant) return NextResponse.json({ items: [], total: 0 }, { status: 404 })

  const result = await searchCatalog(admin, tenant.id, q, { limit: SUGGEST_LIMIT })
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' }
  })
}
