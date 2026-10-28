'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { saveDailyReconciliation } from '@/lib/daily-reconciliation/actions'
import {
  dayLabelHu,
  formatReconMoney,
  RECON_BONUS,
  RECON_TENDER_LABEL,
  RECON_TENDERS,
  RECON_THRESHOLDS,
  shiftYearMonth,
  tenderWithinThreshold,
  todayBudapest,
  yearMonthLabel,
  type DayChipStatus,
  type ReconTender
} from '@/lib/daily-reconciliation/parse'
import type {
  DailyReconDay,
  DailyReconMonthSummary
} from '@/lib/daily-reconciliation/queries'
import { cn } from '@/lib/utils'

type Props = {
  yearMonth: string
  days: DailyReconDay[]
  summary: DailyReconMonthSummary
  canWrite: boolean
  initialDate: string
}

const TENDER_HINT: Record<ReconTender, string> = {
  cash: 'Számold össze a fiókban lévő készpénzt',
  card: 'Nézd meg a terminál / bank napi összegét',
  transfer: 'Ami utalással jött be (vagy 0)'
}

function chipTone(
  status: DayChipStatus
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ok') return 'success'
  if (status === 'variance') return 'danger'
  if (status === 'partial') return 'warning'
  return 'neutral'
}

function chipLabel(status: DayChipStatus): string {
  if (status === 'ok') return 'OK'
  if (status === 'variance') return 'Eltérés'
  if (status === 'partial') return 'Részleges'
  return 'Hiányzik'
}

function parseFtInput(raw: string): number | null {
  const digits = raw.replace(/\s/g, '').replace(/[^\d]/g, '')
  if (digits === '') return null
  const n = Number(digits)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

function formatInputFt(n: number | null): string {
  if (n == null) return ''
  return new Intl.NumberFormat('hu-HU').format(n)
}

function sameStore(
  a: { cash: number | null; card: number | null; transfer: number | null },
  b: { cash: number | null; card: number | null; transfer: number | null },
  noteA: string,
  noteB: string
) {
  return (
    a.cash === b.cash &&
    a.card === b.card &&
    a.transfer === b.transfer &&
    noteA.trim() === noteB.trim()
  )
}

function settlementNextStep(summary: DailyReconMonthSummary): string {
  if (summary.filledCount === 0) {
    return 'Töltsd ki az első napokat — utána megjelenik a pontosság.'
  }
  if (summary.filledCount < RECON_BONUS.minFilledDays) {
    return `Még ${RECON_BONUS.minFilledDays - summary.filledCount} kitöltött nap kell a bónuszhoz (min. ${RECON_BONUS.minFilledDays}).`
  }
  if (summary.bonusTier === 95) {
    return `Maximum sáv: ${formatReconMoney(RECON_BONUS.staff95)} / fő.`
  }
  if (summary.bonusTier === 90) {
    const need95 = Math.ceil(summary.filledCount * 0.95) - summary.okCount
    if (need95 > 0) {
      return `90% sáv megvan (${formatReconMoney(RECON_BONUS.staff90)}). Még kb. ${need95} OK nap a ${formatReconMoney(RECON_BONUS.staff95)}-hoz.`
    }
    return '90% sáv megvan. Tartsd 95% felett a magasabb sávhoz.'
  }
  const need90 = Math.ceil(summary.filledCount * 0.9) - summary.okCount
  if (need90 > 0) {
    return `Még kb. ${need90} OK nap a 90%-os sávhoz.`
  }
  return '90% alatt — a kitöltött napok közül túl sok az eltérés.'
}

export function DailyReconciliationClient({
  yearMonth,
  days,
  summary,
  canWrite,
  initialDate
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const today = todayBudapest()
  const skipSyncRef = useRef(false)

  const dayMap = useMemo(() => {
    const m = new Map<string, DailyReconDay>()
    for (const d of days) m.set(d.date, d)
    return m
  }, [days])

  const defaultDate = dayMap.has(initialDate)
    ? initialDate
    : dayMap.has(today)
      ? today
      : (days.find((d) => d.date <= today)?.date ??
        days[days.length - 1]?.date ??
        today)

  const [selectedDate, setSelectedDate] = useState(defaultDate)
  const selected = dayMap.get(selectedDate)

  const [cashDraft, setCashDraft] = useState(
    formatInputFt(selected?.store.cash ?? null)
  )
  const [cardDraft, setCardDraft] = useState(
    formatInputFt(selected?.store.card ?? null)
  )
  const [transferDraft, setTransferDraft] = useState(
    formatInputFt(selected?.store.transfer ?? null)
  )
  const [noteDraft, setNoteDraft] = useState(selected?.note ?? '')
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(Boolean(selected?.note))

  function syncFromDay(d: DailyReconDay | undefined) {
    setCashDraft(formatInputFt(d?.store.cash ?? null))
    setCardDraft(formatInputFt(d?.store.card ?? null))
    setTransferDraft(formatInputFt(d?.store.transfer ?? null))
    setNoteDraft(d?.note ?? '')
    setNoteOpen(Boolean(d?.note))
  }

  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false
      return
    }
    syncFromDay(dayMap.get(selectedDate))
  }, [dayMap, selectedDate])

  const drafts: Record<ReconTender, number | null> = {
    cash: parseFtInput(cashDraft),
    card: parseFtInput(cardDraft),
    transfer: parseFtInput(transferDraft)
  }

  const dirty = Boolean(
    selected &&
      !sameStore(
        drafts,
        selected.store,
        noteDraft,
        selected.note ?? ''
      )
  )

  function confirmLeave(): boolean {
    if (!dirty) return true
    return window.confirm(
      'Mentetlen változtatások vannak. Elveted és váltasz?'
    )
  }

  function selectDay(date: string) {
    if (date === selectedDate) return
    if (date > today) return
    if (!confirmLeave()) return
    setSelectedDate(date)
  }

  function goMonth(delta: number) {
    if (!confirmLeave()) return
    const next = shiftYearMonth(yearMonth, delta)
    startTransition(() => {
      router.push(`/ertekesitesek/napi-egyeztetes?month=${next}`)
    })
  }

  const system = selected?.system ?? { cash: 0, card: 0, transfer: 0 }
  const systemSales = selected?.systemSales ?? { cash: 0, card: 0, transfer: 0 }
  const systemLapszab = selected?.systemLapszab ?? {
    cash: 0,
    card: 0,
    transfer: 0
  }
  const salesDayTotal =
    systemSales.cash + systemSales.card + systemSales.transfer
  const lapszabDayTotal =
    systemLapszab.cash + systemLapszab.card + systemLapszab.transfer
  const systemDayTotal = system.cash + system.card + system.transfer
  const systemEmpty = systemDayTotal === 0

  const liveVariance = RECON_TENDERS.some((t) => {
    const store = drafts[t]
    return store != null && !tenderWithinThreshold(t, system[t], store)
  })
  const largeVariance = RECON_TENDERS.some((t) => {
    const store = drafts[t]
    if (store == null) return false
    const delta = Math.abs(store - system[t])
    if (t === 'cash') return delta > RECON_THRESHOLDS.cashAbs * 3
    if (t === 'transfer') return delta > RECON_THRESHOLDS.transferAbs * 3
    return (
      delta >
      Math.max(RECON_THRESHOLDS.cardAbs, system.card * RECON_THRESHOLDS.cardPct) *
        3
    )
  })

  useEffect(() => {
    if (liveVariance && !noteOpen) setNoteOpen(true)
  }, [liveVariance, noteOpen])

  const filledCount = RECON_TENDERS.filter((t) => drafts[t] != null).length
  const missingCount = RECON_TENDERS.length - filledCount

  function handleSave() {
    if (!selected) return
    startTransition(async () => {
      const result = await saveDailyReconciliation({
        businessDate: selected.date,
        storeCash: drafts.cash,
        storeCard: drafts.card,
        storeTransfer: drafts.transfer,
        note: noteDraft.trim() || null,
        systemCash: system.cash,
        systemCard: system.card,
        systemTransfer: system.transfer
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      skipSyncRef.current = true
      if (missingCount > 0) {
        toast.success(
          `Mentve. Még ${missingCount} szám hiányzik a teljes záráshoz.`
        )
      } else if (liveVariance) {
        toast.success('Mentve — van eltérés a küszöbön kívül.')
      } else {
        toast.success('Zárás mentve.')
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Napi zárás"
        description="Írd be, ami a boltban tényleg bent volt."
        actions={
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => goMonth(-1)}
              aria-label="Előző hónap"
            >
              <ChevronLeft className="size-3.5" aria-hidden />
            </Button>
            <span className="min-w-[9rem] text-center text-body font-medium capitalize text-ink">
              {yearMonthLabel(yearMonth)}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => goMonth(1)}
              aria-label="Következő hónap"
            >
              <ChevronRight className="size-3.5" aria-hidden />
            </Button>
          </div>
        }
      />

      <section className="rounded-md border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="min-w-0">
            <h2 className="text-body font-medium capitalize text-ink">
              {selected ? dayLabelHu(selected.date) : '—'}
            </h2>
            {selected ? (
              <StatusBadge tone={chipTone(selected.status)} className="mt-1">
                {chipLabel(selected.status)}
              </StatusBadge>
            ) : null}
          </div>
          {canWrite ? (
            <Button
              type="button"
              disabled={pending || !selected || !dirty}
              onClick={handleSave}
            >
              Zárás mentése
            </Button>
          ) : null}
        </div>

        <div className="space-y-3 px-3 py-3">
          {systemEmpty ? (
            <p className="rounded-md border border-dashed border-border bg-subtle px-3 py-2 text-body text-ink-secondary">
              Ma még nincs rögzített forgalom a gépben. Ha tényleg semmi sem
              volt, írj be 0-t mindhárom mezőbe.
            </p>
          ) : null}

          {RECON_TENDERS.map((tender, index) => {
            const sys = system[tender]
            const store = drafts[tender]
            const delta = store == null ? null : store - sys
            const ok =
              store != null && tenderWithinThreshold(tender, sys, store)
            const draftKey =
              tender === 'cash'
                ? cashDraft
                : tender === 'card'
                  ? cardDraft
                  : transferDraft
            const setDraft =
              tender === 'cash'
                ? setCashDraft
                : tender === 'card'
                  ? setCardDraft
                  : setTransferDraft
            const inputId = `recon-${tender}`

            return (
              <div
                key={tender}
                className="rounded-md border border-border bg-subtle/40 px-3 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-body font-semibold text-ink">
                    <span className="mr-1.5 text-ink-muted">{index + 1}.</span>
                    {RECON_TENDER_LABEL[tender]}
                  </p>
                  {delta == null ? (
                    <span className="text-hint text-ink-muted">—</span>
                  ) : (
                    <span
                      className={cn(
                        'text-hint font-medium tabular-nums',
                        ok ? 'text-success-ink' : 'text-danger-ink'
                      )}
                    >
                      {ok ? 'OK' : 'Eltérés'}{' '}
                      {`${delta > 0 ? '+' : ''}${formatReconMoney(delta)}`}
                    </span>
                  )}
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-hint text-ink-muted">Gép szerint</p>
                    <p className="mt-0.5 text-body font-medium tabular-nums text-ink">
                      {formatReconMoney(sys)}
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor={inputId}
                      className="text-hint font-medium text-ink-secondary"
                    >
                      Amit te számoltál
                    </label>
                    <Input
                      id={inputId}
                      inputMode="numeric"
                      disabled={!canWrite || pending || selectedDate > today}
                      value={draftKey}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="0"
                      className="mt-1 h-10 max-w-full text-body tabular-nums sm:max-w-[12rem]"
                    />
                    <p className="mt-1 text-hint text-ink-muted">
                      {TENDER_HINT[tender]}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}

          {largeVariance ? (
            <p
              className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-body text-warning-ink"
              role="status"
            >
              Ez nagy eltérés — ellenőrizd a számolást, mielőtt mentenél.
            </p>
          ) : null}

          <div className="border-t border-border pt-2">
            <button
              type="button"
              className="flex w-full items-center gap-1.5 text-left text-body text-ink-secondary hover:text-ink"
              onClick={() => setBreakdownOpen((v) => !v)}
              aria-expanded={breakdownOpen}
            >
              <ChevronDown
                className={cn(
                  'size-3.5 shrink-0 transition-transform',
                  breakdownOpen && 'rotate-180'
                )}
                aria-hidden
              />
              Honnan jön a gép száma?
            </button>
            {breakdownOpen ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-subtle px-3 py-2">
                  <p className="text-hint text-ink-muted">Termék / POS</p>
                  <p className="mt-0.5 text-body font-semibold tabular-nums text-ink">
                    {formatReconMoney(salesDayTotal)}
                  </p>
                  <p className="mt-0.5 text-hint tabular-nums text-ink-secondary">
                    KP {formatReconMoney(systemSales.cash)} · kártya{' '}
                    {formatReconMoney(systemSales.card)} · utalás{' '}
                    {formatReconMoney(systemSales.transfer)}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-subtle px-3 py-2">
                  <p className="text-hint text-ink-muted">Lapszabászat</p>
                  <p className="mt-0.5 text-body font-semibold tabular-nums text-ink">
                    {formatReconMoney(lapszabDayTotal)}
                  </p>
                  <p className="mt-0.5 text-hint tabular-nums text-ink-secondary">
                    KP {formatReconMoney(systemLapszab.cash)} · kártya{' '}
                    {formatReconMoney(systemLapszab.card)} · utalás{' '}
                    {formatReconMoney(systemLapszab.transfer)}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <button
              type="button"
              className="flex w-full items-center gap-1.5 text-left text-body text-ink-secondary hover:text-ink"
              onClick={() => setNoteOpen((v) => !v)}
              aria-expanded={noteOpen}
            >
              <ChevronDown
                className={cn(
                  'size-3.5 shrink-0 transition-transform',
                  noteOpen && 'rotate-180'
                )}
                aria-hidden
              />
              Megjegyzés
              {liveVariance ? (
                <span className="text-hint text-warning-ink">
                  (eltérésnél ajánlott)
                </span>
              ) : (
                <span className="text-hint text-ink-muted">(opcionális)</span>
              )}
            </button>
            {noteOpen ? (
              <div className="mt-2 max-w-xl">
                <Input
                  id="recon-note"
                  disabled={!canWrite || pending}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Pl. terminál holnap reggel egyezik"
                />
              </div>
            ) : null}
          </div>

          <p className="text-hint text-ink-muted">
            OK, ha KP ±{RECON_THRESHOLDS.cashAbs.toLocaleString('hu-HU')} Ft,
            kártya ±{RECON_THRESHOLDS.cardAbs.toLocaleString('hu-HU')} Ft vagy{' '}
            {(RECON_THRESHOLDS.cardPct * 100).toLocaleString('hu-HU')}%, utalás ±
            {RECON_THRESHOLDS.transferAbs.toLocaleString('hu-HU')} Ft.{' '}
            <button
              type="button"
              className="underline-offset-2 hover:underline"
              onClick={() => setBreakdownOpen(true)}
            >
              Részletek
            </button>
          </p>
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface">
        <div className="border-b border-border px-3 py-2.5">
          <h2 className="text-body font-medium text-ink">
            Havi elszámolás
            <span className="ml-1.5 font-normal capitalize text-ink-secondary">
              · {yearMonthLabel(yearMonth)}
            </span>
          </h2>
          <p className="mt-0.5 text-hint text-ink-muted">
            ≥{RECON_BONUS.minFilledDays} kitöltött nap · ≥90% →{' '}
            {formatReconMoney(RECON_BONUS.staff90)} · ≥95% →{' '}
            {formatReconMoney(RECON_BONUS.staff95)} / fő
          </p>
        </div>

        <div className="grid gap-px border-b border-border bg-border sm:grid-cols-3">
          <div className="bg-surface px-3 py-3">
            <p className="text-hint text-ink-muted">Pontosság</p>
            <p className="mt-0.5 text-h3 font-semibold tabular-nums text-ink">
              {summary.accuracyPct == null
                ? '—'
                : `${summary.accuracyPct}%`}
            </p>
            <p className="mt-0.5 text-hint tabular-nums text-ink-secondary">
              {summary.okCount} rendben / {summary.filledCount} kitöltött
              {summary.filledCount < RECON_BONUS.minFilledDays
                ? ` · legalább ${RECON_BONUS.minFilledDays} nap kell`
                : ''}
            </p>
          </div>
          <div className="bg-surface px-3 py-3">
            <p className="text-hint text-ink-muted">Bónusz eddig</p>
            <p
              className={cn(
                'mt-0.5 text-h3 font-semibold tabular-nums',
                summary.bonusStaffFt > 0 ? 'text-success-ink' : 'text-ink'
              )}
            >
              {formatReconMoney(summary.bonusStaffFt)}
            </p>
            <p className="mt-0.5 text-hint text-ink-secondary">fejenként</p>
          </div>
          <div className="bg-surface px-3 py-3">
            <p className="text-hint text-ink-muted">
              Kitöltött napok · pontos napok sorban
            </p>
            <p className="mt-0.5 text-body font-semibold tabular-nums text-ink">
              {summary.filledCount}/{summary.workdayCount}
              <span className="ml-1.5 font-normal text-ink-secondary">
                · {summary.streak} nap
              </span>
            </p>
            <p className="mt-0.5 text-hint tabular-nums text-ink-secondary">
              {summary.okCount} rendben · {summary.varianceCount} eltérés
              {summary.missingPastCount > 0
                ? ` · ${summary.missingPastCount} nap kitöltetlen`
                : ''}
            </p>
          </div>
        </div>

        <div className="px-3 py-2.5">
          <p className="text-body text-ink-secondary">
            {settlementNextStep(summary)}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-300"
              style={{
                width: `${Math.min(100, summary.accuracyPct ?? 0)}%`
              }}
            />
          </div>
          <div className="mt-1 flex justify-between text-hint text-ink-muted">
            <span>0%</span>
            <span>90%</span>
            <span>95%</span>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-body font-medium text-ink">Munkanapok</h2>
        <div className="flex flex-wrap gap-1.5">
          {days.map((d) => {
            const dayNum = Number(d.date.slice(8, 10))
            const active = d.date === selectedDate
            const isToday = d.date === today
            const future = d.date > today
            return (
              <button
                key={d.date}
                type="button"
                disabled={future}
                onClick={() => selectDay(d.date)}
                className={cn(
                  'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-1.5 text-hint font-medium tabular-nums transition-colors',
                  future && 'cursor-not-allowed opacity-40',
                  active
                    ? 'border-ink bg-ink text-surface'
                    : d.status === 'ok'
                      ? 'border-success/40 bg-success-soft text-success-ink hover:border-success'
                      : d.status === 'variance'
                        ? 'border-danger/40 bg-danger-soft text-danger-ink hover:border-danger'
                        : d.status === 'partial'
                          ? 'border-warning/40 bg-warning-soft text-warning-ink hover:border-warning'
                          : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink',
                  isToday && !active && 'ring-1 ring-ink/30'
                )}
                aria-label={`${d.date}, ${chipLabel(d.status)}`}
                aria-pressed={active}
              >
                {dayNum}
              </button>
            )
          })}
        </div>
        <p className="text-hint text-ink-muted">
          Zöld = rendben · piros = eltérés · üres = nincs kitöltve · a mai nap
          keretezve
        </p>
      </section>
    </div>
  )
}
