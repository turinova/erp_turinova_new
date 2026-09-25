/**
 * Publikus bolt — tenant feloldás a site slugból.
 * Oldalak: a /s/[site] paraméter. Server action / API: a middleware által
 * beállított x-storefront-site fejléc. Végső tartalék: STOREFRONT_DEMO_TENANT_SLUG.
 */

import { headers } from 'next/headers'
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  demoSiteSlug,
  storefrontOriginForHost,
  STOREFRONT_SITE_HEADER,
  subdomainHostForSlug
} from '@/lib/storefront/site'
import { storefrontBaseUrl, type SiteBase } from '@/lib/storefront/url'

export type StorefrontTenant = {
  id: string
  name: string
  slug: string
  /** Kanonikus cím: aktív saját domain → aldomain → app URL (path-mód). */
  base: SiteBase
  primaryHost: string | null
}

async function primaryCustomHost(
  admin: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from('tenant_domains')
    .select('hostname')
    .eq('tenant_id', tenantId)
    .eq('is_primary', true)
    .eq('status', 'active')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  if (error) {
    if (error.code !== '42P01' && error.code !== 'PGRST205') console.error('primaryCustomHost', error.message)
    return null
  }
  return (data?.hostname as string | undefined) ?? null
}

export function siteBaseFor(slug: string, customHost: string | null): {
  base: SiteBase
  primaryHost: string | null
} {
  const host = customHost ?? subdomainHostForSlug(slug)
  if (host) return { base: { origin: storefrontOriginForHost(host), hostMode: true }, primaryHost: host }
  return { base: { origin: storefrontBaseUrl(), hostMode: false }, primaryHost: null }
}

const loadTenantBySlug = cache(
  async (admin: SupabaseClient, slug: string): Promise<StorefrontTenant | null> => {
    const { data, error } = await admin
      .from('tenants')
      .select('id, name, slug')
      .eq('slug', slug)
      .maybeSingle()
    if (error) {
      console.error('resolveStorefrontTenant', error.message)
      return null
    }
    if (!data) return null
    const id = data.id as string
    const tenantSlug = String(data.slug ?? '')
    const custom = await primaryCustomHost(admin, id)
    return {
      id,
      name: String(data.name ?? ''),
      slug: tenantSlug,
      ...siteBaseFor(tenantSlug, custom)
    }
  }
)

export async function resolveStorefrontTenant(
  admin: SupabaseClient,
  site?: string
): Promise<StorefrontTenant | null> {
  let slug = site ? decodeURIComponent(site) : null
  if (!slug) {
    const h = await headers()
    slug = h.get(STOREFRONT_SITE_HEADER) || demoSiteSlug()
  }
  return loadTenantBySlug(admin, slug)
}
