'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

import { MenuSelect } from '@/components/ui/menu-select'
import type { TenantReportMetrics } from '@/lib/platform/tenant-report-queries'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

const TenantReportTrendChart = dynamic(
  () =>
    import('@/components/platform/tenant-report-trend-chart').then(
      (m) => m.TenantReportTrendChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-36 animate-pulse rounded-md border border-border bg-subtle" />
    )
  }
)

type Props = {
  report: TenantReportMetrics
}

function DeltaText({
  pct,
  compareLabel
}: {
  pct: number | null
  compareLabel: string
}) {
  if (pct == null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-hint text-ink-muted">
        <Minus className="size-3" aria-hidden />
        nincs összevetés
      </span>
    )
  }
  const up = pct > 0
  const flat = pct === 0
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-hint font-medium',
        flat && 'text-ink-muted',
        up && 'text-success-ink',
        !up && !flat && 'text-danger-ink'
      )}
    >
      <Icon className="size-3" aria-hidden />
      {flat ? 'ugyanannyi' : up ? `+${pct}%` : `−${Math.abs(pct)}%`} az{' '}
      {compareLabel} képest
    </span>
  )
}

function HeroCard({
  title,
  value,
  delta,
  compareLabel,
  footnote
}: {
  title: string
  value: string
  delta?: number | null
  compareLabel?: string
  footnote?: string
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface px-3 py-3">
      <p className="text-hint text-ink-muted">{title}</p>
      <p className="mt-1 truncate text-[20px] font-semibold tabular-nums text-ink">
        {value}
      </p>
      <div className="mt-1 space-y-0.5">
        {delta !== undefined && compareLabel ? (
          <DeltaText pct={delta} compareLabel={compareLabel} />
        ) : null}
        {footnote ? (
          <p className="text-hint text-ink-secondary">{footnote}</p>
        ) : null}
      </div>
    </div>
  )
}

function MethodBars({
  rows,
  mode
}: {
  rows: Array<{
    name: string
    sharePct: number
    count: number
    amount?: number
  }>
  mode: 'count' | 'money'
}) {
  if (rows.length === 0) {
    return (
      <p className="text-body text-ink-muted">Nincs adat ebben az időszakban.</p>
    )
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.name}>
          <div className="mb-0.5 flex items-baseline justify-between gap-2">
            <span className="truncate text-body text-ink">{row.name}</span>
            <span className="shrink-0 text-hint tabular-nums text-ink-secondary">
              {mode === 'money' && row.amount != null
                ? `${formatMoneyFt(row.amount)} Ft · ${row.count} db`
                : `${row.count} db · ${row.sharePct}%`}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
            <div
              className="h-full rounded-full bg-ink"
              style={{ width: `${Math.min(100, row.sharePct)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function liveLabel(status: 'live' | 'idle' | 'offline' | 'none'): string {
  switch (status) {
    case 'live':
      return 'élő'
    case 'idle':
      return 'csendes'
    case 'offline':
      return 'offline'
    default:
      return 'nincs eszköz'
  }
}

function PeriodControls({ report }: { report: TenantReportMetrics }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function replacePeriod(next: { view?: string; period?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    const view = next.view ?? report.view
    const period = next.period ?? report.periodKey
    params.set('view', view)
    params.set('period', period)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const periodOptions =
    report.view === 'year' ? report.yearOptions : report.monthOptions

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="inline-flex rounded-md border border-border bg-surface p-0.5"
        role="group"
        aria-label="Időszak nézet"
      >
        <button
          type="button"
          className={cn(
            'h-8 rounded-[5px] px-3 text-hint font-medium transition-colors',
            report.view === 'month'
              ? 'bg-ink text-white'
              : 'text-ink-secondary hover:text-ink'
          )}
          aria-pressed={report.view === 'month'}
          onClick={() => {
            if (report.view === 'month') return
            replacePeriod({
              view: 'month',
              period: report.monthOptions[0]?.value ?? report.periodKey
            })
          }}
        >
          Havi
        </button>
        <button
          type="button"
          className={cn(
            'h-8 rounded-[5px] px-3 text-hint font-medium transition-colors',
            report.view === 'year'
              ? 'bg-ink text-white'
              : 'text-ink-secondary hover:text-ink'
          )}
          aria-pressed={report.view === 'year'}
          onClick={() => {
            if (report.view === 'year') return
            replacePeriod({
              view: 'year',
              period: report.yearOptions[0]?.value ?? report.periodKey.slice(0, 4)
            })
          }}
        >
          Éves
        </button>
      </div>
      <div className="min-w-[11rem]">
        <MenuSelect
          id="tenant-report-period"
          value={report.periodKey}
          allowEmpty={false}
          clearable={false}
          options={periodOptions}
          onChange={(value) => {
            if (!value || value === report.periodKey) return
            replacePeriod({ period: value })
          }}
        />
      </div>
    </div>
  )
}

export function TenantReportPanel({ report }: Props) {
  const draftTotal = report.portalSubmits30d + report.portalDraftsAlive
  const submittedShare =
    draftTotal > 0 ? (report.portalSubmits30d / draftTotal) * 100 : 0
  const showPosSection =
    report.hasPdaPos || report.salesOrders30d > 0 || report.salesGmv30d > 0
  const showSmsSection = report.hasSmsAddon || report.smsSentThisMonth > 0
  const trendTitle =
    report.trendGranularity === 'month' ? 'Havi' : 'Heti'
  const periodFoot = report.periodLabel

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-h3 text-ink">Riport</h2>
          <p className="text-hint text-ink-secondary">
            Csak ehhez a céghez — nincs összehasonlítás más tenantokkal.
          </p>
        </div>
        <PeriodControls report={report} />
      </div>

      {/* ——— Általános cég ——— */}
      <section className="space-y-2">
        <div>
          <h2 className="text-h3 text-ink">Cég (közös)</h2>
          <p className="text-hint text-ink-secondary">
            Minden szakmánál ugyanaz — ki lépett be.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <HeroCard
            title="Belépett ember (7 nap)"
            value={
              report.maxSeats != null
                ? `${report.activeSeats7d} / ${report.maxSeats}`
                : String(report.activeSeats7d)
            }
            footnote={report.maxSeats != null ? 'helyből' : undefined}
          />
        </div>
      </section>

      {/* ——— Lapszabászat + partner ——— */}
      <section className="space-y-3">
        <div>
          <h2 className="text-h3 text-ink">Lapszabászat + partnerportál</h2>
          <p className="text-hint text-ink-secondary">
            Opti megrendelés, partner beküldés, fizetés — csak ha a funkció be
            van kapcsolva.
          </p>
        </div>

        {!report.hasLapszabaszat ? (
          <p className="rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink-secondary">
            Nincs lapszabászat entitlement — ezek a számok itt nem jelennek meg.
          </p>
        ) : (
          <>
            <section className="rounded-md border border-border bg-surface px-3 py-3">
              <p className="text-hint font-medium text-ink-muted">
                {periodFoot}
              </p>
              <p className="mt-1 text-body font-semibold text-ink">
                {report.verdictLine}
              </p>
              {report.partnerGmvSharePct != null && report.gmv30d > 0 ? (
                <p className="mt-1 text-hint text-ink-secondary">
                  Ebből partnerportál: {formatMoneyFt(report.gmvPortal30d)} Ft (
                  {report.partnerGmvSharePct}%).
                </p>
              ) : null}
            </section>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <HeroCard
                title="Megrendelések"
                value={String(report.orders30d)}
                delta={report.ordersDeltaPct}
                compareLabel={report.compareLabel}
                footnote={`előző: ${report.ordersPrev30d}`}
              />
              <HeroCard
                title="Forgalom"
                value={`${formatMoneyFt(report.gmv30d)} Ft`}
                delta={report.gmvDeltaPct}
                compareLabel={report.compareLabel}
                footnote={`előző: ${formatMoneyFt(report.gmvPrev30d)} Ft`}
              />
              <HeroCard
                title="Partner beküldések"
                value={String(report.portalSubmits30d)}
                footnote={
                  report.portalSubmitRatePct != null
                    ? `${report.portalDraftsAlive} félkész · arány ${report.portalSubmitRatePct}%`
                    : `${report.portalDraftsAlive} félkész most`
                }
              />
              <HeroCard
                title="Befizetések"
                value={`${formatMoneyFt(report.payments30d)} Ft`}
                footnote={`előző: ${formatMoneyFt(report.paymentsPrev30d)} Ft`}
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <section className="rounded-md border border-border bg-surface p-3">
                <h3 className="text-body font-semibold text-ink">
                  {trendTitle} forgalom
                </h3>
                <p className="text-hint text-ink-secondary">
                  Lapszabás forgalom · {periodFoot}
                </p>
                <div className="mt-2">
                  <TenantReportTrendChart
                    data={report.weekly}
                    mode="gmv"
                    emptyLabel={`Nincs adat (${periodFoot}).`}
                  />
                </div>
              </section>
              <section className="rounded-md border border-border bg-surface p-3">
                <h3 className="text-body font-semibold text-ink">
                  {trendTitle} megrendelés
                </h3>
                <p className="text-hint text-ink-secondary">
                  Hány lapszab rendelés indult · {periodFoot}
                </p>
                <div className="mt-2">
                  <TenantReportTrendChart
                    data={report.weekly}
                    mode="orders"
                    emptyLabel={`Nincs adat (${periodFoot}).`}
                  />
                </div>
              </section>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <section className="rounded-md border border-border bg-surface p-3">
                <h3 className="text-body font-semibold text-ink">
                  Partnerportál
                </h3>
                <p className="mt-0.5 text-hint text-ink-secondary">
                  Félkész = elmentette, de még nem küldte be.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-warning/35 bg-warning-soft px-3 py-2">
                    <p className="text-hint text-warning-ink">Félkész most</p>
                    <p className="mt-1 text-[18px] font-semibold tabular-nums text-warning-ink">
                      {report.portalDraftsAlive}
                    </p>
                  </div>
                  <div className="rounded-md border border-success/35 bg-success-soft px-3 py-2">
                    <p className="text-hint text-success-ink">
                      Beküldve ({periodFoot})
                    </p>
                    <p className="mt-1 text-[18px] font-semibold tabular-nums text-success-ink">
                      {report.portalSubmits30d}
                    </p>
                  </div>
                </div>
                {draftTotal > 0 ? (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-hint text-ink-secondary">
                      <span>Beküldési arány</span>
                      <span className="tabular-nums font-medium text-ink">
                        {report.portalSubmitRatePct ?? 0}%
                      </span>
                    </div>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-warning-soft">
                      <div
                        className="h-full bg-success"
                        style={{
                          width: `${Math.min(100, submittedShare)}%`
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-hint text-ink-muted">
                    Nincs partneres ajánlat / beküldés.
                  </p>
                )}
                <p className="mt-3 text-body text-ink-secondary">
                  Kapcsolt partner:{' '}
                  <span className="font-semibold tabular-nums text-ink">
                    {report.linkedPartners}
                  </span>
                </p>
                <p className="mt-1 text-body text-ink-secondary">
                  Utolsó lapszab rendelés óta:{' '}
                  <span className="font-medium text-ink">
                    {report.daysSinceLastOrder == null
                      ? 'még nem volt'
                      : `${report.daysSinceLastOrder} nap`}
                  </span>
                </p>
              </section>

              <section className="rounded-md border border-border bg-surface p-3">
                <h3 className="text-body font-semibold text-ink">
                  Honnan jött a forgalom?
                </h3>
                <p className="text-hint text-ink-secondary">
                  Ti írtátok / partner küldte · {periodFoot}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border bg-subtle px-3 py-2">
                    <p className="text-hint text-ink-muted">Cég (ti)</p>
                    <p className="mt-1 text-[15px] font-semibold tabular-nums text-ink">
                      {formatMoneyFt(report.gmvOpti30d)} Ft
                    </p>
                  </div>
                  <div className="rounded-md border border-info/30 bg-info-soft px-3 py-2">
                    <p className="text-hint text-info-ink">Partner</p>
                    <p className="mt-1 text-[15px] font-semibold tabular-nums text-info-ink">
                      {formatMoneyFt(report.gmvPortal30d)} Ft
                    </p>
                  </div>
                </div>
                {report.gmv30d > 0 ? (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-subtle">
                    <div
                      className="h-full bg-info"
                      style={{
                        width: `${Math.min(
                          100,
                          (report.gmvPortal30d / report.gmv30d) * 100
                        )}%`
                      }}
                    />
                  </div>
                ) : null}
              </section>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <section className="rounded-md border border-border bg-surface p-3">
                <h3 className="text-body font-semibold text-ink">
                  Mit választott a partner?
                </h3>
                <p className="mb-3 text-hint text-ink-secondary">
                  Beküldéskor megjelölt fizetési mód ({periodFoot}).
                </p>
                <MethodBars
                  rows={report.paymentPreferred.map((r) => ({
                    name: r.name,
                    sharePct: r.sharePct,
                    count: r.count
                  }))}
                  mode="count"
                />
              </section>
              <section className="rounded-md border border-border bg-surface p-3">
                <h3 className="text-body font-semibold text-ink">
                  Miből jött be a pénz?
                </h3>
                <p className="mb-3 text-hint text-ink-secondary">
                  Rögzített lapszab befizetések ({periodFoot}).
                </p>
                <MethodBars
                  rows={report.paymentCollected.map((r) => ({
                    name: r.name,
                    sharePct: r.sharePct,
                    count: r.count,
                    amount: r.amount
                  }))}
                  mode="money"
                />
              </section>
            </div>
          </>
        )}
      </section>

      {/* ——— Belépőszámláló ——— */}
      {report.hasFootcounter ? (
        <section className="space-y-2">
          <div>
            <h2 className="text-h3 text-ink">Belépőszámláló</h2>
            <p className="text-hint text-ink-secondary">
              Lábforgalom a boltban / üzlethelységben.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <HeroCard
              title="Ma be"
              value={String(report.footTodayIn)}
              footnote={`ki: ${report.footTodayOut}`}
            />
            <HeroCard
              title={report.view === 'year' ? 'Éves belépés' : 'Havi belépés'}
              value={String(report.footMonthIn)}
              footnote={periodFoot}
            />
            <HeroCard
              title="Eszközök"
              value={`${report.footDevicesLive} / ${report.footDeviceCount}`}
              footnote={`állapot: ${liveLabel(report.footLiveStatus)}`}
            />
          </div>
        </section>
      ) : null}

      {/* ——— Jelenlét ——— */}
      {report.hasJelenlet ? (
        <section className="space-y-2">
          <div>
            <h2 className="text-h3 text-ink">Jelenlét</h2>
            <p className="text-hint text-ink-secondary">
              Dolgozók és jelenléti napok.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <HeroCard
              title="Aktív dolgozó"
              value={String(report.jelenletEmployeeCount)}
            />
            <HeroCard
              title={
                report.view === 'year'
                  ? 'Jelenléti nap (év)'
                  : 'Jelenléti nap (hó)'
              }
              value={String(report.jelenletAttendanceDaysMonth)}
              footnote={`rögzített napok · ${periodFoot}`}
            />
            <HeroCard
              title="Terminál"
              value={`${report.jelenletDevicesLive} / ${report.jelenletDeviceCount}`}
              footnote="élő / összes (30 perc)"
            />
          </div>
        </section>
      ) : null}

      {/* ——— SMS ——— */}
      {showSmsSection ? (
        <section className="space-y-2">
          <div>
            <h2 className="text-h3 text-ink">SMS</h2>
            <p className="text-hint text-ink-secondary">
              Elküldött / kézbesített üzenetek · {periodFoot}.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <HeroCard
              title={`SMS · ${periodFoot}`}
              value={String(report.smsSentThisMonth)}
              footnote={
                report.hasSmsAddon
                  ? 'addon bekapcsolva'
                  : 'van forgalom, entitlement nélkül is látszik'
              }
            />
          </div>
        </section>
      ) : null}

      {/* ——— Bolt / POS ——— */}
      {showPosSection ? (
        <section className="space-y-2">
          <div>
            <h2 className="text-h3 text-ink">Bolt / POS</h2>
            <p className="text-hint text-ink-secondary">
              Bolti eladás — nem lapszabászat · {periodFoot}.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <HeroCard
              title="Eladás"
              value={String(report.salesOrders30d)}
              footnote={
                report.hasPdaPos ? 'POS addon bekapcsolva' : 'van eladási adat'
              }
            />
            <HeroCard
              title="Forgalom"
              value={`${formatMoneyFt(report.salesGmv30d)} Ft`}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
