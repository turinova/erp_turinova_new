import type { Metadata } from 'next'
import { Suspense } from 'react'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { ContactForm } from '@/components/marketing/contact-form'
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164
} from '@/lib/marketing/pricing'

export const metadata: Metadata = {
  title: 'Kapcsolat',
  description: 'Optinova ingyenes konzultáció és kapcsolat — HÍRÖS-ABLAK Kft.'
}

export default function ContactPage() {
  return (
    <MarketingShell activeHref="/kapcsolat">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="text-[2rem] font-semibold tracking-tight text-ink">
            Kapcsolat
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">
            Ingyenes konzultáció vagy bevezetés — rövid beszélgetés a te
            folyamataiddal. Nincs önkiszolgáló kártya.
          </p>
          <ul className="mt-6 space-y-2 text-[14px] text-ink-secondary">
            <li>
              <a
                href={`tel:${SUPPORT_PHONE_E164}`}
                className="font-medium text-ink no-underline hover:underline"
              >
                {SUPPORT_PHONE_DISPLAY}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-ink no-underline hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </li>
          </ul>

          <Suspense
            fallback={
              <p className="mt-8 text-[13px] text-ink-muted">Űrlap betöltése…</p>
            }
          >
            <ContactForm />
          </Suspense>
        </div>
      </section>
    </MarketingShell>
  )
}
