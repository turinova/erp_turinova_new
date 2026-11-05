import type { Metadata } from 'next'
import { Suspense } from 'react'

import { WebshopSettingsClient } from '@/components/webshop/webshop-settings-client'
import { getSessionUser } from '@/lib/auth/session'
import { getTenantCompany } from '@/lib/company/queries'
import { listTenantDomains } from '@/lib/storefront/domains/service'
import { isPublicHost } from '@/lib/storefront/indexnow'
import { siteBaseFor } from '@/lib/storefront/resolve-tenant'
import { storefrontOriginForHost, subdomainHostForSlug } from '@/lib/storefront/site'
import { siteUrl, STOREFRONT_HOME } from '@/lib/storefront/url'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { derivedCounty, sellerDefaultsOf } from '@/lib/webshop/legal/context'
import { getWebshopLegalSettings } from '@/lib/webshop/legal/settings'
import { getStorefrontSettings } from '@/lib/webshop/settings'

export const metadata: Metadata = { title: 'Bolt beállítások' }

export default async function WebshopBeallitasokPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  if (!user?.tenantId || user.isDevSession) {
    return (
      <p className="text-body text-ink-secondary">
        Dev módban nincs tenant adatbázis.
      </p>
    )
  }

  const supabase = await createClient()
  if (!supabase) {
    return (
      <p className="text-body text-danger-ink">Adatbázis nem elérhető.</p>
    )
  }

  const entitled = await tenantHasWebshop(supabase, user.tenantId)
  if (!entitled) {
    return (
      <p className="text-body text-ink-secondary">
        Az Online bolt add-on nincs bekapcsolva.
      </p>
    )
  }

  const [settings, legal, company, { data: tenant }, domains, { count: liveCount }] =
    await Promise.all([
      getStorefrontSettings(supabase, user.tenantId),
      getWebshopLegalSettings(supabase, user.tenantId),
      getTenantCompany(supabase, user.tenantId).catch(() => null),
      supabase.from('tenants').select('slug, name').eq('id', user.tenantId).maybeSingle(),
      listTenantDomains(supabase, user.tenantId),
      supabase
        .from('accessory_web')
        .select('accessory_id', { count: 'exact', head: true })
        .eq('tenant_id', user.tenantId)
        .eq('sellable_web', true)
    ])

  const slug = String(tenant?.slug ?? '')
  const tenantName = String(tenant?.name ?? 'Bolt')
  const defaults = sellerDefaultsOf(company, tenantName)
  const effectiveReg = legal.registrationNumber ?? defaults.registrationNumber
  const effectivePostal = legal.postalCode ?? defaults.postalCode
  const autoCounty = derivedCounty(legal, effectiveReg, effectivePostal)

  const primaryCustom = domains.find((d) => d.isPrimary && d.status === 'active') ?? null
  const { base, primaryHost } = siteBaseFor(slug, primaryCustom?.hostname ?? null)
  const subHost = subdomainHostForSlug(slug)

  return (
    <Suspense fallback={null}>
      <WebshopSettingsClient
        initial={settings}
        legal={legal}
        defaults={defaults}
        autoCounty={autoCounty}
        logoUrl={company?.logo_url ?? null}
        canWrite={canWrite}
        liveProductCount={liveCount ?? 0}
        domain={{
          primaryUrl: siteUrl(base, STOREFRONT_HOME),
          primaryIsCustom: Boolean(primaryCustom),
          subdomainUrl: subHost ? storefrontOriginForHost(subHost) : null,
          indexNowLive: isPublicHost(primaryHost),
          domains
        }}
      />
    </Suspense>
  )
}
