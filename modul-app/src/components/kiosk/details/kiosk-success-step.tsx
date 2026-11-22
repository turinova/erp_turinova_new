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
      body: name ? (
        <>
          Mondd a neved: <span className="font-semibold text-ink">{name}</span>.
          Együtt átnézzük a rendelést.
        </>
      ) : (
        'Mondd a neved. Együtt átnézzük a rendelést.'
      )
    },
    {
      title: 'Aláírás és fizetés',
      body: 'Ha minden rendben, aláírod a rendelést, és a pultnál fizetsz.'
    },
    {
      title: 'SMS, ha kész',
      body: 'A pultnál megmondjuk, mikorra várható. SMS-ben szólunk, amikor elkészült a gyártás.'
    }
  ]

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-8">
      <TenantBrandMark name={tenantLabel} logoUrl={tenantLogoUrl} size="md" />

      <div className="mt-8 w-full max-w-xl rounded-xl border border-border bg-surface">
        <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-success text-white">
            <Check className="size-9" strokeWidth={3} aria-hidden />
          </span>
          <h1 className="mt-5 text-[32px] font-semibold leading-tight text-ink">
            {name ? `Köszönjük, ${name}!` : 'Köszönjük!'}
          </h1>
          <p className="mt-2 text-[18px] text-ink-secondary">
            A rendelésed beérkezett a pultra.
          </p>
          {hasLeftover ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-subtle px-3 py-2.5 text-left text-[15px] text-ink">
              <PackageCheck
                className="mt-0.5 size-4 shrink-0 text-success-ink"
                aria-hidden
              />
              {LEFTOVER_COPY.success}
            </p>
          ) : null}
        </div>

        <div className="border-t border-border px-6 py-5">
          <h2 className="text-[17px] font-semibold text-ink">
            Mi a következő lépés?
          </h2>
          <ol className="mt-4 space-y-4">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-[16px] font-semibold tabular-nums text-white"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[17px] font-semibold text-ink">
                    {s.title}
                  </p>
                  <p className="text-[16px] leading-snug text-ink-secondary">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <Button
        type="button"
        variant="primary"
        className="mt-8 h-14 min-w-[260px] text-[18px] font-semibold"
        onClick={onAgain}
      >
        Új rendelés indítása
      </Button>
      <p className="mt-3 text-[15px] text-ink-secondary" aria-live="polite">
        A képernyő {secondsLeft} mp múlva magától újraindul.
      </p>
      <TurinovaPowered className="mt-6" />
    </div>
  )
}
