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
import { openStatus } from '@/lib/opening-hours'
import { getArchiveNotice } from '@/lib/partner/archive-notice'
import { loadPartnerHomeData } from '@/lib/partner/home-queries'

export const metadata: Metadata = {
  title: 'Kezdőlap'
}

function budapestHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Budapest',
      hour: '2-digit',
      hourCycle: 'h23'
    }).format(now)
  )
}

/** Magyar névsorrend: „Mező Dávid” → „Dávid”. */
function firstName(name: string | null | undefined): string | null {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0 || parts[0]!.includes('@')) return null
  return parts[parts.length - 1]!
}

function greetingFor(now: Date, name: string | null | undefined): string {
  const hour = budapestHour(now)
  const salute =
    hour >= 5 && hour < 9
      ? 'Jó reggelt'
      : hour >= 9 && hour < 18
        ? 'Jó napot'
        : 'Jó estét'
  const first = firstName(name)
  return first ? `${salute}, ${first}!` : `${salute}!`
}

export default async function PartnerHomePage() {
  const now = new Date()
  const session = await getPartnerSession()
  const selectedTenantId = session?.selectedTenantId ?? null

  const [data, settings, search, opti, quotes, orders] = await Promise.all([
    loadPartnerHomeData(session?.id ?? '', selectedTenantId, {
      mustSetPassword: Boolean(session?.profile.must_set_password),
      accountCreatedAt: session?.profile.created_at ?? null,
      dismissedAt: session?.profile.product_feedback_dismissed_at ?? null,
      dismissCount: session?.profile.product_feedback_dismiss_count ?? 0
    }),
    partnerServerHref(PARTNER_SETTINGS_PATH),
    partnerServerHref(PARTNER_SEARCH_PATH),
    partnerServerHref(PARTNER_OPTI_PATH),
    partnerServerHref(PARTNER_QUOTES_PATH),
    partnerServerHref(PARTNER_ORDERS_PATH)
  ])

  return (
    <PartnerHome
      greeting={greetingFor(now, session?.name)}
      selectedTenantId={selectedTenantId}
      data={data}
      openStatus={data.openingHours ? openStatus(data.openingHours, now) : null}
      archiveVisible={getArchiveNotice(now).visible}
      hrefs={{ settings, search, opti, quotes, orders }}
    />
  )
}
