'use client'

import {
  AlertTriangle,
  Check,
  Drill,
  Frame,
  HelpCircle,
  Layers,
  Loader2,
  type LucideIcon,
  Ruler,
  ShoppingCart,
  UserRound,
  X
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import {
  TenantBrandMark,
  TurinovaPowered
} from '@/components/kiosk/kiosk-brand'
import { Button } from '@/components/ui/button'
import { FINISHED_SIZE_COPY, LEFTOVER_COPY } from '@/lib/kiosk/leftover'
import { formatHuf } from '@/lib/kiosk/mock-data'
import type { KioskStep } from '@/lib/kiosk/types'
import { cn } from '@/lib/utils'

const PROGRESS: Array<{
  id: Exclude<KioskStep, 'attract' | 'success'>
  label: string
  Icon: LucideIcon
}> = [
  { id: 'material', label: 'Anyag', Icon: Layers },
  { id: 'size', label: 'Méret', Icon: Ruler },
  { id: 'machining', label: 'Megmunkálás', Icon: Drill },
  { id: 'edge', label: 'Élzárás', Icon: Frame },
  { id: 'cart', label: 'Kosár', Icon: ShoppingCart },
  { id: 'details', label: 'Adatok', Icon: UserRound }
]

const SAFETY_NET_COPY = 'Nem végleges. A pultnál még mindent átnézünk veled.'

const STEP_INDEX: Record<string, number> = {
  material: 0,
  size: 1,
  machining: 2,
  edge: 3,
  cart: 4,
  details: 5
}

type KioskShellProps = {
  tenantLabel: string
  tenantLogoUrl: string | null
  step: KioskStep
  /** null = még nincs érvényes ár */
  totalGross: number | null
  /** Ár frissül — alsó sáv muted / … */
  priceLoading?: boolean
  /** Kosár panel-sorok száma (topbar badge). */
  cartPanelCount?: number
  onOpenCart?: () => void
  onBack?: () => void
  backDisabled?: boolean
  primaryLabel?: string
  primaryDisabled?: boolean
  primaryHint?: string
  onPrimary?: () => void
  primaryLoading?: boolean
  /** Outline secondary a primary mellett (pl. Él: „Él nélkül a kosárba”). */
  secondaryActionLabel?: string
  secondaryActionDisabled?: boolean
  onSecondaryAction?: () => void
  children: React.ReactNode
  /** Hide chrome (attract / success). */
  bare?: boolean
  /** Teljes szélesség (pl. Anyag katalógusfal) — nincs max-w-[1100px]. */
  wide?: boolean
  onIdleReset: () => void
  idleWarnSec?: number
  idleResetSec?: number
}

export function KioskShell({
  tenantLabel,
  tenantLogoUrl,
  step,
  totalGross,
  priceLoading = false,
  cartPanelCount = 0,
  onOpenCart,
  onBack,
  backDisabled,
  primaryLabel,
  primaryDisabled,
  primaryHint,
  onPrimary,
  primaryLoading,
  secondaryActionLabel,
  secondaryActionDisabled,
  onSecondaryAction,
  children,
  bare,
  wide = false,
  onIdleReset,
  idleWarnSec = 75,
  idleResetSec = 90
}: KioskShellProps) {
  /** Adatok: gépelés lassabb (50+) → legalább 120 mp figyelmeztetésig. */
  const warnSec =
    step === 'details' ? Math.max(120, idleWarnSec) : Math.max(30, idleWarnSec)
  const resetSec = warnSec + Math.max(15, idleResetSec - idleWarnSec)
  const idleWarnMs = warnSec * 1000
  const idleResetMs = resetSec * 1000
  const lastMoveRef = useRef(0)
  const [helpOpen, setHelpOpen] = useState(false)
  const [idleWarn, setIdleWarn] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(15)
  const [priceReveal, setPriceReveal] = useState(false)
  const prevTotalRef = useRef<number | null>(null)
  const titleId = useId()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const prev = prevTotalRef.current
    const next = totalGross
    prevTotalRef.current = next
    if (next == null || next < 0) {
      setPriceReveal(false)
      return
    }
    if (prev === next) return
    setPriceReveal(true)
    const id = window.setTimeout(() => setPriceReveal(false), 400)
    return () => window.clearTimeout(id)
  }, [totalGross])

  function clearIdleTimers() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (warnRef.current) clearTimeout(warnRef.current)
    if (tickRef.current) clearInterval(tickRef.current)
    timerRef.current = null
    warnRef.current = null
    tickRef.current = null
  }

  function bumpIdle() {
    if (step === 'attract') return
    clearIdleTimers()
    setIdleWarn(false)
    warnRef.current = setTimeout(() => {
      setIdleWarn(true)
      setSecondsLeft(15)
      tickRef.current = setInterval(() => {
        setSecondsLeft((s) => Math.max(0, s - 1))
      }, 1000)
    }, idleWarnMs)
    timerRef.current = setTimeout(() => {
      clearIdleTimers()
      setIdleWarn(false)
      onIdleReset()
    }, idleResetMs)
  }

  useEffect(() => {
    bumpIdle()
    return clearIdleTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset timers on step change
  }, [step])

  useEffect(() => {
    function onAct() {
      bumpIdle()
    }
    /** Egér/görgő: olvasás közben is aktív — throttle 1 mp. */
    function onPassive() {
      const now = Date.now()
      if (now - lastMoveRef.current < 1000) return
      lastMoveRef.current = now
      bumpIdle()
    }
    window.addEventListener('pointerdown', onAct)
    window.addEventListener('keydown', onAct)
    window.addEventListener('mousemove', onPassive, { passive: true })
    window.addEventListener('wheel', onPassive, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onAct)
      window.removeEventListener('keydown', onAct)
      window.removeEventListener('mousemove', onPassive)
      window.removeEventListener('wheel', onPassive)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const activeIdx = STEP_INDEX[step] ?? -1
  const showChrome = !bare

  return (
    <div
      className={cn(
        'relative flex flex-col bg-app text-ink',
        bare ? 'min-h-[100dvh]' : 'h-[100dvh] overflow-hidden'
      )}
    >
      {showChrome ? (
        <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-border bg-surface px-4 md:px-6">
          <div className="min-w-0 shrink-0">
            <TenantBrandMark
              name={tenantLabel}
              logoUrl={tenantLogoUrl}
              size="sm"
            />
          </div>

          <nav
            className="mx-auto flex min-w-0 flex-1 items-center justify-center gap-0.5 sm:gap-1"
            aria-label="Lépések"
          >
            {PROGRESS.map((p, i) => {
              const done = activeIdx > i
              const current = activeIdx === i
              const upcoming = !done && !current
              const StepIcon = p.Icon
              return (
                <div key={p.id} className="flex min-w-0 items-center gap-0.5 sm:gap-1">
                  {i > 0 ? (
                    <span
                      className={cn(
                        'mx-0.5 h-0.5 w-3 shrink-0 rounded-full sm:w-5 md:w-7',
                        done || current ? 'bg-success' : 'bg-border'
                      )}
                      aria-hidden
                    />
                  ) : null}
                  <div className="flex min-w-0 flex-col items-center gap-0.5">
                    <span
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-full transition-colors',
                        current && 'bg-ink text-white shadow-sm ring-2 ring-ink/15',
                        done &&
                          !current &&
                          'bg-success text-white',
                        upcoming &&
                          'border-2 border-border bg-surface text-ink-muted'
                      )}
                      aria-current={current ? 'step' : undefined}
                      title={p.label}
                    >
                      {done ? (
                        <Check className="size-4 stroke-[2.5]" aria-hidden />
                      ) : (
                        <StepIcon className="size-4" aria-hidden />
                      )}
                    </span>
                    <span
                      className={cn(
                        'hidden max-w-[5.5rem] truncate text-center text-[14px] leading-tight sm:block md:max-w-none md:text-[16px]',
                        current && 'font-semibold text-ink',
                        done && !current && 'font-medium text-success-ink',
                        upcoming && 'text-ink-secondary'
                      )}
                    >
                      {p.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              className="relative size-12 shrink-0 p-0"
              aria-label={
                cartPanelCount > 0
                  ? `Kosár megnyitása, ${cartPanelCount} panel`
                  : 'Kosár megnyitása'
              }
              onClick={onOpenCart}
            >
              <ShoppingCart className="size-6" aria-hidden />
              {cartPanelCount > 0 ? (
                <span className="absolute right-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1 text-[13px] font-semibold tabular-nums text-white">
                  {cartPanelCount > 99 ? '99+' : cartPanelCount}
                </span>
              ) : null}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="size-12 shrink-0 p-0"
              aria-label="Segítség"
              onClick={() => setHelpOpen(true)}
            >
              <HelpCircle className="size-6" aria-hidden />
            </Button>
          </div>
        </header>
      ) : null}

      {step === 'attract' ? (
        children
      ) : (
        <main
          className={cn(
            'flex w-full flex-1 flex-col',
            wide
              ? 'min-h-0 px-0 py-0'
              : 'mx-auto max-w-[1100px] px-4 py-5 md:px-6',
            showChrome && (primaryLabel || onBack) ? 'pb-28' : 'pb-6'
          )}
          onPointerDown={bumpIdle}
        >
          {children}
        </main>
      )}

      {showChrome && (primaryLabel || onBack) ? (
        <footer className="fixed inset-x-0 bottom-0 z-30 flex min-h-[96px] items-center gap-3 border-t border-border bg-surface px-4 py-3 md:px-6">
          <Button
            type="button"
            variant="secondary"
            disabled={backDisabled || !onBack}
            onClick={onBack}
            className="h-14 min-w-14 shrink-0 px-4 text-[16px]"
          >
            ← Vissza
          </Button>
          {primaryLabel ? (
            <>
              <div className="min-w-0 flex-1">
                {priceLoading ? (
                  <div
                    className="mx-auto flex w-full max-w-[240px] flex-col items-center gap-2"
                    role="status"
                    aria-live="polite"
                    aria-label="Árszámítás folyamatban"
                  >
                    <div className="flex items-center gap-2 text-ink">
                      <Loader2
                        className="size-5 shrink-0 animate-spin text-ink"
                        aria-hidden
                      />
                      <span className="text-[16px] font-semibold">
                        Optimalizálás
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                      <div className="h-full w-1/3 animate-[kiosk-progress_1.1s_ease-in-out_infinite] rounded-full bg-ink" />
                    </div>
                  </div>
                ) : primaryHint &&
                  (primaryDisabled || totalGross == null) ? (
                  <div className="flex justify-center">
                    <p
                      className="inline-flex max-w-full items-center gap-2.5 rounded-lg border-2 border-warning bg-warning-soft px-4 py-2.5 text-[18px] font-semibold text-warning-ink md:text-[19px]"
                      role="status"
                      aria-live="polite"
                    >
                      <AlertTriangle className="size-6 shrink-0" aria-hidden />
                      <span className="truncate">{primaryHint}</span>
                    </p>
                  </div>
                ) : totalGross != null && totalGross >= 0 ? (
                  <div
                    className={cn(
                      'mx-auto w-fit max-w-full rounded-xl border-2 border-success bg-success-soft px-5 py-2.5 text-center shadow-sm',
                      priceReveal &&
                        'animate-[kiosk-price-reveal_0.35s_ease-out]'
                    )}
                    role="status"
                    aria-live="polite"
                    aria-label={`Végösszeg bruttó ${formatHuf(totalGross)}`}
                  >
                    <p className="whitespace-nowrap text-[16px] font-semibold text-success-ink">
                      Végösszeg · bruttó
                    </p>
                    <p className="whitespace-nowrap text-[36px] font-semibold tabular-nums leading-none tracking-tight text-success-ink md:text-[40px]">
                      {formatHuf(totalGross)}
                    </p>
                    <p className="mt-1.5 hidden whitespace-nowrap text-[15px] text-success-ink/85 lg:block">
                      {SAFETY_NET_COPY}
                    </p>
                  </div>
                ) : (
                  <p className="text-center text-[16px] text-ink-secondary">
                    {SAFETY_NET_COPY}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
                {secondaryActionLabel && onSecondaryAction ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={secondaryActionDisabled}
                    onClick={onSecondaryAction}
                    className="h-14 border-2 border-ink/35 bg-transparent px-5 text-[16px] font-semibold hover:bg-subtle"
                  >
                    {secondaryActionLabel}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="primary"
                  disabled={primaryDisabled || primaryLoading}
                  loading={primaryLoading}
                  onClick={onPrimary}
                  aria-label={
                    primaryLoading ? 'Árszámítás folyamatban' : undefined
                  }
                  className={cn(
                    'h-14 min-w-[200px] px-6 text-[16px] font-semibold md:min-w-[260px] md:px-8 md:text-[17px]',
                    primaryLoading && 'min-w-[88px] px-5 [&_svg]:size-6'
                  )}
                >
                  {primaryLoading ? (
                    <span className="sr-only">Árszámítás…</span>
                  ) : (
                    primaryLabel
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="min-w-0 flex-1" aria-hidden />
          )}
        </footer>
      ) : null}

      {helpOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[70dvh] w-full max-w-lg overflow-auto rounded-t-2xl border border-border bg-surface p-5 shadow-elev3 sm:rounded-2xl"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id={titleId} className="text-[22px] font-semibold text-ink">
                Segítség
              </h2>
              <Button
                type="button"
                variant="ghost"
                className="size-11 p-0"
                aria-label="Bezárás"
                onClick={() => setHelpOpen(false)}
              >
                <X className="size-5" aria-hidden />
              </Button>
            </div>
            <ul className="space-y-4 text-[16px] text-ink-secondary">
              <li>
                <p className="font-semibold text-ink">Milliméterben írd a méretet</p>
                <p>Ha centivel mértél, szorozd 10-zel (80 cm → 800 mm).</p>
              </li>
              <li>
                <p className="font-semibold text-ink">
                  {FINISHED_SIZE_COPY.helpTitle}
                </p>
                <p>{FINISHED_SIZE_COPY.helpBody}</p>
              </li>
              <li>
                <p className="font-semibold text-ink">Szál és kereszt</p>
                <p>
                  A méret és az élek mindig szálirány és keresztirány szerint
                  vannak. Nincs „fent” vagy „lent” a bútorlapon.
                </p>
              </li>
              <li>
                <p className="font-semibold text-ink">Megmunkálás</p>
                <p>
                  Duplung, pánthely és szögvágás. Többet is kérhetsz egy
                  darabra. Ha nem kell semmi, nyomj Entert vagy Tovább.
                </p>
              </li>
              <li>
                <p className="font-semibold text-ink">Ár</p>
                <p>
                  A kosárban: „Ár kiszámítása”. Az összeg az alsó sávban
                  jelenik meg nagy számmal. Fizetés a pultnál.
                </p>
              </li>
              <li>
                <p className="font-semibold text-ink">Élzáró</p>
                <p>
                  A táblában válassz típust élénként. A rajzon A/B (és F =
                  ferde) mutatja, melyik élről van szó. Az élzáró mintákat a
                  kiosk mellett megnézheted.
                </p>
              </li>
              <li>
                <p className="font-semibold text-ink">{LEFTOVER_COPY.helpTitle}</p>
                <p>{LEFTOVER_COPY.helpBody}</p>
              </li>
              <li>
                <p className="font-semibold text-ink">Hibáztam, mi lesz?</p>
                <p>
                  Semmi gond. Leadás után a pultnál mindent átnézünk veled, és
                  ott még bármit módosíthatunk.
                </p>
              </li>
              <li>
                <p className="font-semibold text-ink">Fizetés</p>
                <p>A rendelés után a pultnál fizetsz, ott kapod az átvételt.</p>
              </li>
            </ul>
            <Button
              type="button"
              variant="primary"
              className="mt-5 h-12 w-full text-[16px]"
              onClick={() => setHelpOpen(false)}
            >
              Értem
            </Button>
            <TurinovaPowered className="mt-4" compact />
          </div>
        </div>
      ) : null}

      {idleWarn ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            role="alertdialog"
            aria-labelledby="idle-title"
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-elev3"
          >
            <h2 id="idle-title" className="text-[22px] font-semibold text-ink">
              Még itt vagy?
            </h2>
            <p className="mt-2 text-[16px] text-ink-secondary">
              {secondsLeft} mp múlva újrakezdjük a rendelést.
            </p>
            <Button
              type="button"
              variant="primary"
              className="mt-5 h-14 w-full text-[17px]"
              onClick={() => {
                setIdleWarn(false)
                bumpIdle()
              }}
            >
              Maradok
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
