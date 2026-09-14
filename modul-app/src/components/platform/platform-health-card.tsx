import Link from 'next/link'

import { StatusBadge } from '@/components/patterns/status-badge'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { runPlatformHealthChecks } from '@/lib/platform/queries'
import { ph } from '@/lib/platform/platform-href-server'

/** Lazy health — nem blokkolja az áttekintő KPI-kat. */
export async function PlatformHealthCard() {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) {
    return (
      <div className="rounded-md border border-border bg-surface px-3 py-3">
        <p className="text-hint text-ink-secondary">Health</p>
        <p className="mt-1 text-hint text-ink-muted">—</p>
      </div>
    )
  }

  const health = await runPlatformHealthChecks(ctx.admin)
  const healthOk = health.every((h) => h.ok)
  const failedHealth = health.filter((h) => !h.ok)
  const healthHref = await ph('/health')

  return (
    <div className="rounded-md border border-border bg-surface px-3 py-3">
      <p className="text-hint text-ink-secondary">Health</p>
      <div className="mt-1 flex items-center gap-2">
        <StatusBadge tone={healthOk ? 'success' : 'danger'}>
          {healthOk ? 'Rendben' : 'Figyelem'}
        </StatusBadge>
        {!healthOk ? (
          <span className="text-hint text-ink-secondary">
            {failedHealth.map((h) => h.label).join(', ')}
          </span>
        ) : null}
      </div>
      <Link
        href={healthHref}
        className="mt-2 inline-block text-hint text-ink underline-offset-2 hover:underline"
      >
        Részletek →
      </Link>
    </div>
  )
}

export function PlatformHealthCardFallback() {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-3">
      <p className="text-hint text-ink-secondary">Health</p>
      <div className="mt-2 h-5 w-20 animate-pulse rounded bg-subtle" />
    </div>
  )
}
