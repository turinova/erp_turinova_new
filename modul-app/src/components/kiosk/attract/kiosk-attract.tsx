'use client'

import { ArrowRight, Check, HelpCircle, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import {
  TenantHeroLogo,
  TurinovaPowered
} from '@/components/kiosk/kiosk-brand'
import { Button } from '@/components/ui/button'
import type { KioskSheetCard } from '@/lib/kiosk/bootstrap-types'
import { cn } from '@/lib/utils'

/** Ennél kevesebb kiemelt lapnál a jobb oldal az „Így működik” lépéseket mutatja. */
const MIN_SHEETS = 4

const STEPS = [
  'Válaszd ki a lapot',
  'Add meg a méreteket milliméterben',
  'Válaszd ki az élzárást (ha kell, megmunkálást is)',
  'A pultnál átnézzük veled, és ott fizetsz'
]

const STEPS_SHORT = [
  'Válaszd ki a lapot',
  'Add meg a méreteket',
  'Kérj élzárást',
  'Fizess a pultnál'
]

export function KioskAttract({
  tenantLabel,
  tenantLogoUrl,
  featuredSheets,
  onStart,
  onStartWithSheet
}: {
  tenantLabel: string
  tenantLogoUrl: string | null
  featuredSheets: KioskSheetCard[]
  onStart: () => void
  onStartWithSheet: (sheet: KioskSheetCard) => void
}) {
  const startRef = useRef<HTMLButtonElement>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if (helpOpen) return
    const id = window.setTimeout(() => startRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [helpOpen])

  useEffect(() => {
    if (helpOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (!t) return
      if (t.closest('[role="dialog"]')) return
      if (t.closest('[data-kiosk-attract-sheet]')) return
      if (t === startRef.current) return
      e.preventDefault()
      onStart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [helpOpen, onStart])

  const sorted = [...featuredSheets].sort(
    (a, b) => Number(b.onStock) - Number(a.onStock)
  )
  const sheets = sorted.slice(0, sorted.length >= 6 ? 6 : 4)
  const showSheets = sorted.length >= MIN_SHEETS

  return (
    <div className="flex min-h-[100dvh] flex-col bg-app">
      <div className="grid flex-1 lg:grid-cols-[minmax(0,52fr)_minmax(0,48fr)]">
        <section className="flex flex-col justify-center border-b border-border bg-surface px-8 py-12 md:px-14 lg:border-b-0 lg:border-r lg:px-20 lg:py-14 xl:px-24">
          <div className="w-full max-w-[720px]">
            <TenantHeroLogo name={tenantLabel} logoUrl={tenantLogoUrl} />

            <div className="mt-12 h-1 w-14 rounded-full bg-ink" aria-hidden />

            <h1 className="mt-10 text-[44px] font-semibold leading-[1.05] tracking-tight text-ink lg:text-[56px]">
              Bútorlap szabás méretre, élzárással
            </h1>
            <p className="mt-5 max-w-[580px] text-[20px] leading-snug text-ink-secondary lg:text-[22px]">
              Állítsd össze a rendelésed itt. A pultnál mindent átnézünk veled,
              mielőtt elindítanánk a gyártást.
            </p>

            <Button
              ref={startRef}
              type="button"
              variant="primary"
              className="mt-10 h-[72px] min-w-[340px] gap-3 px-9 text-[24px] font-semibold shadow-elev1 focus-visible:ring-4 focus-visible:ring-border-strong"
              onClick={onStart}
            >
              Rendelés indítása
              <ArrowRight className="size-7" aria-hidden />
            </Button>
            <p className="mt-3 text-[16px] text-ink-secondary">
              Pár perc, nem kell regisztrálni. Az árat a leadás előtt látod.
            </p>

            {showSheets ? (
              <>
                <ol className="mt-12 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-8 xl:grid-cols-4">
                  {STEPS_SHORT.map((text, i) => (
                    <li key={text} className="flex items-center gap-3">
                      <StepNumber n={i + 1} />
                      <span className="text-[17px] leading-snug text-ink">
                        {text}
                      </span>
                    </li>
                  ))}
                </ol>
                <NeedsLine className="mt-5" />
              </>
            ) : null}
          </div>
        </section>

        <section className="flex min-h-0 flex-col px-8 py-10 md:px-12 lg:py-12 xl:px-14">
          <div className="mb-6 flex items-start justify-between gap-4">
            {showSheets ? (
              <div>
                <h2
                  id="attract-sheets-title"
                  className="text-[24px] font-semibold text-ink"
                >
                  Népszerű lapok
                </h2>
                <p className="mt-1 text-[17px] text-ink-secondary">
                  Koppints egy lapra, és azzal kezdjük.
                </p>
              </div>
            ) : (
              <h2 className="text-[24px] font-semibold text-ink">
                Így működik
              </h2>
            )}
            <Button
              type="button"
              variant="secondary"
              className="h-12 shrink-0 gap-2 px-4 text-[16px] font-semibold"
              onClick={() => setHelpOpen(true)}
            >
              <HelpCircle className="size-5" aria-hidden />
              Segítség
            </Button>
          </div>

          {showSheets ? (
            <div
              role="group"
              aria-labelledby="attract-sheets-title"
              className="grid flex-1 grid-cols-2 gap-4 lg:min-h-0 lg:auto-rows-fr"
            >
              {sheets.map((s) => (
                <SheetTile
                  key={s.id}
                  sheet={s}
                  onPick={() => onStartWithSheet(s)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-center rounded-xl border border-border bg-surface px-8 py-8">
              <ol className="space-y-6">
                {STEPS.map((text, i) => (
                  <li key={text} className="flex items-start gap-4">
                    <StepNumber n={i + 1} large />
                    <span className="pt-1 text-[22px] leading-snug text-ink">
                      {text}
                    </span>
                  </li>
                ))}
              </ol>
              <NeedsLine className="mt-8 border-t border-border pt-6" />
            </div>
          )}
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-8 py-4 md:px-14 lg:px-20 xl:px-24">
        <p className="text-[16px] text-ink">
          <span className="font-semibold">Különleges kérésed van?</span>{' '}
          <span className="text-ink-secondary">Kérdezd a pultot.</span>
        </p>
        <TurinovaPowered compact />
      </footer>

      {helpOpen ? (
        <AttractHelp
          onClose={() => {
            setHelpOpen(false)
            requestAnimationFrame(() => startRef.current?.focus())
          }}
        />
      ) : null}
    </div>
  )
}

function SheetTile({
  sheet: s,
  onPick
}: {
  sheet: KioskSheetCard
  onPick: () => void
}) {
  return (
    <button
      type="button"
      data-kiosk-attract-sheet=""
      className="group flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface text-left shadow-elev1 transition-[border-color,box-shadow] hover:border-ink hover:shadow-elev2 focus-visible:border-ink focus-visible:shadow-elev2 focus-visible:outline-none"
      onClick={onPick}
    >
      <div
        className="aspect-[4/3] w-full border-b border-border lg:aspect-auto lg:min-h-[96px] lg:flex-1"
        style={
          s.imageUrl
            ? {
                backgroundImage: `url(${s.imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }
            : { background: s.swatch }
        }
        aria-hidden
      />
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[18px] font-semibold leading-snug text-ink">
            {s.name}
          </p>
          <p className="text-[15px] tabular-nums text-ink-secondary">
            {s.thicknessMm} mm
            {s.onStock ? ', raktáron' : ', rendelésre'}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[15px] font-semibold text-ink-muted transition-colors group-hover:text-ink group-focus-visible:text-ink">
          Ezzel kezdem
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </div>
    </button>
  )
}

function StepNumber({ n, large }: { n: number; large?: boolean }) {
  return (
    <span
      className={
        large
          ? 'flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-subtle text-[18px] font-semibold tabular-nums text-ink'
          : 'flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-subtle text-[15px] font-semibold tabular-nums text-ink'
      }
      aria-hidden
    >
      {n}
    </span>
  )
}

function NeedsLine({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'flex items-start gap-2.5 text-[16px] text-ink-secondary',
        className
      )}
    >
      <Check
        className="mt-0.5 size-5 shrink-0 stroke-[3] text-success-ink"
        aria-hidden
      />
      <span>
        <span className="font-semibold text-ink">Kell hozzá:</span> a méretek
        milliméterben és a telefonszámod (SMS-ben szólunk, ha kész).
      </span>
    </p>
  )
}

function AttractHelp({ onClose }: { onClose: () => void }) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-xl border border-border bg-surface shadow-elev3"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-[22px] font-semibold text-ink">
            Segítség
          </h2>
          <Button
            type="button"
            variant="ghost"
            className="size-11 p-0"
            aria-label="Bezárás"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden />
          </Button>
        </div>
        <ul className="space-y-4 px-5 py-5 text-[17px] leading-snug text-ink-secondary">
          <li>
            <p className="font-semibold text-ink">Mit tudok itt rendelni?</p>
            <p>
              Bútorlapot a saját méretedre vágva, élzárással. Ha kell,
              pánthellyel, duplungolással vagy sarokvágással is.
            </p>
          </li>
          <li>
            <p className="font-semibold text-ink">Mi van, ha elrontok valamit?</p>
            <p>
              Semmi gond. A pultnál mindent átnézünk veled, és ott még
              módosítjuk, mielőtt elindítanánk a gyártást.
            </p>
          </li>
          <li>
            <p className="font-semibold text-ink">Mikor fizetek?</p>
            <p>A pultnál, amikor átnéztük a rendelést.</p>
          </li>
          <li>
            <p className="font-semibold text-ink">Elakadtam</p>
            <p>Szólj bárkinek a pultnál, szívesen segítünk.</p>
          </li>
        </ul>
        <div className="border-t border-border px-5 py-4">
          <Button
            ref={closeRef}
            type="button"
            variant="primary"
            className="h-12 w-full text-[17px]"
            onClick={onClose}
          >
            Értem
          </Button>
        </div>
      </div>
    </div>
  )
}
