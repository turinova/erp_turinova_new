import type { Metadata } from 'next'

import {
  PartnerPaymentGuide,
  type PartnerPaymentGuideMode
} from '@/components/finance/partner-payment-guide'
import { getSessionUser } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Partner fizetés útmutató'
}

type SearchParams = Promise<{ mod?: string }>

function parseMode(raw: string | undefined): PartnerPaymentGuideMode {
  return raw === 'kartya' ? 'kartya' : 'utalas'
}

export default async function PartnerPaymentGuidePage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Partner fizetés útmutató</h1>
        <p className="text-body text-ink-secondary">Nincs aktív munkamenet.</p>
      </div>
    )
  }

  const sp = await searchParams
  const mode = parseMode(sp.mod)

  return <PartnerPaymentGuide mode={mode} />
}
