import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import {
  CheckCircle2,
  Mail,
  MessageSquare,
  Package,
  Phone,
  Printer,
  Store
} from 'lucide-react'

import { StatusBadge } from '@/components/patterns/status-badge'
import { buttonVariants } from '@/components/ui/button'
import type {
  SmsUsageSummary,
  SubscriptionAddonRow,
  SubscriptionBillingStatus
} from '@/lib/billing/subscription-overview'
import { formatHufAmount } from '@/lib/billing/estimate'
import { cn } from '@/lib/utils'

const BILLING_LABEL: Record<
  SubscriptionBillingStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }
> = {
  none: { label: 'Nincs beállítva', tone: 'neutral' },
  trial: { label: 'Próbaidő', tone: 'info' },
  active: { label: 'Aktív', tone: 'success' },
  past_due: { label: 'Fizetés rendezetlen', tone: 'warning' },
  canceled: { label: 'Lemondva', tone: 'danger' }
}

const SUPPORT_PHONE_DISPLAY = '+36 30 999 2800'
const SUPPORT_PHONE_E164 = '+36309992800'
const SUPPORT_EMAIL = 'info@turinova.hu'

function formatDate(iso: string | null) {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'long' }).format(
      new Date(iso)
    )
  } catch {
    return iso.slice(0, 10)
  }
}

function statusMessage(input: {
  status: SubscriptionBillingStatus
  paidLabel: string | null
  trialLabel: string | null
}): string {
  switch (input.status) {
    case 'active':
      return input.paidLabel
        ? `Az előfizetésed ${input.paidLabel}-ig érvényes.`
        : 'Az előfizetésed aktív.'
    case 'trial':
      return input.trialLabel
        ? `Próbaidő alatt vagy — a próba ${input.trialLabel}-ig tart.`
        : 'Próbaidő alatt vagy.'
    case 'past_due':
      return 'A fizetés nincs rendezve. Hívd vagy írd meg nekünk.'
    case 'canceled':
      return 'Az előfizetés le van állítva. Ha újra kell, vedd fel velünk a kapcsolatot.'
    default:
      return 'Még nincs beállított előfizetés. Hívd vagy írd meg nekünk.'
  }
}

function addonIcon(key: string): LucideIcon {
  switch (key) {
    case 'partner_orders':
      return Store
    case 'product_labels':
      return Printer
    case 'quote_ready_sms':
      return MessageSquare
    default:
      return Package
  }
}

function shortDescription(addon: SubscriptionAddonRow): string | null {
  if (addon.key === 'partner_orders') {
    return 'Online partner rendelések fogadása.'
  }
  if (addon.key === 'product_labels') {
    return 'Címkenyomtatás a műhelyben.'
  }
  if (addon.key === 'quote_ready_sms') {
    return 'SMS az ügyfélnek, ha a rendelés kész.'
  }
  if (addon.description) {
    const first = addon.description.split(/[.!]/)[0]?.trim()
    return first ? `${first}.` : addon.description
  }
  return null
}

function FeatureCard({
  title,
  description,
  active,
  validUntil,
  icon: Icon,
  meta,
  action
}: {
  title: string
  description?: string | null
  active: boolean
  validUntil?: string | null
  icon: LucideIcon
  meta?: ReactNode
  action?: ReactNode
}) {
  return (
    <article
      className={cn(
        'flex h-full flex-col gap-3 rounded-md px-3.5 py-3 transition-colors duration-fast',
        active
          ? 'border border-success/40 bg-success-soft'
          : 'border border-dashed border-border bg-surface'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md',
            active
              ? 'bg-success/15 text-success-ink'
              : 'bg-subtle text-ink-muted'
          )}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
        <StatusBadge tone={active ? 'success' : 'neutral'}>
          {active ? 'Aktív' : 'Nincs bekapcsolva'}
        </StatusBadge>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <h3
          className={cn(
            'text-body font-semibold',
            active ? 'text-success-ink' : 'text-ink'
          )}
        >
          {title}
        </h3>
        {description ? (
          <p
            className={cn(
              'text-hint',
              active ? 'text-success-ink/80' : 'text-ink-secondary'
            )}
          >
            {description}
          </p>
        ) : null}
        {active && validUntil ? (
          <p className="text-hint font-medium text-success-ink">
            Érvényes: {validUntil}-ig
          </p>
        ) : null}
        {meta}
      </div>

      {action ? <div className="mt-auto pt-1">{action}</div> : null}
    </article>
  )
}

function CardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  )
}

type Props = {
  billingStatus: SubscriptionBillingStatus
  trialEndsAt: string | null
  paidThrough: string | null
  planName: string | null
  addons: SubscriptionAddonRow[]
  smsUsage: SmsUsageSummary | null
}

function smsMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function SubscriptionOverview({
  billingStatus,
  trialEndsAt,
  paidThrough,
  planName,
  addons,
  smsUsage
}: Props) {
  const statusMeta = BILLING_LABEL[billingStatus]
  const paidLabel = formatDate(paidThrough)
  const trialLabel = formatDate(trialEndsAt)
  const validUntil =
    billingStatus === 'active'
      ? paidLabel
      : billingStatus === 'trial'
        ? trialLabel
        : null
  const message = statusMessage({
    status: billingStatus,
    paidLabel,
    trialLabel
  })

  const enabled = addons.filter((a) => a.enabled)
  const available = addons.filter((a) => !a.enabled)
  const subscriptionActive =
    billingStatus === 'active' || billingStatus === 'trial'
  const planActive = Boolean(planName) && subscriptionActive
  const hasActiveCards = planActive || enabled.length > 0

  return (
    <div className="space-y-6 pb-14">
      <div
        className={cn(
          'flex flex-col gap-2 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
          billingStatus === 'active' || billingStatus === 'trial'
            ? 'border-success/30 bg-success-soft/60'
            : billingStatus === 'past_due'
              ? 'border-warning/30 bg-warning-soft'
              : billingStatus === 'canceled'
                ? 'border-danger/30 bg-danger-soft'
                : 'border-border bg-surface'
        )}
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
            {validUntil ? (
              <p className="text-hint text-ink-secondary">
                {billingStatus === 'trial' ? 'Próba vége' : 'Érvényes'}:{' '}
                {validUntil}-ig
              </p>
            ) : null}
          </div>
          <p className="text-body text-ink">{message}</p>
        </div>
        {(billingStatus === 'active' || billingStatus === 'trial') && (
          <CheckCircle2
            className="hidden size-8 shrink-0 text-success sm:block"
            aria-hidden
          />
        )}
      </div>

      <section className="space-y-3" aria-labelledby="subscription-active-heading">
        <h2
          id="subscription-active-heading"
          className="text-label font-semibold text-ink"
        >
          Most mi van bekapcsolva
        </h2>

        {hasActiveCards ? (
          <CardGrid>
            {planName || subscriptionActive ? (
              <FeatureCard
                title={planName ? `Alap csomag — ${planName}` : 'Alap csomag'}
                description="A céged alaprendszere (ajánlat, rendelés, ügyfél…)."
                active={planActive}
                validUntil={planActive ? validUntil : null}
                icon={Package}
              />
            ) : null}

            {enabled.map((addon) => (
              <FeatureCard
                key={addon.key}
                title={addon.name}
                description={shortDescription(addon)}
                active
                validUntil={subscriptionActive ? validUntil : null}
                icon={addonIcon(addon.key)}
                meta={
                  addon.key === 'quote_ready_sms' && smsUsage ? (
                    <div className="mt-2 space-y-0.5 rounded-md border border-success/25 bg-surface/70 px-2.5 py-2">
                      <p className="text-hint text-success-ink/80">
                        {smsMonthLabel(smsUsage.year, smsUsage.month)}
                      </p>
                      <p className="text-body font-semibold tabular-nums text-success-ink">
                        {smsUsage.sentCount} db elküldött SMS
                      </p>
                      <p className="text-hint tabular-nums text-success-ink">
                        Becsült költség:{' '}
                        <span className="font-medium">
                          {formatHufAmount(smsUsage.estimatedCostHuf)}
                        </span>{' '}
                        nettó
                        <span className="text-success-ink/70">
                          {' '}
                          ({formatHufAmount(smsUsage.unitPriceHuf)}/db)
                        </span>
                      </p>
                    </div>
                  ) : null
                }
                action={
                  addon.key === 'quote_ready_sms' ? (
                    <Link
                      href="/beallitasok/elofizetes/sms"
                      className={cn(
                        buttonVariants({ variant: 'secondary', size: 'sm' }),
                        'w-full sm:w-auto'
                      )}
                    >
                      SMS napló
                    </Link>
                  ) : undefined
                }
              />
            ))}
          </CardGrid>
        ) : (
          <p className="text-body text-ink-secondary">
            Még nincs bekapcsolt csomag vagy kiegészítő.
          </p>
        )}
      </section>

      {available.length > 0 ? (
        <section
          className="space-y-3"
          aria-labelledby="subscription-available-heading"
        >
          <div>
            <h2
              id="subscription-available-heading"
              className="text-label font-semibold text-ink"
            >
              Ezeket még bekapcsolhatjuk
            </h2>
            <p className="mt-0.5 text-hint text-ink-secondary">
              Ha valamelyik kell, hívd vagy írd meg nekünk — mi állítjuk be.
            </p>
          </div>
          <CardGrid>
            {available.map((addon) => (
              <FeatureCard
                key={addon.key}
                title={addon.name}
                description={shortDescription(addon)}
                active={false}
                icon={addonIcon(addon.key)}
              />
            ))}
          </CardGrid>
        </section>
      ) : null}

      <section
        className="flex flex-col gap-3 rounded-md border border-border bg-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        aria-labelledby="subscription-contact-heading"
      >
        <div className="min-w-0">
          <h2
            id="subscription-contact-heading"
            className="text-body font-semibold text-ink"
          >
            Kiegészítő kell, vagy kérdésed van?
          </h2>
          <p className="mt-0.5 text-body text-ink-secondary">
            Csomag, kiegészítő, számla vagy hosszabbítás — hívd vagy írd meg
            nekünk.
          </p>
        </div>
        <ul className="flex flex-col gap-2 sm:items-end">
          <li>
            <a
              href={`tel:${SUPPORT_PHONE_E164}`}
              className="inline-flex items-center gap-2 text-body font-medium text-ink no-underline hover:underline"
            >
              <Phone
                className="size-3.5 shrink-0 text-ink-secondary"
                aria-hidden
              />
              {SUPPORT_PHONE_DISPLAY}
            </a>
          </li>
          <li>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Előfizetés / kiegészítő — Optinova')}`}
              className="inline-flex items-center gap-2 text-body font-medium text-ink no-underline hover:underline"
            >
              <Mail
                className="size-3.5 shrink-0 text-ink-secondary"
                aria-hidden
              />
              {SUPPORT_EMAIL}
            </a>
          </li>
        </ul>
      </section>
    </div>
  )
}
