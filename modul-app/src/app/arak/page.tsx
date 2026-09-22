import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ChevronDown } from 'lucide-react'

import {
  PricingAddonCards,
  PricingPlanCards
} from '@/components/marketing/pricing-sections'
import { MarketingShell } from '@/components/marketing/marketing-shell'
import { buttonVariants } from '@/components/ui/button'
import {
  formatHufPlain,
  MARKETING_PRICING,
  planEffectiveMonthlyFromYearly
} from '@/lib/marketing/pricing'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Árak',
  description:
    'Optinova: két hónap próba 0 Ft-ért. Utána 39 990 Ft nettó havonta. Külön rendelhető lapszabászat, jelenléti ív és belépőszámláló.'
}

const FAQ = [
  {
    q: 'Mennyi ideig ingyenes?',
    a: `Két hónapig 0 Ft a teljes Alap csomag havidíja. Utána ${formatHufPlain(MARKETING_PRICING.plan.priceMonthlyHuf)} + ÁFA havonta, díjbekérő alapján, utalással.`
  },
  {
    q: 'Nettó vagy bruttó?',
    a: 'A feltüntetett összegekhez az ÁFA még hozzáadódik.'
  },
  {
    q: 'Mennyibe kerül az éves előfizetés?',
    a: `${formatHufPlain(MARKETING_PRICING.plan.priceYearlyHuf)} + ÁFA évente. Tíz havi díjat számlázunk, a hozzáférés tizenkét hónapra szól. Ez havonta ${formatHufPlain(planEffectiveMonthlyFromYearly())} + ÁFA összegnek felel meg.`
  },
  {
    q: 'Mi van az Alapban?',
    a: 'Ajánlatok, értékesítés, készlet, beszerzés, pénztár, címkenyomtatás, ügyfelek és törzsadatok.'
  },
  {
    q: 'A lapszabászati modul tartalmazza a partnerfiókot?',
    a: `Igen. A partner saját fiókból küldheti be a rendelést. Az SMS-ek díja ${MARKETING_PRICING.addons.quote_ready_sms.priceUnitHuf} Ft + ÁFA darabonként.`
  },
  {
    q: 'Kell hardver a jelenléti ívhez?',
    a: 'Nem. A jelenlét kézzel is rögzíthető. Chipkártyás olvasó külön rendelhető.'
  },
  {
    q: 'Mit kell megvásárolni a belépőszámlálóhoz?',
    a: 'A modul havidíja mellett kamera szükséges. A kamera egyszeri díjára a helyszín ismeretében adunk ajánlatot.'
  },
  {
    q: 'Hogyan indul a próbaidő?',
    a: 'Egy rövid egyeztetés után beállítjuk a céges fiókot és aktiváljuk a hozzáférést.'
  }
] as const

const TRUST = [
  'Fizetés díjbekérő alapján, utalással',
  'Ugyanazt használod, mint előfizetőként',
  'Éves fizetésnél 2 hónap ajándék'
] as const

export default function PricingPage() {
  return (
    <MarketingShell activeHref="/arak">
      <article className="bg-white">
        <section>
          <div className="mx-auto max-w-2xl px-4 pt-14 text-center sm:px-6 sm:pt-16">
            <h1 className="text-[2rem] font-semibold tracking-tight text-ink sm:text-[2.75rem] sm:leading-[1.15]">
              Az első két hónap havidíja 0 Ft
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink-secondary">
              Ezalatt a teljes Alap csomagot használhatod. A próbaidő után a
              havidíj {formatHufPlain(MARKETING_PRICING.plan.priceMonthlyHuf)} +
              ÁFA.
            </p>
            <div className="mt-8">
              <Link
                href="/kapcsolat"
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'lg' }),
                  'h-11 no-underline'
                )}
              >
                Próbaidőt kérek
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {TRUST.map((item) => (
                <li
                  key={item}
                  className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted"
                >
                  <Check
                    className="size-3.5 shrink-0 text-ink"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="csomag" className="scroll-mt-20 pb-12 pt-10 sm:pb-16 sm:pt-12">
          <PricingPlanCards />
        </section>

        <section className="border-t border-border py-12 sm:py-16">
          <PricingAddonCards />
        </section>

        <section className="border-t border-border bg-subtle/40 py-12 sm:py-16">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <h2 className="text-center text-xl font-semibold tracking-tight text-ink">
              Gyakori kérdések
            </h2>
            <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-white">
              {FAQ.map((item) => (
                <details key={item.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13.5px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <ChevronDown
                      className="size-4 shrink-0 text-ink-muted transition-transform duration-fast group-open:rotate-180"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </summary>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <Link
                href="/kapcsolat"
                className={cn(
                  buttonVariants({ variant: 'secondary', size: 'md' }),
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
