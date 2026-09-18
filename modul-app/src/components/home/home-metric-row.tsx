import type { ReactNode } from 'react'
import Link from 'next/link'

import { cn } from '@/lib/utils'

/**
 * Notion / Linear glance: egy sor, egyenlő cellák, hairline.
 * Szem balról jobbra; szín csak kivételre.
 */
export function MetricRow({
  title,
  href,
  hrefLabel,
  cols = 5,
  children
}: {
  title: string
  href: string
  hrefLabel: string
  /** Desktop oszlopszám (2–5). */
  cols?: 2 | 3 | 4 | 5
  children: ReactNode
}) {
  const colsClass =
    cols === 2
      ? 'sm:grid-cols-2 lg:grid-cols-2'
      : cols === 3
        ? 'sm:grid-cols-3 lg:grid-cols-3'
        : cols === 4
          ? 'sm:grid-cols-2 lg:grid-cols-4'
          : 'sm:grid-cols-3 lg:grid-cols-5'

  return (
    <section className="rounded-md border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-body font-semibold text-ink">{title}</h2>
        <Link
          href={href}
          className="text-hint text-ink-secondary no-underline hover:underline"
        >
          {hrefLabel}
        </Link>
      </div>
      <div
        className={cn(
          'grid grid-cols-2 divide-x divide-y divide-border lg:divide-y-0',
          colsClass
        )}
      >
        {children}
      </div>
    </section>
  )
}

export function MetricCell({
  label,
  value,
  href,
  hint,
  emphasize
}: {
  label: string
  value: string
  href: string
  hint?: string
  emphasize?: 'danger' | 'warning' | 'success' | null
}) {
  return (
    <Link
      href={href}
      className="block min-w-0 px-3 py-3 no-underline transition-colors hover:bg-subtle"
    >
      <p className="truncate text-hint text-ink-secondary">{label}</p>
      <p
        className={cn(
          'mt-1 text-[1.5rem] font-semibold tabular-nums leading-none tracking-tight',
          emphasize === 'danger' && 'text-danger-ink',
          emphasize === 'warning' && 'text-warning-ink',
          emphasize === 'success' && 'text-success-ink',
          !emphasize && 'text-ink'
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 truncate text-hint text-ink-muted">{hint}</p>
      ) : (
        <p className="mt-1 text-hint text-transparent select-none" aria-hidden>
          .
        </p>
      )}
    </Link>
  )
}
