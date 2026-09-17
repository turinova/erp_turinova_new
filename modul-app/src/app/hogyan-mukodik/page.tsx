import type { Metadata } from 'next'
import Link from 'next/link'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { buttonVariants } from '@/components/ui/button'
import { MARKETING_PRICING } from '@/lib/marketing/pricing'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Hogyan működik',
  description:
    'Optinova funkciónként: ajánlat, SMS, partnerportál, termékcímke — rövid videókkal.'
}

const STEPS = [
  {
    id: 'ajanlat',
    title: 'Ajánlatkészítés',
    body: 'Méret, anyag, ár — egy helyen. Az ajánlat percek alatt kész, nem táblázatból másolva.',
    videoLabel: 'Videó: ajánlatkészítés'
  },
  {
    id: 'sms',
    title: MARKETING_PRICING.addons.quote_ready_sms.name,
    body: MARKETING_PRICING.addons.quote_ready_sms.blurb,
    videoLabel: 'Videó: SMS értesítés'
  },
  {
    id: 'partner',
    title: MARKETING_PRICING.addons.partner_orders.name,
    body: MARKETING_PRICING.addons.partner_orders.blurb,
    videoLabel: 'Videó: partnerportál'
  },
  {
    id: 'cimke',
    title: MARKETING_PRICING.addons.product_labels.name,
    body: MARKETING_PRICING.addons.product_labels.blurb,
    videoLabel: 'Videó: termékcímke'
  }
] as const

export default function HowItWorksPage() {
  return (
    <MarketingShell activeHref="/hogyan-mukodik">
      <article>
        <header className="border-b border-border bg-surface">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
            <h1 className="text-[2rem] font-semibold tracking-tight text-ink">
              Hogyan működik
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-secondary">
              Minden fő funkció külön — rövid videóval. Nézd végig, majd kérj
              ingyenes konzultációt, ha nálad is így menne a folyamat.
            </p>
            <nav
              className="mt-6 flex flex-wrap gap-2"
              aria-label="Funkciók"
            >
              {STEPS.map((step) => (
                <a
                  key={step.id}
                  href={`#${step.id}`}
                  className="rounded-md border border-border bg-subtle px-2.5 py-1 text-[12px] font-medium text-ink-secondary no-underline hover:text-ink"
                >
                  {step.title}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <div className="mx-auto max-w-3xl space-y-14 px-4 py-10 sm:px-6 sm:py-14">
          {STEPS.map((step, i) => (
            <section key={step.id} id={step.id} className="scroll-mt-20">
              <p className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
                {i + 1}. funkció
              </p>
              <h2 className="mt-1 text-[17px] font-semibold text-ink">
                {step.title}
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
                {step.body}
              </p>
              <div
                className="mt-5 flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-subtle"
                role="img"
                aria-label={step.videoLabel}
              >
                <span className="text-[13px] text-ink-muted">
                  {step.videoLabel} — hamarosan
                </span>
              </div>
            </section>
          ))}

          <div className="flex flex-wrap gap-3 border-t border-border pt-8">
            <Link
              href="/kapcsolat"
              className={cn(
                buttonVariants({ variant: 'primary', size: 'md' }),
                'no-underline'
              )}
            >
              Ingyenes konzultáció
            </Link>
            <Link
              href="/arak"
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'md' }),
                'no-underline'
              )}
            >
              Árak
            </Link>
          </div>
        </div>
      </article>
    </MarketingShell>
  )
}
