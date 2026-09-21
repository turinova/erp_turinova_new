'use client'

import { Check } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import {
  formatHufNet,
  formatHufPlain,
  MARKETING_PRICING,
  planEffectiveMonthlyFromYearly
} from '@/lib/marketing/pricing'
import { cn } from '@/lib/utils'

/** Klasszikus shadcn-szerű pricing: 1 kiemelt csomag + tiszta add-on lista. */
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
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
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
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              billing === 'yearly'
                ? 'bg-white text-ink shadow-sm'
                : 'text-ink-secondary hover:text-ink'
            )}
          >
            Éves
            <span className="ml-1.5 text-xs font-normal text-ink-muted">
              (−2 hónap)
            </span>
          </button>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-lg">
        <div className="relative rounded-2xl border-2 border-ink bg-white p-8 shadow-sm">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">
              {MARKETING_PRICING.trialMonths} hónap próba · 0 Ft
            </span>
          </div>

          <div className="text-center">
            <h2 className="text-lg font-semibold text-ink">{plan.name}</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Minden bolt-funkció egy árban
            </p>

            {billing === 'monthly' ? (
              <div className="mt-6">
                <p className="text-4xl font-semibold tabular-nums tracking-tight text-ink">
                  {formatHufPlain(plan.priceMonthlyHuf)}
                </p>
                <p className="mt-1 text-sm text-ink-muted">nettó / hó · próba után</p>
              </div>
            ) : (
              <div className="mt-6">
                <p className="text-4xl font-semibold tabular-nums tracking-tight text-ink">
                  {formatHufPlain(plan.priceYearlyHuf)}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  nettó / év · {formatHufPlain(effectiveMonthly)}/hó effektív
                </p>
              </div>
            )}
          </div>

          <ul className="mt-8 space-y-3 border-t border-border pt-8">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-ink">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-ink"
                  strokeWidth={2.5}
                  aria-hidden
                />
                {f}
              </li>
            ))}
          </ul>

          <Link
            href="/kapcsolat"
            className={cn(
              buttonVariants({ variant: 'primary', size: 'lg' }),
              'mt-8 flex w-full justify-center no-underline'
            )}
          >
            Indítom a próbaidőt
          </Link>
          <p className="mt-3 text-center text-xs text-ink-muted">
            Automatikus {MARKETING_PRICING.trialMonths} hónap · nettó árak · ÁFA
            a számlán
          </p>
        </div>
      </div>
    </div>
  )
}

export function PricingAddonsTable() {
  const rows = [
    {
      name: MARKETING_PRICING.addons.lapszabaszat.name,
      price: `${formatHufPlain(MARKETING_PRICING.addons.lapszabaszat.priceMonthlyHuf)} Ft/hó`,
      note: MARKETING_PRICING.addons.lapszabaszat.blurb
    },
    {
      name: MARKETING_PRICING.addons.quote_ready_sms.name,
      price: `${formatHufPlain(MARKETING_PRICING.addons.quote_ready_sms.priceMonthlyHuf)} Ft/hó + ${MARKETING_PRICING.addons.quote_ready_sms.priceUnitHuf} Ft/db`,
      note: MARKETING_PRICING.addons.quote_ready_sms.blurb
    },
    {
      name: MARKETING_PRICING.addons.partner_orders.name,
      price: `${formatHufPlain(MARKETING_PRICING.addons.partner_orders.priceMonthlyHuf)} Ft/hó`,
      note: MARKETING_PRICING.addons.partner_orders.blurb
    },
    {
      name: MARKETING_PRICING.addons.jelenlet.name,
      price: `${formatHufPlain(MARKETING_PRICING.addons.jelenlet.priceMonthlyHuf)} Ft/hó`,
      note: 'Hardver nélkül is. Chipkártya opcionális — egyszeri hardverdíj.'
    },
    {
      name: MARKETING_PRICING.addons.footcounter.name,
      price: `${formatHufPlain(MARKETING_PRICING.addons.footcounter.priceMonthlyHuf)} Ft/hó`,
      note: 'AI kamera — egyszeri hardverdíj, árajánlat szerint.'
    }
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          Add-onok
        </h2>
        <p className="mt-2 text-sm text-ink-secondary">
          Csak ha kell. Nettó havidíjak — hardver egyszeri, külön árajánlat.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-subtle/80">
              <th className="px-4 py-3 font-medium text-ink-secondary sm:px-5">
                Modul
              </th>
              <th className="px-4 py-3 font-medium text-ink-secondary sm:px-5">
                Ár
              </th>
              <th className="hidden px-4 py-3 font-medium text-ink-secondary md:table-cell md:px-5">
                Megjegyzés
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-border last:border-0">
                <td className="px-4 py-4 align-top font-medium text-ink sm:px-5">
                  {row.name}
                  <p className="mt-1 text-xs font-normal text-ink-muted md:hidden">
                    {row.note}
                  </p>
                </td>
                <td className="px-4 py-4 align-top tabular-nums text-ink sm:px-5">
                  {row.price}
                </td>
                <td className="hidden px-4 py-4 align-top text-ink-secondary md:table-cell md:px-5">
                  {row.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
