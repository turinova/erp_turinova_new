'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  formatHufNet,
  formatHufPlain,
  MARKETING_PRICING
} from '@/lib/marketing/pricing'
import {
  computeRoi,
  formatHoursHu,
  formatMonthsHu,
  ROI_DEFAULTS,
  type RoiInputs
} from '@/lib/marketing/roi'
import { cn } from '@/lib/utils'

function Field({
  id,
  label,
  hint,
  children
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? (
        <p className="text-[12px] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  min = 0,
  step = 1
}: {
  id: string
  label: string
  hint?: string
  value: number
  onChange: (n: number) => void
  min?: number
  step?: number
}) {
  return (
    <Field id={id} label={label} hint={hint}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  )
}

function AddonToggle({
  id,
  label,
  price,
  checked,
  onChange
}: {
  id: string
  label: string
  price: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors',
        checked ? 'border-border-strong bg-subtle' : 'border-border bg-surface'
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 accent-[var(--primary)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        <span className="block text-[12px] text-ink-muted">{price}</span>
      </span>
    </label>
  )
}

export function RoiCalculator({
  id = 'kalkulator',
  className
}: {
  id?: string
  className?: string
}) {
  const [input, setInput] = useState<RoiInputs>(ROI_DEFAULTS)
  const result = useMemo(() => computeRoi(input), [input])

  const patch = (partial: Partial<RoiInputs>) =>
    setInput((prev) => ({ ...prev, ...partial }))

  const contactHref = `/kapcsolat?quotes=${encodeURIComponent(
    String(Math.round(input.quotesPerMonth))
  )}&net=${encodeURIComponent(String(Math.round(result.netMonthlyHuf)))}`

  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-20 rounded-xl border border-border bg-surface p-4 sm:p-6',
        className
      )}
    >
      <div className="mb-5 max-w-2xl">
        <p className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
          Megtérülés
        </p>
        <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-ink sm:text-[22px]">
          Számold ki, mennyi időt és forintot spórolhatsz
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-secondary">
          Konzervatív becslés a saját számaiddal. Az Alap első{' '}
          {MARKETING_PRICING.trialMonths} hónapja 0 Ft; a kalkulátor mutatja a
          próba alatti és a próba utáni díjat is. Nem garancia.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              id="quotes"
              label="Ajánlatok száma / hónap"
              value={input.quotesPerMonth}
              onChange={(n) => patch({ quotesPerMonth: n })}
            />
            <NumberField
              id="wage"
              label="Átlagos órabér (Ft)"
              hint="Teljes bérköltség / óra"
              value={input.hourlyWageHuf}
              onChange={(n) => patch({ hourlyWageHuf: n })}
              step={100}
            />
            <NumberField
              id="min-now"
              label="Perc / ajánlat most"
              value={input.minutesPerQuoteNow}
              onChange={(n) => patch({ minutesPerQuoteNow: n })}
            />
            <NumberField
              id="min-opti"
              label="Perc / ajánlat Optinovával"
              value={input.minutesPerQuoteWithOptinova}
              onChange={(n) => patch({ minutesPerQuoteWithOptinova: n })}
            />
            <NumberField
              id="prod-now"
              label="Gyártás szervezés óra / hét most"
              value={input.productionHoursPerWeekNow}
              onChange={(n) => patch({ productionHoursPerWeekNow: n })}
              step={0.5}
            />
            <NumberField
              id="prod-opti"
              label="Gyártás szervezés óra / hét Optinovával"
              value={input.productionHoursPerWeekWithOptinova}
              onChange={(n) =>
                patch({ productionHoursPerWeekWithOptinova: n })
              }
              step={0.5}
            />
            <NumberField
              id="sms-count"
              label="SMS db / hónap"
              hint={!input.smsAddon ? 'Kapcsold be az SMS add-ont' : undefined}
              value={input.smsPerMonth}
              onChange={(n) => patch({ smsPerMonth: n })}
            />
            <NumberField
              id="sms-min"
              label="Perc / SMS kézzel"
              value={input.minutesPerSmsManual}
              onChange={(n) => patch({ minutesPerSmsManual: n })}
            />
          </div>

          <div className="space-y-2">
            <p className="text-[13px] font-medium text-ink">Modulok a díjban</p>
            <div className="grid gap-2 sm:grid-cols-1">
              <AddonToggle
                id="addon-lapszab"
                label={MARKETING_PRICING.addons.lapszabaszat.name}
                price={`${formatHufPlain(MARKETING_PRICING.addons.lapszabaszat.priceMonthlyHuf)}/hó`}
                checked={input.lapszabaszatAddon}
                onChange={(v) => patch({ lapszabaszatAddon: v })}
              />
              <AddonToggle
                id="addon-jelenlet"
                label={MARKETING_PRICING.addons.jelenlet.name}
                price={`${formatHufPlain(MARKETING_PRICING.addons.jelenlet.priceMonthlyHuf)}/hó`}
                checked={input.jelenletAddon}
                onChange={(v) => patch({ jelenletAddon: v })}
              />
              <AddonToggle
                id="addon-sms"
                label={MARKETING_PRICING.addons.quote_ready_sms.name}
                price={`${formatHufPlain(MARKETING_PRICING.addons.quote_ready_sms.priceMonthlyHuf)}/hó + ${MARKETING_PRICING.addons.quote_ready_sms.priceUnitHuf} Ft/db`}
                checked={input.smsAddon}
                onChange={(v) => patch({ smsAddon: v })}
              />
              <AddonToggle
                id="addon-partner"
                label={MARKETING_PRICING.addons.partner_orders.name}
                price={`${formatHufPlain(MARKETING_PRICING.addons.partner_orders.priceMonthlyHuf)}/hó`}
                checked={input.partnerAddon}
                onChange={(v) => patch({ partnerAddon: v })}
              />
              <AddonToggle
                id="addon-foot"
                label={MARKETING_PRICING.addons.footcounter.name}
                price={`${formatHufPlain(MARKETING_PRICING.addons.footcounter.priceMonthlyHuf)}/hó + kamera egyszeri`}
                checked={input.footcounterAddon}
                onChange={(v) => patch({ footcounterAddon: v })}
              />
            </div>
            <p className="text-[12px] text-ink-muted">
              Alap: {formatHufNet(MARKETING_PRICING.plan.priceMonthlyHuf)}/hó ·
              első {MARKETING_PRICING.trialMonths} hónap az Alapban 0 Ft.
            </p>
          </div>
        </div>

        <div className="flex flex-col rounded-lg border border-border bg-subtle p-4 sm:p-5">
          <p className="text-[12px] font-medium text-ink-muted">Eredmény / hó</p>
          <dl className="mt-3 space-y-3 text-[14px]">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-secondary">Megspórolt idő</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatHoursHu(result.hoursTotal)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
              <dt className="text-ink-secondary">Megspórolt érték</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatHufPlain(result.savingsMonthlyHuf)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 rounded-md bg-orange-50 px-2 py-2">
              <dt className="text-[13px] text-orange-950">
                Első {result.trialMonths} hónap (Alap 0 Ft)
              </dt>
              <dd className="text-[13px] font-semibold tabular-nums text-orange-950">
                {formatHufNet(result.subscriptionDuringTrialHuf)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-secondary">Előfizetés próba után</dt>
              <dd className="tabular-nums text-ink">
                {formatHufNet(result.subscriptionMonthlyHuf)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
              <dt className="font-medium text-ink">Nettó nyereség / hó</dt>
              <dd
                className={cn(
                  'text-[18px] font-semibold tabular-nums',
                  result.netMonthlyHuf >= 0 ? 'text-success-ink' : 'text-danger-ink'
                )}
              >
                {formatHufPlain(result.netMonthlyHuf)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-secondary">Megtérülés</dt>
              <dd className="font-medium tabular-nums text-ink">
                {result.paybackMonths != null
                  ? formatMonthsHu(result.paybackMonths)
                  : '—'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-secondary">Éves spórolás (bruttó idő)</dt>
              <dd className="tabular-nums text-ink">
                {formatHufPlain(result.savingsYearlyHuf)}
              </dd>
            </div>
          </dl>

          <details className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-ink-secondary">
            <summary className="cursor-pointer font-medium text-ink">
              Feltételek és bontás
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Ajánlat: {formatHoursHu(result.hoursQuotes)}/hó</li>
              <li>Gyártás szervezés: {formatHoursHu(result.hoursProduction)}/hó</li>
              <li>SMS: {formatHoursHu(result.hoursSms)}/hó</li>
              <li>
                SMS usage a díjban:{' '}
                {formatHufPlain(result.smsUsageMonthlyHuf)}
              </li>
              <li>4,3 hét / hónap a heti óráknál</li>
              <li>Becslés, nem szerződéses ígéret</li>
            </ul>
          </details>

          <Link
            href={contactHref}
            className={cn(
              buttonVariants({ variant: 'primary', size: 'lg' }),
              'mt-5 w-full no-underline'
            )}
          >
            Konzultáció ezekkel a számokkal
          </Link>
          <Link
            href="/a-tortenetunk"
            className="mt-2 text-center text-[12px] text-ink-muted no-underline hover:text-ink hover:underline"
          >
            A történetünk — Hírös Ablak →
          </Link>
        </div>
      </div>
    </section>
  )
}
