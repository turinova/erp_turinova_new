import type { Metadata } from 'next'
import Link from 'next/link'

import { PARTNER_HOME_PATH, PARTNER_SETTINGS_PATH } from '@/lib/auth/surface'

export const metadata: Metadata = {
  title: 'Hamarosan · Asztalos'
}

export default function PartnerComingSoonPage({
  title,
  blurb
}: {
  title: string
  blurb: string
}) {
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <h1 className="text-h1 text-ink">{title}</h1>
      <p className="text-body text-ink-secondary">{blurb}</p>
      <p className="text-hint text-ink-muted">Ez a funkció hamarosan elérhető.</p>
      <div className="flex flex-wrap gap-3 pt-2 text-hint">
        <Link
          href={PARTNER_HOME_PATH}
          className="text-ink-secondary no-underline hover:underline"
        >
          ← Kezdőlap
        </Link>
        <Link
          href={PARTNER_SETTINGS_PATH}
          className="text-ink-secondary no-underline hover:underline"
        >
          Beállítások
        </Link>
      </div>
    </div>
  )
}
