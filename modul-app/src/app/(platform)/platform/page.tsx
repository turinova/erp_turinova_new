import type { Metadata } from 'next'
import Link from 'next/link'

import {
  MetricCell,
  MetricRow
} from '@/components/home/home-metric-row'
import { buttonVariants } from '@/components/ui/button'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import {
  deltaLabel,
  formatPlatformHuf,
  getPlatformBillingGlance,
  getPlatformOverviewStats
} from '@/lib/platform/partner-overview'
import { ph } from '@/lib/platform/platform-href-server'
import { runPlatformHealthChecks } from '@/lib/platform/queries'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Áttekintés'
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

  const [stats, billing, health, hrefs] = await Promise.all([
    getPlatformOverviewStats(ctx.admin),
    getPlatformBillingGlance(ctx.admin),
    runPlatformHealthChecks(ctx.admin),
    Promise.all([
      ph('/tenants'),
      ph('/tenants/uj'),
      ph('/partnerek'),
      ph('/partnerek?link=unlinked'),
      ph('/csomagok'),
      ph('/add-onok'),
      ph('/health')
    ])
  ])

  const [
    tenantsHref,
    ujTenantHref,
    partnerekHref,
    partnerekUnlinkedHref,
    csomagokHref,
    addonokHref,
    healthHref
  ] = hrefs

  const topWithHref = await Promise.all(
    stats.topTenantsGmv30d.map(async (t) => ({
      ...t,
      href: await ph(`/tenants/${t.tenantId}`)
    }))
  )

  const healthOk = health.every((h) => h.ok)
  const failedHealth = health.filter((h) => !h.ok)
  const seatsDelta = deltaLabel(stats.seatsActive7d, stats.seatsActive7dPrev)
  const quotesDelta = deltaLabel(
    stats.quotes7d.total.count,
    stats.quotes7dPrev.total.count
  )
  const portalDelta = deltaLabel(
    stats.portalSubmits7d.count,
    stats.portalSubmits7dPrev.count
  )
  const gmvDelta = deltaLabel(
    stats.quotes7d.total.gmv,
    stats.quotes7dPrev.total.gmv
  )
  const active7dDelta = deltaLabel(
    stats.tenantsActive7d,
    stats.tenantsActive7dPrev
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-ink">Áttekintés</h1>
          <p className="mt-1 text-body text-ink-secondary">
            Pillantás a cégekre, a pénzre és a használatra.
          </p>
        </div>
        <Link
          href={ujTenantHref}
          className={cn(buttonVariants({ variant: 'primary' }))}
        >
          Új cég
        </Link>
      </div>

      <MetricRow title="Pillantás" href={tenantsHref} hrefLabel="Cégek →" cols={4}>
        <MetricCell
          label="Élő cégek"
          value={String(stats.activeTenants)}
          href={tenantsHref}
        />
        <MetricCell
          label="Ma mozgott"
          value={String(stats.tenantsActive24h)}
          href={tenantsHref}
          hint={
            active7dDelta
              ? `24ó · 7 nap: ${stats.tenantsActive7d} (Δ ${active7dDelta})`
              : 'Belépés az elmúlt 24 órában'
          }
        />
        <MetricCell
          label="Emberek 7 nap"
          value={String(stats.seatsActive7d)}
          href={tenantsHref}
          hint={seatsDelta ? `Δ ${seatsDelta}` : 'Belépett userek'}
        />
        <MetricCell
          label="Rendszer"
          value={healthOk ? 'Rendben' : 'Figyelem'}
          href={healthHref}
          hint={
            healthOk
              ? 'Minden ellenőrzés OK'
              : failedHealth.map((h) => h.label).join(', ')
          }
          emphasize={healthOk ? 'success' : 'danger'}
        />
      </MetricRow>

      <MetricRow title="Pénz" href={tenantsHref} hrefLabel="Cégek →" cols={3}>
        <MetricCell
          label="Hátralék"
          value={String(billing.pastDue)}
          href={tenantsHref}
          hint="Fizetés lejárt / hátralék"
          emphasize={billing.pastDue > 0 ? 'danger' : null}
        />
        <MetricCell
          label="Trial hamarosan"
          value={String(billing.trialSoon)}
          href={tenantsHref}
          hint="7 napon belül lejár vagy lejárt"
          emphasize={billing.trialSoon > 0 ? 'warning' : null}
        />
        <MetricCell
          label="Fizető cégek"
          value={String(billing.billingActive)}
          href={tenantsHref}
          hint="Aktív előfizetés"
        />
      </MetricRow>

      <MetricRow
        title="Használat (7 nap)"
        href={tenantsHref}
        hrefLabel="Cégek →"
        cols={4}
      >
        <MetricCell
          label="Cég forgalom"
          value={formatPlatformHuf(stats.quotes7d.total.gmv)}
          href={tenantsHref}
          hint={
            gmvDelta
              ? `Ajánlat · Δ ${gmvDelta}`
              : 'Ajánlat forgalom (nem előfizetés)'
          }
        />
        <MetricCell
          label="Ajánlatok"
          value={String(stats.quotes7d.total.count)}
          href={tenantsHref}
          hint={
            quotesDelta
              ? `Δ ${quotesDelta}`
              : `Opti ${stats.quotes7d.opti.count} · Portal ${stats.quotes7d.portal.count}`
          }
        />
        <MetricCell
          label="Partner beküldés"
          value={String(stats.portalSubmits7d.count)}
          href={partnerekHref}
          hint={
            portalDelta
              ? `${formatPlatformHuf(stats.portalSubmits7d.gmv)} · Δ ${portalDelta}`
              : formatPlatformHuf(stats.portalSubmits7d.gmv)
          }
        />
        <MetricCell
          label="Nem lépett be"
          value={String(stats.tenantsNeverLoggedIn)}
          href={tenantsHref}
          hint="Élő cég, még nincs belépés"
          emphasize={stats.tenantsNeverLoggedIn > 0 ? 'warning' : null}
        />
      </MetricRow>

      {stats.partnersUnlinked > 0 ? (
        <MetricRow
          title="Partnerek"
          href={partnerekHref}
          hrefLabel="Partnerek →"
          cols={3}
        >
          <MetricCell
            label="Összes"
            value={String(stats.partnersTotal)}
            href={partnerekHref}
          />
          <MetricCell
            label="Céggel"
            value={String(stats.partnersLinked)}
            href={partnerekHref}
          />
          <MetricCell
            label="Cég nélkül"
            value={String(stats.partnersUnlinked)}
            href={partnerekUnlinkedHref}
            emphasize="warning"
          />
        </MetricRow>
      ) : null}

      {topWithHref.length > 0 ? (
        <section className="rounded-md border border-border bg-surface">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <h2 className="text-body font-semibold text-ink">
              Top cégek — 30 nap
            </h2>
            <Link
              href={tenantsHref}
              className="text-hint text-ink-secondary no-underline hover:underline"
            >
              Cégek →
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {topWithHref.map((t) => (
              <li key={t.tenantId}>
                <Link
                  href={t.href}
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
        </section>
      ) : null}

      <nav
        className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-secondary"
        aria-label="Gyors ugrás"
      >
        <span className="text-ink-muted">Ugrás:</span>
        <Link href={tenantsHref} className="text-ink no-underline hover:underline">
          Cégek
        </Link>
        <Link
          href={partnerekHref}
          className="text-ink no-underline hover:underline"
        >
          Partnerek
        </Link>
        <Link
          href={csomagokHref}
          className="text-ink no-underline hover:underline"
        >
          Csomagok
        </Link>
        <Link
          href={addonokHref}
          className="text-ink no-underline hover:underline"
        >
          Add-onok
        </Link>
        <Link href={healthHref} className="text-ink no-underline hover:underline">
          Health
        </Link>
      </nav>
    </div>
  )
}
