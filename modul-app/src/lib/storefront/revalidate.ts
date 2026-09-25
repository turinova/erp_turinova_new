/**
 * Bolt cache frissítése termék- / beállításmentés után (csak az adott bolt /s/<slug> fája),
 * termékmentésnél IndexNow jelzés a válasz után.
 */

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'

import { pingIndexNow } from '@/lib/storefront/indexnow'
import { resolveStorefrontTenant } from '@/lib/storefront/resolve-tenant'
import { STOREFRONT_INTERNAL_PREFIX } from '@/lib/storefront/site'
import { productPath } from '@/lib/storefront/url'
import { createServiceClient } from '@/lib/supabase/service'

export async function revalidateStorefrontTenant(
  tenantId: string,
  opts: { productSlugs?: (string | null | undefined)[] } = {}
): Promise<void> {
  const admin = createServiceClient()
  if (!admin) return
  const { data } = await admin.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  const slug = (data?.slug as string | undefined) ?? null
  if (!slug) return

  revalidatePath(`${STOREFRONT_INTERNAL_PREFIX}/${encodeURIComponent(slug)}`, 'layout')

  const paths = (opts.productSlugs ?? []).filter((s): s is string => Boolean(s)).map(productPath)
  if (paths.length === 0) return
  after(async () => {
    const tenant = await resolveStorefrontTenant(admin, slug)
    if (tenant) await pingIndexNow(tenant, paths)
  })
}
