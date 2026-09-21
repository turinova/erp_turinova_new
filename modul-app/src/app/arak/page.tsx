import type { Metadata } from 'next'
import Link from 'next/link'

import {
  PricingAddonsTable,
  PricingPlanCards
} from '@/components/marketing/pricing-sections'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { RoiCalculator } from '@/components/marketing/roi-calculator'
import { buttonVariants } from '@/components/ui/button'
import {
  formatHufNet,
  formatHufPlain,
  MARKETING_PRICING,
  planEffectiveMonthlyFromYearly
} from '@/lib/marketing/pricing'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Árak',
  description:
    'Optinova: 2 hónap automata próba, utána 39 990 Ft nettó/hó. Évesen 2 hónap ajándék. Add-on: lapszabászat, SMS, partner, jelenlét, belépőszámláló.'
}

const FAQ = [
  {
    q: 'Nettó vagy bruttó?',
    a: 'Minden listaár nettó HUF. Az ÁFA a számlán jelenik meg.'
  },
  {
    q: 'Hogyan működik a próba?',
    a: `Az Alap ${MARKETING_PRICING.trialMonths} hónapig automatikusan 0 Ft. Utána ${formatHufNet(MARKETING_PRICING.plan.priceMonthlyHuf)}/hó.`
  },
  {
    q: 'Éves fizetés?',
    a: `${formatHufNet(MARKETING_PRICING.plan.priceYearlyHuf)}/év (10× havi) — 2 hónap ajándék, effektív ${formatHufPlain(planEffectiveMonthlyFromYearly())}/hó.`
  },
  {
    q: 'Mi van az Alapban?',
    a: 'Eladás, árajánlat, készlet, beszerzés, POS, címke, törzsadat.'
  },
  {
    q: 'Belépőszámláló kamera?',
    a: `Havidíj ${formatHufPlain(MARKETING_PRICING.addons.footcounter.priceMonthlyHuf)} Ft + saját gyártású AI kamera egyszeri díja (árajánlat).`
  },
  {
    q: 'Jelenlét chipkártyával?',
    a: 'Nem kötelező. Manuális ív hardver nélkül is megy; chipkártyás olvasó opcionális, egyszeri hardverdíj.'
  },
  {
    q: 'SMS díjazás?',
    a: `${formatHufPlain(MARKETING_PRICING.addons.quote_ready_sms.priceMonthlyHuf)} Ft/hó + ${MARKETING_PRICING.addons.quote_ready_sms.priceUnitHuf} Ft/db.`
  },
  {
    q: 'Online fizetés?',
    a: 'Egyelőre manuális számlázás — konzultáció után aktiváljuk a próbát.'
  }
] as const

export default function PricingPage() {
  return (
    <MarketingShell activeHref="/arak">
      <article className="bg-white">
        {/* Hero — shadcn pricing: centered, short */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-16">
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Árak
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-ink-secondary">
              {MARKETING_PRICING.trialMonths} hónap próba, utána egy Alap ár.
              Évesen 2 hónap ajándék. Add-on csak ha kell.
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <PricingPlanCards />
        </section>

        <section className="border-t border-border bg-subtle/40 py-12 sm:py-16">
          <PricingAddonsTable />
        </section>

        <section className="border-t border-border py-12 sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <RoiCalculator id="kalkulator" />
          </div>
        </section>

        <section className="border-t border-border bg-subtle/40 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-ink">
              Gyakori kérdések
            </h2>
            <dl className="mt-8 divide-y divide-border rounded-xl border border-border bg-white">
              {FAQ.map((item) => (
                <div key={item.q} className="px-5 py-4">
                  <dt className="text-sm font-semibold text-ink">{item.q}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink-secondary">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 flex justify-center">
              <Link
                href="/kapcsolat"
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'md' }),
                  'no-underline'
                )}
              >
                Ingyenes konzultáció
              </Link>
            </div>
          </div>
        </section>
      </article>
    </MarketingShell>
  )
}
