'use client'

import { ArrowRight, Check, HelpCircle, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import {
  TenantBrandMark,
  TurinovaPowered
} from '@/components/kiosk/kiosk-brand'
import { Button } from '@/components/ui/button'
import type { KioskSheetCard } from '@/lib/kiosk/bootstrap-types'

const MAX_SHEETS = 6

const STEPS = [
  'Válaszd ki a lapot',
  'Add meg a méreteket milliméterben',
  'Válaszd ki az élzárást (ha kell, megmunkálást is)',
  'A pultnál átnézzük veled, és ott fizetsz'
]

const NEEDS = [
  'A méretek milliméterben',
  'A telefonszámod, hogy SMS-ben szólhassunk, ha kész'
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

  const sheets = [...featuredSheets]
    .sort((a, b) => Number(b.onStock) - Number(a.onStock))
    .slice(0, MAX_SHEETS)

  return (
    <div className="flex min-h-[100dvh] flex-col bg-app">
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-border bg-surface px-6 md:px-10">
        <TenantBrandMark name={tenantLabel} logoUrl={tenantLogoUrl} size="sm" />
        <Button
          type="button"
          variant="secondary"
          className="h-12 gap-2 px-4 text-[16px] font-semibold"
          onClick={() => setHelpOpen(true)}
        >
          <HelpCircle className="size-5" aria-hidden />
          Segítség
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-8 px-6 py-8 md:px-10 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
          <section>
            <h1 className="text-[38px] font-semibold leading-[1.1] tracking-tight text-ink md:text-[44px]">
              Bútorlap szabás méretre, élzárással
            </h1>
            <p className="mt-4 max-w-2xl text-[20px] leading-snug text-ink-secondary">
              Állítsd össze a rendelésed itt. A pultnál mindent átnézünk veled,
              mielőtt elindítanánk a gyártást.
            </p>

            <Button
              ref={startRef}
              type="button"
              variant="primary"
              className="mt-8 h-16 min-w-[300px] gap-3 px-8 text-[22px] font-semibold shadow-elev1 focus-visible:ring-4 focus-visible:ring-border-strong"
              onClick={onStart}
            >
              Rendelés indítása
              <ArrowRight className="size-6" aria-hidden />
            </Button>
            <p className="mt-3 text-[16px] text-ink-secondary">
              Pár perc, nem kell regisztrálni. Az árat a leadás előtt látod.
              Enterrel is indíthatod.
            </p>
          </section>

          <section className="space-y-6 rounded-xl border border-border bg-surface px-6 py-5">
            <InfoBlock title="Így működik">
              <ol className="space-y-3">
                {STEPS.map((text, i) => (
                  <li key={text} className="flex items-start gap-3.5">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-subtle text-[15px] font-semibold tabular-nums text-ink"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span className="pt-0.5 text-[18px] leading-snug text-ink">
                      {text}
                    </span>
                  </li>
                ))}
              </ol>
            </InfoBlock>

            <InfoBlock title="Ezekre lesz szükséged">
              <ul className="space-y-2.5">
                {NEEDS.map((text) => (
                  <li key={text} className="flex items-center gap-3">
                    <Check
                      className="size-5 shrink-0 stroke-[3] text-success-ink"
                      aria-hidden
                    />
                    <span className="text-[18px] text-ink">{text}</span>
                  </li>
                ))}
              </ul>
            </InfoBlock>
          </section>
        </div>

        {sheets.length > 0 ? (
          <section aria-labelledby="attract-sheets-title">
            <div className="mb-3">
              <h2
                id="attract-sheets-title"
                className="text-[20px] font-semibold text-ink"
              >
                Népszerű lapok
              </h2>
              <p className="text-[16px] text-ink-secondary">
                Kattints egy lapra, és azzal kezdjük.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {sheets.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  data-kiosk-attract-sheet=""
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface text-left shadow-elev1 transition-[border-color,box-shadow] hover:border-ink hover:shadow-elev2 focus-visible:border-ink focus-visible:shadow-elev2 focus-visible:outline-none"
                  onClick={() => onStartWithSheet(s)}
                >
                  <div
                    className="aspect-[4/3] w-full border-b border-border"
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
                  <div className="flex flex-1 flex-col gap-0.5 px-3 py-2.5">
                    <p className="line-clamp-2 text-[16px] font-semibold leading-snug text-ink">
                      {s.name}
                    </p>
                    <p className="text-[15px] tabular-nums text-ink-secondary">
                      {s.thicknessMm} mm
                      {s.onStock ? ', raktáron' : ', rendelésre'}
                    </p>
                    <p className="mt-auto flex items-center gap-1.5 pt-1.5 text-[15px] font-semibold text-ink-muted transition-colors group-hover:text-ink group-focus-visible:text-ink">
                      Ezzel kezdem
                      <ArrowRight className="size-4" aria-hidden />
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-6 py-4 md:px-10">
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

function InfoBlock({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="mb-3 text-[18px] font-semibold text-ink">{title}</h2>
      {children}
    </div>
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
