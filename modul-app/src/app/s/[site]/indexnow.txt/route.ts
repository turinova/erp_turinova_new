import { indexNowKey } from '@/lib/storefront/indexnow'
import { resolveStorefrontTenant } from '@/lib/storefront/resolve-tenant'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ site: string }> }
) {
  const admin = createServiceClient()
  const tenant = admin ? await resolveStorefrontTenant(admin, (await params).site) : null
  const key = tenant ? indexNowKey(tenant.id) : null
  if (!key) return new Response('Not found', { status: 404 })
  return new Response(key, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }
  })
}
