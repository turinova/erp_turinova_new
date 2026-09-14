import type { Metadata } from 'next'
import Link from 'next/link'

import { partnerServerHref } from '@/lib/auth/partner-href-server'
import { PARTNER_HOME_PATH, PARTNER_SETTINGS_PATH } from '@/lib/auth/surface'

export const metadata: Metadata = {
  title: 'Hamarosan · Asztalos portál'
}

export default async function PartnerComingSoonPage({
  title,
  blurb
}: {
  title: string
  blurb: string
}) {
  const [homeHref, settingsHref] = await Promise.all([
    partnerServerHref(PARTNER_HOME_PATH),
    partnerServerHref(PARTNER_SETTINGS_PATH)
  ])

  return (
    <div className="mx-auto max-w-lg space-y-3">
      <h1 className="text-h1 text-ink">{title}</h1>
      <p className="text-body text-ink-secondary">{blurb}</p>
      <p className="text-hint text-ink-muted">Ez a funkció hamarosan elérhető.</p>
      <div className="flex flex-wrap gap-3 pt-2 text-hint">
        <Link
          href={homeHref}
          className="text-ink-secondary no-underline hover:underline"
        >
          ← Kezdőlap
        </Link>
        <Link
          href={settingsHref}
          className="text-ink-secondary no-underline hover:underline"
        >
          Beállítások
        </Link>
      </div>
    </div>
  )
}
