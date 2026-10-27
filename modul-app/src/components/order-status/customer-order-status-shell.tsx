import type { ReactNode } from 'react'
import { AlertTriangle, Check, Clock, Phone } from 'lucide-react'

import {
  formatStatusFt,
  googleMapsSearchUrl,
  wazeNavigateUrl
} from '@/lib/order-status/format'
import type {
  CustomerOrderStatusView,
  OrderStatusTone
} from '@/lib/order-status/types'
import { cn } from '@/lib/utils'

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
  const address = view.company.addressLine?.trim() || null
  const mapsHref = address ? googleMapsSearchUrl(address) : null
  const wazeHref = address ? wazeNavigateUrl(address) : null
  const isPreview = variant === 'preview'
  const isDone = view.statusTone === 'neutral'
  const showReady = view.readyItems.length > 0
  const showWaiting = view.waitingItems.length > 0 && view.kind === 'cso'
  const due = view.dueNowGross
  const showPay = !isDone && due != null && due > 0
  const showPaid = !isDone && due === 0
  const showPickup = !isDone || Boolean(phoneHref || mapsHref)

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

        {/* 1. Kész van? — tone-aware hero */}
        <StatusHero
          tone={view.statusTone}
          title={view.statusLabel}
          orderNumber={view.orderNumber}
          footnote={
            isDone
              ? 'A rendelés átadásra került. Köszönjük!'
              : view.statusBody || null
          }
        />

        {/* 2. Mi készült el? */}
        {showReady && !isDone ? (
          <ItemBlock
            title={view.kind === 'cso' ? 'Átvehető most' : 'Mi készült el'}
            items={view.readyItems}
            summaryLine={view.summaryLine}
            showPrices={view.kind === 'cso'}
          />
        ) : null}

        {showWaiting && !isDone ? (
          <ItemBlock
            title={`Még úton (${view.waitingItems.length})`}
            items={view.waitingItems}
            muted
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
        {showPickup ? (
          <section className="rounded-lg border border-border bg-surface px-4 py-4">
            <h2 className="text-label font-semibold text-ink">Átvétel</h2>
            {address ? (
              <p className="mt-2 text-body leading-relaxed text-ink-secondary">
                {address}
              </p>
            ) : (
              <p className="mt-2 text-body text-ink-secondary">
                Az átvétel helyét a bolttal egyeztetheted.
              </p>
            )}

            <div className="mt-3 flex items-center gap-2">
              {phoneHref ? (
                <a
                  href={isPreview ? undefined : phoneHref}
                  aria-disabled={isPreview || undefined}
                  className={cn(
                    'flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-ink text-body font-medium text-white',
                    isPreview && 'pointer-events-none opacity-80'
                  )}
                >
                  <Phone className="size-4" aria-hidden />
                  Hívás
                </a>
              ) : null}

              {mapsHref ? (
                <IconNavLink
                  href={mapsHref}
                  label="Google Maps"
                  disabled={isPreview}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/order-status/google-maps.png"
                    alt=""
                    width={28}
                    height={28}
                    className="size-7 object-contain"
                    aria-hidden
                  />
                </IconNavLink>
              ) : null}

              {wazeHref ? (
                <IconNavLink
                  href={wazeHref}
                  label="Waze"
                  disabled={isPreview}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/order-status/waze.png"
                    alt=""
                    width={28}
                    height={28}
                    className="size-7 rounded-[6px] object-contain"
                    aria-hidden
                  />
                </IconNavLink>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

const heroToneClass: Record<
  OrderStatusTone,
  { panel: string; iconWrap: string; icon: string; title: string }
> = {
  success: {
    panel: 'border-success/25 bg-success-soft',
    iconWrap: 'bg-success text-white',
    icon: 'text-white',
    title: 'text-success-ink'
  },
  warning: {
    panel: 'border-warning/30 bg-warning-soft',
    iconWrap: 'bg-warning text-white',
    icon: 'text-white',
    title: 'text-warning-ink'
  },
  info: {
    panel: 'border-info/25 bg-info-soft',
    iconWrap: 'bg-info text-white',
    icon: 'text-white',
    title: 'text-info-ink'
  },
  neutral: {
    panel: 'border-border bg-subtle',
    iconWrap: 'bg-ink-secondary text-white',
    icon: 'text-white',
    title: 'text-ink'
  }
}

function StatusHero({
  tone,
  title,
  orderNumber,
  footnote
}: {
  tone: OrderStatusTone
  title: string
  orderNumber: string
  footnote?: string | null
}) {
  const c = heroToneClass[tone]
  const Icon =
    tone === 'success' || tone === 'neutral'
      ? Check
      : tone === 'warning'
        ? AlertTriangle
        : Clock
  const celebrate = tone === 'success' || tone === 'warning'

  return (
    <section
      className={cn(
        'rounded-lg border px-4 py-6 text-center',
        c.panel,
        celebrate ? 'py-7' : 'py-5'
      )}
    >
      <div
        className={cn(
          'mx-auto flex items-center justify-center rounded-full',
          c.iconWrap,
          celebrate ? 'size-12' : 'size-10'
        )}
      >
        <Icon
          className={cn(celebrate ? 'size-6' : 'size-5', c.icon)}
          strokeWidth={tone === 'success' || tone === 'neutral' ? 2.75 : 2.25}
          aria-hidden
        />
      </div>
      <h1
        className={cn(
          'mt-3 font-semibold tracking-tight',
          c.title,
          celebrate ? 'text-[22px] leading-snug' : 'text-[18px] leading-snug'
        )}
      >
        {title}
      </h1>
      <p className="mt-1.5 text-body tabular-nums text-ink-secondary">
        {orderNumber}
      </p>
      {footnote ? (
        <p className="mt-2 text-body text-ink-secondary">{footnote}</p>
      ) : null}
    </section>
  )
}

function IconNavLink({
  href,
  label,
  disabled,
  children
}: {
  href: string
  label: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <a
      href={disabled ? undefined : href}
      target={disabled ? undefined : '_blank'}
      rel={disabled ? undefined : 'noopener noreferrer'}
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-ink',
        disabled
          ? 'pointer-events-none opacity-80'
          : 'hover:bg-subtle active:bg-subtle'
      )}
    >
      {children}
    </a>
  )
}

function ItemBlock({
  title,
  items,
  muted,
  showPrices,
  summaryLine,
  className
}: {
  title: string
  items: CustomerOrderStatusView['readyItems']
  muted?: boolean
  /** CSO kész: egységár + sorösszeg. */
  showPrices?: boolean
  summaryLine?: string | null
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
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-body font-medium break-words',
                  muted ? 'text-ink-secondary' : 'text-ink'
                )}
              >
                {item.name}
              </p>
              <p className="text-hint text-ink-muted">{item.qtyLabel}</p>
              {showPrices && item.unitPriceGross != null ? (
                <p className="text-hint text-ink-muted">
                  {formatStatusFt(item.unitPriceGross)} /{' '}
                  {item.unitShort || 'db'}
                </p>
              ) : null}
            </div>
            {showPrices && item.amountGross != null ? (
              <p className="shrink-0 tabular-nums text-body font-medium text-ink">
                {formatStatusFt(item.amountGross)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {summaryLine ? (
        <p className="mt-2 border-t border-border pt-2 text-body font-medium text-ink">
          {summaryLine}
        </p>
      ) : null}
    </section>
  )
}
