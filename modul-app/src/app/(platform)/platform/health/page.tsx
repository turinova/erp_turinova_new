import type { Metadata } from 'next'
import Link from 'next/link'

import { StatusBadge } from '@/components/patterns/status-badge'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { runPlatformHealthChecks } from '@/lib/platform/queries'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Állapot'
}

export default async function PlatformHealthPage() {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) {
    return (
      <p className="text-body text-danger-ink" role="alert">
        {ctx.message}
      </p>
    )
  }

  const health = await runPlatformHealthChecks(ctx.admin)
  const checkedAt = new Date().toLocaleString('hu-HU')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-ink">Health</h1>
          <p className="mt-1 text-body text-ink-secondary">
            Függőségek állapota · utolsó ellenőrzés: {checkedAt}
          </p>
        </div>
        <Link
          href="/platform/health"
          className={cn(buttonVariants({ variant: 'secondary' }))}
        >
          Újraellenőrzés
        </Link>
      </div>

      <ul className="space-y-2">
        {health.map((h) => (
          <li
            key={h.id}
            className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3"
          >
            <div>
              <p className="text-body font-medium text-ink">{h.label}</p>
              <p className="text-hint text-ink-secondary">{h.detail}</p>
            </div>
            <StatusBadge tone={h.ok ? 'success' : 'danger'}>
              {h.ok ? 'OK' : 'Hiba'}
            </StatusBadge>
          </li>
        ))}
      </ul>
    </div>
  )
}
