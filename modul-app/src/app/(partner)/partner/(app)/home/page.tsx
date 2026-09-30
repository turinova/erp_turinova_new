import type { Metadata } from 'next'

import { PartnerHome } from '@/components/partner/partner-home'
import { partnerServerHref } from '@/lib/auth/partner-href-server'
import { getPartnerSession } from '@/lib/auth/partner-session'
import {
  PARTNER_OPTI_PATH,
  PARTNER_ORDERS_PATH,
  PARTNER_QUOTES_PATH,
  PARTNER_SEARCH_PATH,
  PARTNER_SETTINGS_PATH
} from '@/lib/auth/surface'
import { loadPartnerHomeData } from '@/lib/partner/home-queries'

export const metadata: Metadata = {
  title: 'Kezdőlap'
}

export default async function PartnerHomePage() {
  const session = await getPartnerSession()
  const home = await loadPartnerHomeData(
    session?.id ?? '',
    session?.selectedTenantId ?? null
  )

  const [settings, search, opti, quotes, orders] = await Promise.all([
    partnerServerHref(PARTNER_SETTINGS_PATH),
    partnerServerHref(PARTNER_SEARCH_PATH),
    partnerServerHref(PARTNER_OPTI_PATH),
    partnerServerHref(PARTNER_QUOTES_PATH),
    partnerServerHref(PARTNER_ORDERS_PATH)
  ])

  return (
    <PartnerHome
      name={session?.name ?? 'Partner'}
      companyLabel={home.companyLabel}
      contact={home.contact}
      draftCount={home.draftCount}
      submittedCount={home.submittedCount}
      hrefs={{ settings, search, opti, quotes, orders }}
    />
  )
}
