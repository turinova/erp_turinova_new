import type { Metadata } from 'next'
import Link from 'next/link'

import { MarketingShell } from '@/components/marketing/marketing-shell'
import { RoiCalculator } from '@/components/marketing/roi-calculator'
import { buttonVariants } from '@/components/ui/button'
import {
  formatHufNet,
  formatHufPlain,
  MARKETING_PRICING
} from '@/lib/marketing/pricing'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Árak',
  description:
    'Optinova nettó listaárak: Alap, SMS, Online partner, Termék címke — megtérülés-kalkulátorral.'
}

const FAQ = [
  {
    q: 'Nettó vagy bruttó az ár?',
    a: 'Minden publikus listaár nettó HUF. A számlán a hatályos ÁFA szerint.'
  },
  {
    q: 'Van önkiszolgáló fizetés?',
    a: 'Egyelőre manuális számlázás: demó után egyeztetünk, majd aktiváljuk a csomagot.'
  },
  {
    q: 'Mi van az Alapban?',
    a: 'Ajánlatkészítés, törzsadat, műhelyhez kapcsolódó alapfolyamat. Az SMS, partnerportál és címke külön add-on.'
  },
  {
    q: 'Hogyan számolódik az SMS?',
    a: `Havi fix ${formatHufPlain(MARKETING_PRICING.addons.quote_ready_sms.priceMonthlyHuf)} + ${MARKETING_PRICING.addons.quote_ready_sms.priceUnitHuf} Ft/db a kiküldött üzenetekre.`
  }
] as const

export default function PricingPage() {
  const cards = [
    {
      name: MARKETING_PRICING.plan.name,
      price: formatHufNet(MARKETING_PRICING.plan.priceMonthlyHuf),
      detail: '/hó',
      blurb: MARKETING_PRICING.plan.blurb,
      featured: true
    },
    {
      name: MARKETING_PRICING.addons.quote_ready_sms.name,
      price: formatHufNet(
        MARKETING_PRICING.addons.quote_ready_sms.priceMonthlyHuf
      ),
      detail: `/hó + ${MARKETING_PRICING.addons.quote_ready_sms.priceUnitHuf} Ft/db`,
      blurb: MARKETING_PRICING.addons.quote_ready_sms.blurb,
      featured: false
    },
    {
      name: MARKETING_PRICING.addons.partner_orders.name,
      price: formatHufNet(
        MARKETING_PRICING.addons.partner_orders.priceMonthlyHuf
      ),
      detail: '/hó',
      blurb: MARKETING_PRICING.addons.partner_orders.blurb,
      featured: false
    },
    {
      name: MARKETING_PRICING.addons.product_labels.name,
      price: formatHufNet(
        MARKETING_PRICING.addons.product_labels.priceMonthlyHuf
      ),
      detail: '/hó',
      blurb: MARKETING_PRICING.addons.product_labels.blurb,
      featured: false
    }
  ]

  return (
    <MarketingShell activeHref="/arak">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="text-[2rem] font-semibold tracking-tight text-ink">
            Árak
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-secondary">
            Átlátható nettó listaárak. Nincs rejtett seat-díj a marketing
            oldalon — a kalkulátorban azonnal látod a havi becslést.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <article
              key={c.name}
              className={cn(
                'rounded-xl border bg-surface p-5',
                c.featured ? 'border-border-strong' : 'border-border'
              )}
            >
              <p className="text-[13px] font-medium text-ink-muted">{c.name}</p>
              <p className="mt-2 text-[22px] font-semibold tabular-nums tracking-tight text-ink">
                {c.price}
                <span className="ml-1 text-[13px] font-normal text-ink-muted">
                  {c.detail}
                </span>
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
                {c.blurb}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-ink-muted">
          Manuális számlázás · demó után aktiválás · ÁFA a számlán
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-10 sm:px-6 sm:pb-14">
        <RoiCalculator />
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 className="text-[18px] font-semibold text-ink">Gyakori kérdések</h2>
          <dl className="mt-6 space-y-5">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="text-[14px] font-semibold text-ink">{item.q}</dt>
                <dd className="mt-1 text-[14px] leading-relaxed text-ink-secondary">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
          <Link
            href="/kapcsolat"
            className={cn(
              buttonVariants({ variant: 'primary', size: 'md' }),
              'mt-8 inline-flex no-underline'
            )}
          >
            Ingyenes konzultáció
          </Link>
        </div>
      </section>
    </MarketingShell>
  )
}
