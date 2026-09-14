import type { Metadata } from 'next'
import Link from 'next/link'

import { getPartnerSession } from '@/lib/auth/partner-session'
import {
  PARTNER_OPTI_PATH,
  PARTNER_ORDERS_PATH,
  PARTNER_QUOTES_PATH,
  PARTNER_SEARCH_PATH,
  PARTNER_SETTINGS_PATH
} from '@/lib/auth/surface'
import { resolvePartnerCompanyLabel } from '@/lib/partner/company-label'

export const metadata: Metadata = {
  title: 'Kezdőlap · Asztalos'
}

export default async function PartnerHomePage() {
  const session = await getPartnerSession()
  const companyLabel = await resolvePartnerCompanyLabel(
    session?.selectedTenantId ?? null
  )

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-h1 text-ink">Szia, {session?.name}!</h1>
        <p className="mt-1 text-body text-ink-secondary">
          Asztalos felület — keresés és lapszabászat a kapcsolt cégnél.
        </p>
      </div>

      <section className="rounded-md border border-primary/25 bg-primary-soft/40 p-4">
        <h2 className="text-body font-semibold text-ink">Kapcsolt cég</h2>
        <p className="mt-1 text-body text-ink">
          {companyLabel ?? 'Még nincs kapcsolt cég.'}
        </p>
        <Link
          href={PARTNER_SETTINGS_PATH}
          className="mt-2 inline-block text-hint text-ink-secondary no-underline hover:underline"
        >
          Kapcsolt cég vagy profil módosítása →
        </Link>
      </section>

      <section className="rounded-md border border-dashed border-border bg-subtle p-4">
        <h2 className="text-body font-semibold text-ink">Következő lépések</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-body text-ink-secondary">
          <li>
            <Link
              href={PARTNER_SEARCH_PATH}
              className="text-ink no-underline hover:underline"
            >
              Kereső
            </Link>
          </li>
          <li>
            <Link
              href={PARTNER_OPTI_PATH}
              className="text-ink no-underline hover:underline"
            >
              Opti — draft mentés
            </Link>
          </li>
          <li>
            <Link
              href={PARTNER_QUOTES_PATH}
              className="text-ink no-underline hover:underline"
            >
              Ajánlatok — beküldés
            </Link>
          </li>
          <li>
            <Link
              href={PARTNER_ORDERS_PATH}
              className="text-ink no-underline hover:underline"
            >
              Megrendelések
            </Link>
          </li>
          <li>
            <Link
              href={PARTNER_SETTINGS_PATH}
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
