'use client'

import { Check, ChevronDown, CircleAlert, Minus, Zap } from 'lucide-react'

import { cn } from '@/lib/utils'

export type GroupStatus =
  | { kind: 'done' }
  | { kind: 'todo'; count: number }
  | { kind: 'optional' }
  | { kind: 'instant' }

function StatusText({ status }: { status: GroupStatus }) {
  if (status.kind === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-hint text-success-ink">
        <Check className="size-3.5" aria-hidden />
        Kész
      </span>
    )
  }
  if (status.kind === 'todo') {
    return (
      <span className="inline-flex items-center gap-1 text-hint text-warning-ink">
        <CircleAlert className="size-3.5" aria-hidden />
        {status.count === 1 ? '1 teendő' : `${status.count} teendő`}
      </span>
    )
  }
  if (status.kind === 'instant') {
    return (
      <span className="inline-flex items-center gap-1 text-hint text-ink-secondary">
        <Zap className="size-3.5" aria-hidden />
        Azonnal mentődik
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-hint text-ink-muted">
      <Minus className="size-3.5" aria-hidden />
      Nem kötelező
    </span>
  )
}

export function groupDomId(id: string): string {
  return `csoport-${id}`
}

export function EditorGroup({
  id,
  title,
  summary,
  status,
  open,
  onToggle,
  children
}: {
  id: string
  title: string
  /** Összecsukva is látszó egysoros állapot, pl. „Konyha › Zsanérok · 320 karakter”. */
  summary?: string
  status: GroupStatus
  open: boolean
  onToggle: (id: string) => void
  children: React.ReactNode
}) {
  const panelId = `${groupDomId(id)}-panel`
  return (
    <section id={groupDomId(id)} className="scroll-mt-16 rounded-md border border-border bg-surface">
      <h2>
        <button
          type="button"
          className="flex min-h-11 w-full items-center gap-2 px-3.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(id)}
        >
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-ink-muted transition-transform duration-fast motion-reduce:transition-none',
              open ? null : '-rotate-90'
            )}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="block text-h3 text-ink">{title}</span>
            {summary && !open ? (
              <span className="block truncate text-hint text-ink-secondary">{summary}</span>
            ) : null}
          </span>
          <span className="shrink-0">
            <StatusText status={status} />
          </span>
        </button>
      </h2>
      {open ? (
        <div id={panelId} className="border-t border-border px-3.5 py-3">
          {children}
        </div>
      ) : null}
    </section>
  )
}
