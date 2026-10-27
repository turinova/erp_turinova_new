import { Phone } from 'lucide-react'

import { StatusBadge } from '@/components/patterns/status-badge'
import type { StatusBadgeTone } from '@/components/patterns/status-badge'
import { formatStatusFt } from '@/lib/order-status/format'
import type { CustomerOrderStatusView } from '@/lib/order-status/types'
import { cn } from '@/lib/utils'

function toneFor(status: CustomerOrderStatusView['statusTone']): StatusBadgeTone {
  if (status === 'success') return 'success'
  if (status === 'warning') return 'warning'
  if (status === 'info') return 'info'
  return 'neutral'
}

export function CustomerOrderStatusShell({
  view,
  variant = 'page'
}: {
  view: CustomerOrderStatusView
  /** `preview` = beállítások telefon-keret (nincs full viewport). */
  variant?: 'page' | 'preview'
}) {
  const phoneHref = view.company.phone
    ? `tel:${view.company.phone.replace(/\s/g, '')}`
    : null
  const isPreview = variant === 'preview'
  const isDone = view.statusTone === 'neutral'
  const showReady = view.readyItems.length > 0
  const showWaiting = view.waitingItems.length > 0 && view.kind === 'cso'
  const due = view.dueNowGross
  const showPay = !isDone && due != null && due > 0
  const showPaid = !isDone && due === 0

  return (
    <div
      className={cn('bg-app text-ink', isPreview ? 'min-h-0' : 'min-h-dvh')}
    >
      <div
        className={cn(
          'mx-auto flex w-full max-w-[420px] flex-col px-4',
          isPreview
            ? 'min-h-0 gap-3 pb-4 pt-3'
            : 'min-h-dvh gap-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]'
        )}
      >
        {/* 0. Brand — logo alone, or name if no logo */}
        <header className="flex justify-center pt-1">
          {view.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={view.company.logoUrl}
              alt={view.company.name}
              className="h-10 w-auto max-w-[200px] object-contain"
            />
          ) : (
            <p className="truncate text-center text-body font-semibold text-ink">
              {view.company.name}
            </p>
          )}
        </header>

        {/* 1. Kész van? */}
        <section className="rounded-lg border border-border bg-surface px-4 py-4">
          <StatusBadge tone={toneFor(view.statusTone)} variant="soft">
            {view.statusLabel}
          </StatusBadge>
          <p className="mt-2 text-hint tabular-nums text-ink-muted">
            {view.orderNumber}
          </p>
          {view.statusBody && view.statusTone === 'warning' ? (
            <p className="mt-2 text-body text-ink-secondary">{view.statusBody}</p>
          ) : null}
        </section>

        {isDone ? (
          <p className="text-body text-ink-secondary">
            A rendelés átadásra került. Köszönjük!
          </p>
        ) : null}

        {/* 2. Mi készült el? */}
        {showReady && !isDone ? (
          <ItemBlock title="Mi készült el" items={view.readyItems} />
        ) : null}

        {showWaiting && !isDone ? (
          <ItemBlock
            title={`Még úton (${view.waitingItems.length})`}
            items={view.waitingItems}
            muted
            hideAmounts
          />
        ) : null}

        {/* 3. Mennyit fizetek? */}
        {showPay ? (
          <section className="rounded-lg border border-border bg-surface px-4 py-4">
            <p className="text-hint font-medium text-ink-muted">
              Most fizetendő
            </p>
            <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-ink">
              {formatStatusFt(due!)}
            </p>
            {view.dueHint ? (
              <p className="mt-1 text-hint text-ink-secondary">{view.dueHint}</p>
            ) : null}
          </section>
        ) : null}

        {showPaid ? (
          <p className="text-body text-ink-secondary">Kifizetve.</p>
        ) : null}

        {/* 4. Hol? */}
        {!isDone || phoneHref ? (
          <section className="rounded-lg border border-border bg-surface px-4 py-4">
            <h2 className="text-label font-semibold text-ink">Átvétel</h2>
            {view.company.addressLine ? (
              <p className="mt-2 text-body leading-relaxed text-ink-secondary">
                {view.company.addressLine}
              </p>
            ) : (
              <p className="mt-2 text-body text-ink-secondary">
                Az átvétel helyét a bolttal egyeztetheted.
              </p>
            )}
            {phoneHref ? (
              <a
                href={phoneHref}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink text-body font-medium text-white"
              >
                <Phone className="size-4" aria-hidden />
                Hívás
              </a>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}

function ItemBlock({
  title,
  items,
  muted,
  hideAmounts,
  className
}: {
  title: string
  items: CustomerOrderStatusView['readyItems']
  muted?: boolean
  hideAmounts?: boolean
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-lg border border-border bg-surface px-4 py-4',
        className
      )}
    >
      <h2 className="text-label font-semibold text-ink">{title}</h2>
      <ul className="mt-1.5 divide-y divide-border">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 py-2.5 first:pt-1 last:pb-0"
          >
            <div className="min-w-0">
              <p
                className={cn(
                  'text-body font-medium',
                  muted ? 'text-ink-secondary' : 'text-ink'
                )}
              >
                {item.name}
              </p>
              <p className="text-hint text-ink-muted">{item.qtyLabel}</p>
            </div>
            {!hideAmounts && item.amountGross != null ? (
              <p className="shrink-0 tabular-nums text-body text-ink">
                {formatStatusFt(item.amountGross)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
