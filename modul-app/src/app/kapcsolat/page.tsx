import type { Metadata } from 'next'
import { Suspense } from 'react'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { ContactForm } from '@/components/marketing/contact-form'
import { COMPANY_LEGAL, SALES_CONTACT } from '@/lib/marketing/contact'

export const metadata: Metadata = {
  title: 'Kapcsolat',
  description:
    'Optinova elérhetőségek és visszahívás kérése. HÍRÖS-ABLAK Kft., Kecskemét.'
}

export default function ContactPage() {
  return (
    <MarketingShell activeHref="/kapcsolat">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-start">
            <div className="max-w-md">
              <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
                Kapcsolat
              </h1>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-secondary">
                Hagyd itt a számod, és visszahívunk. Hétköznap jellemzően még
                aznap, legkésőbb a következő munkanapon.
              </p>

              <dl className="mt-10 space-y-6">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    Székhely
                  </dt>
                  <dd className="mt-1.5 text-[14px] leading-relaxed text-ink">
                    {COMPANY_LEGAL.name}
                    <br />
                    {COMPANY_LEGAL.address}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    Telefon
                  </dt>
                  <dd className="mt-1.5">
                    <a
                      href={`tel:${SALES_CONTACT.phoneE164}`}
                      className="text-[14px] font-medium text-ink no-underline hover:underline"
                    >
                      {SALES_CONTACT.phoneDisplay}
                    </a>
                    <p className="mt-0.5 text-[13px] text-ink-secondary">
                      {SALES_CONTACT.name}
                    </p>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    E-mail
                  </dt>
                  <dd className="mt-1.5">
                    <a
                      href={`mailto:${SALES_CONTACT.email}`}
                      className="text-[14px] font-medium text-ink no-underline hover:underline"
                    >
                      {SALES_CONTACT.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    Cégadatok
                  </dt>
                  <dd className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
                    Adószám: {COMPANY_LEGAL.taxNumber}
                    <br />
                    Cégjegyzékszám: {COMPANY_LEGAL.companyReg}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="max-w-md lg:ml-auto lg:w-full">
              <Suspense
                fallback={
                  <p className="text-[13px] text-ink-muted">Űrlap betöltése…</p>
                }
              >
                <ContactForm />
              </Suspense>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
