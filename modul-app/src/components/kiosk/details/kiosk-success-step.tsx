'use client'

import { Check, PackageCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  TenantHeroLogo,
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
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Peak-end hero — a név ez, amit a pultnál bemond. */}
        <aside className="flex w-full shrink-0 flex-col justify-center gap-6 border-b border-border bg-surface px-8 py-8 lg:h-full lg:w-[46%] lg:border-b-0 lg:border-r lg:px-14 lg:py-10 xl:px-16">
          {/* Ugyanaz a hero-méret, mint az Attracten — peak-end brand. */}
          <TenantHeroLogo name={tenantLabel} logoUrl={tenantLogoUrl} />

          <div>
            <span className="flex size-28 items-center justify-center rounded-full bg-success text-white">
              <Check className="size-16" strokeWidth={3} aria-hidden />
            </span>
            <h1 className="mt-6 text-[48px] font-semibold leading-none tracking-tight text-ink lg:text-[56px]">
              Köszönjük!
            </h1>
            {name ? (
              <p className="mt-5 max-w-full break-words text-[clamp(52px,5vw,96px)] font-semibold leading-[1.05] tracking-tight text-ink">
                {name}
              </p>
            ) : null}
            <p className="mt-4 text-[24px] leading-snug text-ink-secondary lg:text-[26px]">
              {name
                ? 'Mondd ezt a nevet a pultnál. A rendelésed beérkezett.'
                : 'A rendelésed beérkezett a pultra.'}
            </p>
          </div>

          {hasLeftover ? (
            <p className="flex max-w-xl items-start gap-3 rounded-xl border border-border bg-subtle px-4 py-3.5 text-[20px] leading-snug text-ink">
              <PackageCheck
                className="mt-0.5 size-5 shrink-0 text-success-ink"
                aria-hidden
              />
              {LEFTOVER_COPY.success}
            </p>
          ) : null}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col justify-center bg-app px-8 py-8 lg:px-14 lg:py-10 xl:px-16">
          <div className="w-full max-w-[900px]">
            <h2 className="text-[32px] font-semibold leading-tight text-ink lg:text-[36px]">
              Mi a következő lépés?
            </h2>
            <ol className="mt-6 space-y-4">
              {steps.map((s, i) => (
                <li
                  key={s.title}
                  className="flex gap-5 rounded-xl border border-border bg-surface px-5 py-5 shadow-sm"
                >
                  <span
                    className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-ink text-[28px] font-semibold tabular-nums text-white"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 pt-1">
                    <p className="text-[28px] font-semibold leading-tight text-ink lg:text-[30px]">
                      {s.title}
                    </p>
                    <p className="mt-1.5 text-[20px] leading-snug text-ink-secondary lg:text-[22px]">
                      {s.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      {/* Ugyanaz a lábléc-ritmus, mint a wizard chrome: bal meta · közép info · jobb primary */}
      <footer className="flex min-h-[96px] shrink-0 items-center gap-4 border-t border-border bg-surface px-6 py-3 md:px-8">
        <div className="hidden min-w-0 flex-1 sm:block">
          <TurinovaPowered />
        </div>
        <div className="min-w-0 flex-1 sm:max-w-md" aria-live="polite">
          <p className="text-center text-[18px] text-ink-secondary lg:text-[20px]">
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
        <div className="flex flex-1 justify-end">
          <Button
            type="button"
            variant="primary"
            className="h-16 min-w-[280px] px-8 text-[22px] font-semibold"
            onClick={onAgain}
          >
            Új rendelés indítása
          </Button>
        </div>
      </footer>
    </div>
  )
}
