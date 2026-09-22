'use client'

import {
  ArrowRight,
  Camera,
  Check,
  ClipboardList,
  Factory
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import {
  formatHufPlain,
  MARKETING_PRICING,
  planEffectiveMonthlyFromYearly
} from '@/lib/marketing/pricing'
import { cn } from '@/lib/utils'

/** Alap kártya — a próba ára az elsődleges információ. */
export function PricingPlanCards() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const plan = MARKETING_PRICING.plan
  const effectiveMonthly = planEffectiveMonthlyFromYearly()

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <div className="flex justify-center">
        <div
          className="inline-flex items-center rounded-lg border border-border bg-subtle p-1"
          role="group"
          aria-label="Számlázás"
        >
          <button
            type="button"
            onClick={() => setBilling('monthly')}
            className={cn(
              'rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              billing === 'monthly'
                ? 'bg-white text-ink shadow-sm'
                : 'text-ink-secondary hover:text-ink'
            )}
          >
            Havi
          </button>
          <button
            type="button"
            onClick={() => setBilling('yearly')}
            className={cn(
              'rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              billing === 'yearly'
                ? 'bg-white text-ink shadow-sm'
                : 'text-ink-secondary hover:text-ink'
            )}
          >
            Éves
            <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">
              −2 hónap
            </span>
          </button>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-md">
        <div className="rounded-xl border border-border bg-white p-7 sm:p-8">
          <div className="text-center">
            <h2 className="text-[15px] font-semibold text-ink">{plan.name}</h2>
            <p className="mt-1 text-[13px] text-ink-secondary">
              A bolt napi munkájához szükséges funkciók
            </p>

            {billing === 'monthly' ? (
              <div className="mt-6">
                <p className="text-[2.75rem] font-semibold tabular-nums leading-none tracking-tight text-ink">
                  0&nbsp;Ft
                </p>
                <p className="mt-2 text-[13px] font-medium text-ink">
                  két hónap próba
                </p>
                <p className="mt-1 text-[13px] text-ink-muted">
                  utána {formatHufPlain(plan.priceMonthlyHuf)} + ÁFA / hó
                </p>
              </div>
            ) : (
              <div className="mt-6">
                <p className="text-[2.75rem] font-semibold tabular-nums leading-none tracking-tight text-ink">
                  {formatHufPlain(plan.priceYearlyHuf)}
                </p>
                <p className="mt-2 text-[13px] text-ink-muted">
                  + ÁFA / év
                </p>
                <p className="mt-1 text-[12.5px] text-ink-muted">
                  Havi {formatHufPlain(effectiveMonthly)} összegnek felel meg.
                  Tíz hónapot fizetsz, tizenkettőt kapsz.
                </p>
              </div>
            )}
          </div>

          <ul className="mt-7 space-y-2.5 border-t border-border pt-7">
            {plan.features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2.5 text-[13.5px] text-ink"
              >
                <Check
                  className="mt-0.5 size-3.5 shrink-0 text-ink"
                  strokeWidth={2.5}
                  aria-hidden
                />
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] italic text-ink-muted">
            {plan.featuresNote}
          </p>

          <Link
            href="/kapcsolat"
            className={cn(
              buttonVariants({ variant: 'primary', size: 'lg' }),
              'mt-7 flex w-full justify-center no-underline'
            )}
          >
            Próbaidőt kérek
          </Link>
          <p className="mt-3 text-center text-[12px] text-ink-muted">
            Nincs szerződéses kötelezettség, bármikor lemondható.
          </p>
        </div>
      </div>
    </div>
  )
}

const a = MARKETING_PRICING.addons

type AddonAccent = 'violet' | 'emerald' | 'indigo'

const ADDON_ACCENT_CLASSES: Record<AddonAccent, string> = {
  violet: 'bg-violet-50 text-violet-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  indigo: 'bg-indigo-50 text-indigo-600'
}

type AddonCard = {
  name: string
  href: string
  linkLabel: string
  blurb: string
  price: string
  priceNote: string
  bullets: string[]
  Icon: typeof Factory
  accent: AddonAccent
}

/** Kiegészítő modulok — színkódolt ikonnal a gyors megkülönböztetéshez. */
export function PricingAddonCards() {
  const cards: AddonCard[] = [
    {
      name: a.lapszabaszat.name,
      href: '/lapszabaszat',
      linkLabel: 'Lapszabászati modul részletei',
      blurb: a.lapszabaszat.blurb,
      price: formatHufPlain(a.lapszabaszat.priceMonthlyHuf),
      priceNote: `+ ÁFA / hó. SMS: ${a.quote_ready_sms.priceUnitHuf} Ft + ÁFA / db`,
      bullets: [
        'Táblás és szálas anyagok',
        'Élzárás és szabásjegyzék',
        'Partnerfiók és online rendelés',
        'Gyártási állapotok',
        `SMS az elkészült rendelésről: ${a.quote_ready_sms.priceUnitHuf} Ft / db`
      ],
      Icon: Factory,
      accent: a.lapszabaszat.accent
    },
    {
      name: a.jelenlet.name,
      href: '/jelenleti-iv',
      linkLabel: 'Jelenléti ív részletei',
      blurb: a.jelenlet.blurb,
      price: formatHufPlain(a.jelenlet.priceMonthlyHuf),
      priceNote: '+ ÁFA / hó',
      bullets: [
        'Dolgozók',
        'Napi jelenlét',
        'Chipkártyás olvasó külön kérhető'
      ],
      Icon: ClipboardList,
      accent: a.jelenlet.accent
    },
    {
      name: a.footcounter.name,
      href: '/beleposzamlalo',
      linkLabel: 'Belépőszámláló részletei',
      blurb: a.footcounter.blurb,
      price: formatHufPlain(a.footcounter.priceMonthlyHuf),
      priceNote: '+ ÁFA / hó',
      bullets: [
        'Óránkénti belépőszám',
        'Több bejárat',
        'A kamera egyszeri díjára külön ajánlatot adunk'
      ],
      Icon: Camera,
      accent: a.footcounter.accent
    }
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <div className="mx-auto max-w-lg text-center">
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          Kiegészítő modulok
        </h2>
        <p className="mt-2 text-[14px] text-ink-secondary">
          Az Alap csomag mellé külön rendelhetők.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.Icon
          return (
            <article
              key={card.href}
              className="group flex flex-col rounded-xl border border-border bg-white p-5 transition-colors hover:border-border-strong"
            >
              <span
                className={cn(
                  'inline-flex size-9 items-center justify-center rounded-lg',
                  ADDON_ACCENT_CLASSES[card.accent]
                )}
              >
                <Icon className="size-4" strokeWidth={2} aria-hidden />
              </span>
              <h3 className="mt-3.5 text-[14px] font-semibold text-ink">
                {card.name}
              </h3>
              <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-ink-secondary">
                {card.blurb}
              </p>

              <div className="mt-4">
                <p className="text-[1.375rem] font-semibold tabular-nums tracking-tight text-ink">
                  {card.price}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  {card.priceNote}
                </p>
              </div>

              <ul className="mt-4 space-y-1.5">
                {card.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2 text-[12.5px] text-ink"
                  >
                    <Check
                      className="mt-0.5 size-3 shrink-0 text-ink"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    {b}
                  </li>
                ))}
              </ul>

              <Link
                href={card.href}
                className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-ink no-underline underline-offset-4 group-hover:underline"
              >
                {card.linkLabel}
                <ArrowRight
                  className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </Link>
            </article>
          )
        })}
      </div>
    </div>
  )
}
