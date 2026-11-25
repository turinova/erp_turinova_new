'use client'

import { Check, PackageCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  TenantBrandMark,
  TurinovaPowered
} from '@/components/kiosk/kiosk-brand'
import { Button } from '@/components/ui/button'
import { LEFTOVER_COPY } from '@/lib/kiosk/leftover'

const AUTO_RESET_SEC = 30

export function KioskSuccessStep({
  tenantLabel,
  tenantLogoUrl,
  guestName,
  hasLeftover = false,
  onAgain
}: {
  tenantLabel: string
  tenantLogoUrl: string | null
  guestName: string
  hasLeftover?: boolean
  onAgain: () => void
}) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_RESET_SEC)
  const name = guestName.trim()
  const progress = ((AUTO_RESET_SEC - secondsLeft) / AUTO_RESET_SEC) * 100

  useEffect(() => {
    const t = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1))
    }, 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (secondsLeft === 0) onAgain()
  }, [secondsLeft, onAgain])

  const steps = [
    {
      title: 'Menj a pulthoz',
      body: 'Mondd a neved. Együtt átnézzük a rendelést.'
    },
    {
      title: 'Aláírás és fizetés',
      body: 'Ha minden rendben, aláírod a rendelést, és a pultnál fizetsz.'
    },
    {
      title: 'SMS, ha kész',
      body: 'A pultnál megmondjuk, mikorra várható. SMS-ben szólunk, amikor elkészült.'
    }
  ]

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* Peak-end: a név a hero — ezt mondja a pultnál. */}
        <aside className="flex w-full shrink-0 flex-col justify-center gap-5 border-b border-border bg-surface px-8 py-6 md:h-full md:w-[46%] md:border-b-0 md:border-r md:px-10 md:py-8 lg:gap-6 lg:px-12">
          <TenantBrandMark
            name={tenantLabel}
            logoUrl={tenantLogoUrl}
            size="lg"
          />

          <div>
            <span className="flex size-20 items-center justify-center rounded-full bg-success text-white lg:size-24">
              <Check className="size-12 lg:size-14" strokeWidth={3} aria-hidden />
            </span>
            <h1 className="mt-5 text-[40px] font-semibold leading-none tracking-tight text-ink lg:mt-6 lg:text-[48px]">
              Köszönjük!
            </h1>
            {name ? (
              <p className="mt-4 max-w-full break-words text-[clamp(40px,5.5vw,80px)] font-semibold leading-[1.05] tracking-tight text-ink">
                {name}
              </p>
            ) : null}
            <p className="mt-3 text-[20px] leading-snug text-ink-secondary lg:mt-4 lg:text-[22px]">
              {name
                ? 'Mondd ezt a nevet a pultnál. A rendelésed beérkezett.'
                : 'A rendelésed beérkezett a pultra.'}
            </p>
          </div>

          {hasLeftover ? (
            <p className="flex items-start gap-3 rounded-xl border border-border bg-subtle px-4 py-3 text-[18px] leading-snug text-ink">
              <PackageCheck
                className="mt-0.5 size-5 shrink-0 text-success-ink"
                aria-hidden
              />
              {LEFTOVER_COPY.success}
            </p>
          ) : null}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-4 overflow-y-auto bg-app px-8 py-6 md:px-10 md:py-8 lg:gap-5 lg:px-12">
          <h2 className="text-[24px] font-semibold leading-tight text-ink lg:text-[28px]">
            Mi a következő lépés?
          </h2>
          <ol className="space-y-3 lg:space-y-4">
            {steps.map((s, i) => (
              <li
                key={s.title}
                className="flex gap-4 rounded-xl border border-border bg-surface px-4 py-3.5 shadow-sm lg:px-5 lg:py-4"
              >
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-[22px] font-semibold tabular-nums text-white lg:size-14 lg:text-[24px]"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[20px] font-semibold leading-tight text-ink lg:text-[24px]">
                    {s.title}
                  </p>
                  <p className="mt-1 text-[18px] leading-snug text-ink-secondary lg:text-[20px]">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-2.5 border-t border-border bg-surface px-6 py-4">
        <Button
          type="button"
          variant="primary"
          className="h-16 min-w-[320px] text-[22px] font-semibold"
          onClick={onAgain}
        >
          Új rendelés indítása
        </Button>
        <div className="w-full max-w-sm" aria-live="polite">
          <p className="text-center text-[17px] text-ink-secondary lg:text-[18px]">
            A képernyő {secondsLeft} mp múlva magától újraindul.
          </p>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-subtle"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={AUTO_RESET_SEC}
            aria-valuenow={secondsLeft}
            aria-label="Automatikus újraindítás"
          >
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <TurinovaPowered className="mt-1" />
      </div>
    </div>
  )
}
