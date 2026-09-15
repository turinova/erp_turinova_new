import type { Metadata } from 'next'
import Link from 'next/link'

import { partnerServerHref } from '@/lib/auth/partner-href-server'
import { getPartnerSession } from '@/lib/auth/partner-session'
import {
  PARTNER_HOST_LABEL,
  PARTNER_OPTI_PATH,
  PARTNER_ORDERS_PATH,
  PARTNER_QUOTES_PATH,
  PARTNER_SEARCH_PATH,
  PARTNER_SETTINGS_PATH
} from '@/lib/auth/surface'
import { resolvePartnerCompanyLabel } from '@/lib/partner/company-label'

export const metadata: Metadata = {
  title: 'Kezdőlap'
}

export default async function PartnerHomePage() {
  const session = await getPartnerSession()
  const companyLabel = await resolvePartnerCompanyLabel(
    session?.selectedTenantId ?? null
  )

  const [
    settingsHref,
    searchHref,
    optiHref,
    quotesHref,
    ordersHref
  ] = await Promise.all([
    partnerServerHref(PARTNER_SETTINGS_PATH),
    partnerServerHref(PARTNER_SEARCH_PATH),
    partnerServerHref(PARTNER_OPTI_PATH),
    partnerServerHref(PARTNER_QUOTES_PATH),
    partnerServerHref(PARTNER_ORDERS_PATH)
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-hint text-amber-950">
        <span className="font-semibold">Asztalos portál</span>
        {' · '}
        {PARTNER_HOST_LABEL} — nem a céges ERP
      </div>
      <div>
        <h1 className="text-h1 text-ink">Szia, {session?.name}!</h1>
        <p className="mt-1 text-body text-ink-secondary">
          Anyagkeresés és Opti rendelés a kapcsolt lapszabászat áraival. A
          beküldött ajánlatot a cég látja az app.optinova.hu-n.
        </p>
      </div>

      <section className="rounded-md border border-amber-200/80 bg-white p-4">
        <h2 className="text-body font-semibold text-ink">Kapcsolt lapszabászat</h2>
        <p className="mt-1 text-body text-ink">
          {companyLabel ?? 'Még nincs kapcsolt cég.'}
        </p>
        <Link
          href={settingsHref}
          className="mt-2 inline-block text-hint text-ink-secondary no-underline hover:underline"
        >
          Kapcsolt cég vagy profil módosítása →
        </Link>
      </section>

      <section className="rounded-md border border-dashed border-stone-300 bg-stone-50 p-4">
        <h2 className="text-body font-semibold text-ink">Következő lépések</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-body text-ink-secondary">
          <li>
            <Link
              href={searchHref}
              className="text-ink no-underline hover:underline"
            >
              Anyagkereső
            </Link>
          </li>
          <li>
            <Link
              href={optiHref}
              className="text-ink no-underline hover:underline"
            >
              Opti rendelés — draft mentés
            </Link>
          </li>
          <li>
            <Link
              href={quotesHref}
              className="text-ink no-underline hover:underline"
            >
              Ajánlataim — beküldés a cégnek
            </Link>
          </li>
          <li>
            <Link
              href={ordersHref}
              className="text-ink no-underline hover:underline"
            >
              Beküldött rendeléseim
            </Link>
          </li>
          <li>
            <Link
              href={settingsHref}
              className="text-ink no-underline hover:underline"
            >
              Beállítások
            </Link>
          </li>
        </ul>
      </section>
    </div>
  )
}
