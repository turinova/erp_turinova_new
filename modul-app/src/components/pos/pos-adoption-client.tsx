'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { Target, Trophy } from 'lucide-react'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  awardPosWeeklyWinnerAction,
  saveDailyPosSalesTargetAction
} from '@/lib/pos/adoption-actions'
import type {
  PosAdoptionAward,
  PosAdoptionRange,
  PosAdoptionStats
} from '@/lib/pos/adoption'
import type { PosSearchMissRow } from '@/lib/pos/discovery'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

type Props = {
  initialRange: PosAdoptionRange
  initialStats: PosAdoptionStats
  awards: PosAdoptionAward[]
  weekStart: string
  dailyTarget: number
  canWrite: boolean
  searchMisses?: PosSearchMissRow[]
}

function ProgressBar({
  value,
  max,
  label
}: {
  value: number
  max: number
  label: string
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const done = value >= max && max > 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-hint text-ink-secondary">{label}</p>
        <p className="text-hint tabular-nums text-ink">
          {value} / {max} · {pct}%
        </p>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-subtle"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            done ? 'bg-success-ink' : 'bg-ink'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const RANGE_CHIPS: { value: PosAdoptionRange; label: string }[] = [
  { value: 'today', label: 'Ma' },
  { value: 'week', label: 'Hét' },
  { value: 'month', label: 'Hónap' }
]

export function PosAdoptionClient({
  initialRange,
  initialStats,
  awards,
  weekStart,
  dailyTarget: initialDailyTarget,
  canWrite,
  searchMisses = []
}: Props) {
  const [range, setRange] = useState(initialRange)
  const [stats, setStats] = useState(initialStats)
  const [dailyTarget, setDailyTarget] = useState(initialDailyTarget)
  const [goalDraft, setGoalDraft] = useState(String(initialDailyTarget))
  const [awardOpen, setAwardOpen] = useState(false)
  const [awardLabel, setAwardLabel] = useState('')
  const [awardUserId, setAwardUserId] = useState<string | null>(null)
  const [awardMetric, setAwardMetric] = useState(0)
  const [rewardNote, setRewardNote] = useState('Kávé / ajándékutalvány')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const todayGoal = stats.daily_sales_target
  const isToday = range === 'today'
  const progressValue = isToday ? stats.sales_count : stats.sales_count
  const progressMax = isToday ? todayGoal : Math.max(todayGoal * 5, stats.sales_count)

  const scanTotal =
    stats.barcode_scans + stats.typeahead_picks + stats.other_picks
  const barcodePct =
    scanTotal > 0
      ? Math.round((stats.barcode_scans / scanTotal) * 100)
      : 0

  const thisWeekAward = useMemo(
    () => awards.find((a) => a.week_start === weekStart) ?? null,
    [awards, weekStart]
  )

  function pushRange(next: PosAdoptionRange) {
    const params = new URLSearchParams()
    if (next !== 'today') params.set('range', next)
    window.location.href = params.toString()
      ? `/ertekesitesek/pos-hasznalat?${params}`
      : '/ertekesitesek/pos-hasznalat'
  }

  function openAwardFor(row: {
    user_label: string
    user_id: string | null
    sales_count: number
  }) {
    setAwardLabel(row.user_label)
    setAwardUserId(row.user_id)
    setAwardMetric(row.sales_count)
    setRewardNote('Kávé / ajándékutalvány')
    setAwardOpen(true)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="POS használat"
        description="Napi cél: POS eladások. Motiváció jutalommal — nem büntetéssel."
        actions={
          <Link
            href="/pos"
            className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-hint font-medium text-ink no-underline hover:bg-subtle"
          >
            Pult megnyitása
          </Link>
        }
      />

      <div
        className="rounded-md border border-border bg-subtle/50 px-3 py-2 text-hint text-ink-secondary"
        role="note"
      >
        Playbook: 1–2 POS mester, 2 hét hibázási amnesztia, eladás csak POS-on.
        Közös fióknál a rangsor a{' '}
        <span className="text-ink">created_by</span> címkét mutatja — érdemes
        váltani.
      </div>

      {message ? (
        <p
          className="rounded-md border border-border bg-surface px-3 py-2 text-body text-ink"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {RANGE_CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            className={cn(
              'h-7 rounded-md px-2.5 text-hint font-medium transition-colors',
              range === c.value
                ? 'bg-ink text-surface'
                : 'bg-subtle text-ink-secondary hover:bg-border/60 hover:text-ink'
            )}
            onClick={() => {
              setRange(c.value)
              pushRange(c.value)
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <section className="rounded-md border border-border bg-surface p-4">
        <div className="flex items-start gap-2">
          <Target className="mt-0.5 size-4 text-ink-muted" aria-hidden />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-hint text-ink-secondary">
                {isToday ? 'Mai POS eladások' : 'POS eladások a kijelölt időszakban'}
              </p>
              <p className="mt-1 text-[1.75rem] font-semibold tabular-nums leading-none tracking-tight text-ink">
                {stats.sales_count}
              </p>
              <p className="mt-1 text-hint text-ink-muted">
                {formatMoneyFt(stats.sales_sum)} Ft · műszak:{' '}
                {stats.shifts_open} nyitott / {stats.shifts_closed} zárt
              </p>
            </div>
            {isToday ? (
              <ProgressBar
                value={progressValue}
                max={todayGoal}
                label={`Napi cél: ${todayGoal} eladás`}
              />
            ) : (
              <ProgressBar
                value={progressValue}
                max={progressMax}
                label="Időszak forgalma (arány a napi cél × 5-höz)"
              />
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-surface px-3 py-3">
          <p className="text-hint text-ink-secondary">Vonalkód arány</p>
          <p className="mt-1 text-h3 tabular-nums text-ink">{barcodePct}%</p>
          <p className="mt-0.5 text-hint text-ink-muted">
            {stats.barcode_scans} scan / {scanTotal} pick
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface px-3 py-3">
          <p className="text-hint text-ink-secondary">Kereső pick</p>
          <p className="mt-1 text-h3 tabular-nums text-ink">
            {stats.typeahead_picks}
          </p>
          <p className="mt-0.5 text-hint text-ink-muted">typeahead</p>
        </div>
        <div className="rounded-md border border-border bg-surface px-3 py-3">
          <p className="text-hint text-ink-secondary">Gyors / recent</p>
          <p className="mt-1 text-h3 tabular-nums text-ink">{stats.other_picks}</p>
          <p className="mt-0.5 text-hint text-ink-muted">egyéb forrás</p>
        </div>
      </div>

      <section className="rounded-md border border-border bg-surface p-3">
        <h2 className="text-label text-ink">Kereső miss-ek (14 nap)</h2>
        <p className="mt-1 text-hint text-ink-secondary">
          Amit begépeltek, de nem volt találat — alias / név javítás ide.
        </p>
        {searchMisses.length === 0 ? (
          <p className="mt-3 text-hint text-ink-muted">
            Még nincs zero-hit adat (vagy futtasd a 20260596 migrációt).
          </p>
        ) : (
          <DataTable className="mt-3">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Keresés</DataTableHeaderCell>
                <DataTableHeaderCell className="text-right">
                  db
                </DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {searchMisses.map((row) => (
                <DataTableRow key={row.q}>
                  <DataTableCell className="font-medium text-ink">
                    {row.q}
                  </DataTableCell>
                  <DataTableCell className="text-right tabular-nums text-ink">
                    {row.miss_count}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </section>

      {canWrite ? (
        <section className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-3">
          <div className="space-y-1">
            <label htmlFor="pos-daily-goal" className="text-label text-ink">
              Napi POS eladás cél
            </label>
            <Input
              id="pos-daily-goal"
              type="number"
              min={1}
              max={5000}
              className="w-28"
              value={goalDraft}
              disabled={pending}
              onChange={(e) => setGoalDraft(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => {
              const n = Number(goalDraft)
              if (!Number.isFinite(n)) return
              setMessage(null)
              startTransition(() => {
                void saveDailyPosSalesTargetAction(n).then((res) => {
                  if (!res.ok) {
                    setMessage(res.message)
                    return
                  }
                  setDailyTarget(Math.floor(n))
                  setStats((s) => ({
                    ...s,
                    daily_sales_target: Math.floor(n)
                  }))
                  setMessage('Napi cél mentve.')
                })
              })
            }}
          >
            Cél mentése
          </Button>
          <p className="text-hint text-ink-muted">
            Jelenlegi: {dailyTarget} / nap
          </p>
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-h3 text-ink">Eladók (POS)</h2>
          <span className="text-hint text-ink-muted">max. 25</span>
        </div>
        {stats.by_user.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-body text-ink-secondary">
            Még nincs POS eladás ebben az időszakban. Nyiss műszakot a pulton.
          </p>
        ) : (
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>Eladó</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Eladás</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Összeg</DataTableHeaderCell>
                {canWrite ? (
                  <DataTableHeaderCell className="w-28">
                    {' '}
                  </DataTableHeaderCell>
                ) : null}
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {stats.by_user.map((row) => (
                <DataTableRow key={`${row.user_id ?? 'x'}-${row.user_label}`}>
                  <DataTableCell className="font-medium text-ink">
                    {row.user_label}
                  </DataTableCell>
                  <DataTableCell align="right">{row.sales_count}</DataTableCell>
                  <DataTableCell align="right">
                    {formatMoneyFt(row.sales_sum)} Ft
                  </DataTableCell>
                  {canWrite ? (
                    <DataTableCell className="text-right">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7"
                        onClick={() => openAwardFor(row)}
                      >
                        Győztes
                      </Button>
                    </DataTableCell>
                  ) : null}
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-ink-muted" aria-hidden />
          <h2 className="text-h3 text-ink">Heti elismerés</h2>
        </div>
        {thisWeekAward ? (
          <p className="rounded-md border border-border bg-surface px-3 py-2 text-body text-ink">
            Ezen a héten: <strong>{thisWeekAward.user_label}</strong>
            {thisWeekAward.reward_note
              ? ` — ${thisWeekAward.reward_note}`
              : ''}{' '}
            <span className="text-hint text-ink-muted">
              ({thisWeekAward.metric_value} eladás)
            </span>
          </p>
        ) : (
          <p className="text-hint text-ink-secondary">
            Még nincs kijelölt heti győztes. Válassz valakit a táblából.
          </p>
        )}
        {awards.length > 0 ? (
          <ul className="space-y-1 text-hint text-ink-secondary">
            {awards.slice(0, 5).map((a) => (
              <li key={a.id}>
                {a.week_start}: {a.user_label}
                {a.reward_note ? ` — ${a.reward_note}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Heti győztes kijelölése</DialogTitle>
            <DialogDescription>
              Ajándék / elismerés — nem bérpótlék. Heti 1 győztes (hétfőtől).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-body text-ink">
              {awardLabel}{' '}
              <span className="text-hint text-ink-muted">
                ({awardMetric} eladás)
              </span>
            </p>
            <div className="space-y-1">
              <label htmlFor="pos-award-note" className="text-label text-ink">
                Jutalom megjegyzés
              </label>
              <Input
                id="pos-award-note"
                value={rewardNote}
                onChange={(e) => setRewardNote(e.target.value)}
                placeholder="Kávé / utalvány / műszakpreferencia"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAwardOpen(false)}
              autoFocus
            >
              Mégse
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                setMessage(null)
                startTransition(() => {
                  void awardPosWeeklyWinnerAction({
                    userLabel: awardLabel,
                    userId: awardUserId,
                    metricValue: awardMetric,
                    rewardNote
                  }).then((res) => {
                    if (!res.ok) {
                      setMessage(res.message)
                      return
                    }
                    setAwardOpen(false)
                    setMessage(`Heti győztes: ${awardLabel}`)
                    window.location.reload()
                  })
                })
              }}
            >
              Győztes mentése
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
