import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { StatusBadge } from '@/components/patterns/status-badge'
import {
  PlatformHealthCard,
  PlatformHealthCardFallback
} from '@/components/platform/platform-health-card'
import { buttonVariants } from '@/components/ui/button'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { tenantStatusTone } from '@/lib/platform/onboarding'
import {
  deltaLabel,
  formatPlatformHuf,
  getPlatformOverviewStats
} from '@/lib/platform/partner-overview'
import { listPlatformAttentionItems } from '@/lib/platform/queries'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Platform'
}

export default async function PlatformDashboardPage() {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) {
    return (
      <p className="text-body text-danger-ink" role="alert">
        {ctx.message}
      </p>
    )
  }

  const [stats, attention] = await Promise.all([
    getPlatformOverviewStats(ctx.admin),
    listPlatformAttentionItems(ctx.admin)
  ])

  const avgQuote7d =
    stats.quotes7d.total.count > 0
      ? stats.quotes7d.total.gmv / stats.quotes7d.total.count
      : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-ink">Áttekintés</h1>
          <p className="mt-1 text-body text-ink-secondary">
            Használat, forgalom (GMV) és partner csatorna — eladáshoz és
            operációhoz.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/platform/partnerek"
            className={cn(buttonVariants({ variant: 'secondary' }))}
          >
            Partnerek
          </Link>
          <Link
            href="/platform/tenants/uj"
            className={cn(buttonVariants({ variant: 'primary' }))}
          >
            Új cég
          </Link>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-body font-semibold text-ink">Aktivitás</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Élő cégek" value={stats.activeTenants} />
          <StatCard
            label="Aktív cég 24 óra"
            value={stats.tenantsActive24h}
          />
          <StatCard
            label="Aktív cég 7 nap"
            value={stats.tenantsActive7d}
            delta={deltaLabel(
              stats.tenantsActive7d,
              stats.tenantsActive7dPrev
            )}
          />
          <StatCard label="Aktív cég 30 nap" value={stats.tenantsActive30d} />
          <StatCard
            label="Aktív seat 7 nap"
            value={stats.seatsActive7d}
            delta={deltaLabel(stats.seatsActive7d, stats.seatsActive7dPrev)}
          />
          <StatCard
            label="Soha nem lépett be"
            value={stats.tenantsNeverLoggedIn}
          />
          <StatCard
            label="Ajánlat 7 nap"
            value={stats.quotes7d.total.count}
            hint={`Opti ${stats.quotes7d.opti.count} · Portal ${stats.quotes7d.portal.count}`}
            delta={deltaLabel(
              stats.quotes7d.total.count,
              stats.quotes7dPrev.total.count
            )}
          />
          <StatCard
            label="Megrendelés 7 nap"
            value={stats.orders7d.count}
            delta={deltaLabel(stats.orders7d.count, stats.orders7dPrev.count)}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-body font-semibold text-ink">
          Forgalom (GMV, HUF)
        </h2>
        <p className="text-hint text-ink-secondary">
          Tenant üzleti forgalom az Optin keresztül — nem Optinova előfizetés-MRR.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Ajánlat GMV 7 nap"
            valueLabel={formatPlatformHuf(stats.quotes7d.total.gmv)}
            hint={`24ó ${formatPlatformHuf(stats.quotes24h.total.gmv)} · 30nap ${formatPlatformHuf(stats.quotes30d.total.gmv)}`}
            delta={deltaLabel(
              stats.quotes7d.total.gmv,
              stats.quotes7dPrev.total.gmv
            )}
          />
          <StatCard
            label="Átlag ajánlat 7 nap"
            valueLabel={formatPlatformHuf(avgQuote7d)}
          />
          <StatCard
            label="Megrendelés GMV 7 nap"
            valueLabel={formatPlatformHuf(stats.orders7d.gmv)}
            delta={deltaLabel(stats.orders7d.gmv, stats.orders7dPrev.gmv)}
          />
          <StatCard
            label="Befizetés 7 nap"
            valueLabel={formatPlatformHuf(stats.payments7d)}
            delta={deltaLabel(stats.payments7d, stats.payments7dPrev)}
          />
        </div>
        {stats.topTenantsGmv30d.length > 0 ? (
          <div className="rounded-md border border-border bg-surface">
            <p className="border-b border-border px-3 py-2 text-label font-semibold text-ink">
              Top cégek — ajánlat GMV 30 nap
            </p>
            <ul className="divide-y divide-border">
              {stats.topTenantsGmv30d.map((t) => (
                <li key={t.tenantId}>
                  <Link
                    href={`/platform/tenants/${t.tenantId}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 no-underline hover:bg-subtle"
                  >
                    <span className="font-medium text-ink">{t.name}</span>
                    <span className="tabular-nums text-body text-ink">
                      {formatPlatformHuf(t.gmv)}
                      <span className="ml-2 text-hint text-ink-secondary">
                        {t.quoteCount} ajánlat
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-body font-semibold text-ink">Partner csatorna</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Partnerek" value={stats.partnersTotal} />
          <StatCard label="Kapcsolt céggel" value={stats.partnersLinked} />
          <StatCard label="Cég nélkül" value={stats.partnersUnlinked} />
          <StatCard
            label="Aktív partner 7 nap"
            value={stats.partnersActive7d}
            delta={deltaLabel(
              stats.partnersActive7d,
              stats.partnersActive7dPrev
            )}
          />
          <StatCard
            label="Portal beküldés 7 nap"
            value={stats.portalSubmits7d.count}
            hint={formatPlatformHuf(stats.portalSubmits7d.gmv)}
            delta={deltaLabel(
              stats.portalSubmits7d.count,
              stats.portalSubmits7dPrev.count
            )}
          />
          <StatCard
            label="Élő portal draft"
            value={stats.portalDraftsAlive}
          />
          <StatCard
            label="partner_orders ON"
            value={stats.tenantsWithPartnerOrders}
            hint="Active tenant entitlement"
          />
          <Suspense fallback={<PlatformHealthCardFallback />}>
            <PlatformHealthCard />
          </Suspense>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-body font-semibold text-ink">Teendők</h2>
        {attention.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-subtle px-3 py-4 text-body text-ink-secondary">
            Nincs kiemelt tétel.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {attention.map((t) => (
              <li key={`${t.kind ?? 'tenant'}-${t.id}-${t.reason}`}>
                <Link
                  href={t.href}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 no-underline hover:bg-subtle"
                >
                  <span className="font-medium text-ink">
                    {t.kind === 'partner' ? (
                      <span className="mr-1.5 text-hint font-normal text-ink-muted">
                        Partner ·
                      </span>
                    ) : null}
                    {t.name}
                  </span>
                  <StatusBadge tone={tenantStatusTone(t.status)}>
                    {t.reason}
                  </StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  valueLabel,
  hint,
  delta
}: {
  label: string
  value?: number
  valueLabel?: string
  hint?: string
  delta?: string | null
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-hint text-ink-secondary">{label}</p>
        {delta ? (
          <span className="text-hint tabular-nums text-ink-muted">{delta}</span>
        ) : null}
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
        {valueLabel ?? value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-hint text-ink-secondary">{hint}</p>
      ) : null}
    </div>
  )
}
