import type { Metadata } from 'next'

import { WebshopChannelsClient } from '@/components/webshop/webshop-channels-client'
import { getSessionUser } from '@/lib/auth/session'
import { listTenantDomains } from '@/lib/storefront/domains/service'
import { isPublicHost } from '@/lib/storefront/indexnow'
import { siteBaseFor } from '@/lib/storefront/resolve-tenant'
import { storefrontOriginForHost, subdomainHostForSlug } from '@/lib/storefront/site'
import { siteUrl, STOREFRONT_HOME } from '@/lib/storefront/url'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'

export const metadata: Metadata = { title: 'Csatornák' }

export default async function WebshopCsatornakPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return <p className="text-body text-ink-secondary">Dev módban nincs tenant adatbázis.</p>
  }
  const supabase = await createClient()
  if (!supabase) {
    return <p className="text-body text-danger-ink">Adatbázis nem elérhető.</p>
  }
  if (!(await tenantHasWebshop(supabase, user.tenantId))) {
    return <p className="text-body text-ink-secondary">Az Online bolt add-on nincs bekapcsolva.</p>
  }

  const [{ data: tenant }, domains] = await Promise.all([
    supabase.from('tenants').select('slug').eq('id', user.tenantId).maybeSingle(),
    listTenantDomains(supabase, user.tenantId)
  ])
  const slug = String(tenant?.slug ?? '')
  const primaryCustom = domains.find((d) => d.isPrimary && d.status === 'active') ?? null
  const { base, primaryHost } = siteBaseFor(slug, primaryCustom?.hostname ?? null)
  const subHost = subdomainHostForSlug(slug)

  return (
    <WebshopChannelsClient
      canWrite={Boolean(user.role && user.role !== 'viewer')}
      primaryUrl={siteUrl(base, STOREFRONT_HOME)}
      primaryIsCustom={Boolean(primaryCustom)}
      subdomainUrl={subHost ? storefrontOriginForHost(subHost) : null}
      indexNowLive={isPublicHost(primaryHost)}
      domains={domains}
    />
  )
}
