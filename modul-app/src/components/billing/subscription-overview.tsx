import Link from 'next/link'
import { Mail, Phone } from 'lucide-react'

import { StatusBadge } from '@/components/patterns/status-badge'
import { buttonVariants } from '@/components/ui/button'
import {
  ACCESS_META,
  formatAccessDateHu,
  tenantAccessMessage,
  type DerivedAccessStatus
} from '@/lib/billing/access'
import { formatHufAmount } from '@/lib/billing/estimate'
import {
  tenantPlanBlurb,
  tenantPlanLabel,
  type SubscriptionExtra
} from '@/lib/billing/plan-subscription-copy'
import type { SmsUsageSummary } from '@/lib/billing/subscription-overview'
import { PLAN_KEY, type PlanKey } from '@/lib/platform/plan-bundles'
import { cn } from '@/lib/utils'

const SUPPORT_PHONE_DISPLAY = '+36 30 999 2800'
const SUPPORT_PHONE_E164 = '+36309992800'
const SUPPORT_EMAIL = 'info@turinova.hu'

const PLAN_ORDER = [
  PLAN_KEY.BOLT,
  PLAN_KEY.BOLT_PLUS,
  PLAN_KEY.MUHELY,
  PLAN_KEY.PRO
] as const

type Props = {
  derivedStatus: DerivedAccessStatus
  accessUntil: string | null
  planKey: PlanKey | null
  planName: string | null
  extras: SubscriptionExtra[]
  smsUsage: SmsUsageSummary | null
}

function smsMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

/** Certainty dátumsor — nem ismétli a teljes státuszmondatot. */
function accessDateLine(input: {
  status: DerivedAccessStatus
  accessUntil: string | null
}): string | null {
  const label = formatAccessDateHu(input.accessUntil)
  switch (input.status) {
    case 'trial':
      return label ? `Próba ${label}-ig` : null
    case 'ok':
      return label ? `${label}-ig érvényes` : null
    case 'grace':
    case 'expired':
      return label ? `Lejárt: ${label}` : null
    default:
      return null
  }
}

export function SubscriptionOverview({
  derivedStatus,
  accessUntil,
  planKey,
  planName,
  extras,
  smsUsage
}: Props) {
  const statusMeta = ACCESS_META[derivedStatus]
  const dateLine = accessDateLine({ status: derivedStatus, accessUntil })
  const needsAttention =
    derivedStatus === 'grace' ||
    derivedStatus === 'expired' ||
    derivedStatus === 'unset'
  return (
    <div className="space-y-6 pb-14">
      <p className="text-body text-ink-secondary">
        A céged jelenlegi csomagja.
      </p>

      {!planKey ? (
        <p className="text-body text-ink" role="status">
          {tenantAccessMessage({
            status: derivedStatus,
            accessUntil
          })}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PLAN_ORDER.map((key) => {
          const isCurrent = planKey === key
          const title =
            isCurrent && planName?.trim()
              ? planName.trim()
              : tenantPlanLabel(key)

          return (
            <article
              key={key}
              className={cn(
                'rounded-md border bg-surface p-4',
                isCurrent
                  ? 'border-ink/20 ring-1 ring-ink/15'
                  : 'border-border'
              )}
              aria-current={isCurrent ? 'true' : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[15px] font-semibold leading-snug text-ink">
                  {title}
                </h2>
                {isCurrent ? (
                  <StatusBadge tone={statusMeta.tone}>
                    {statusMeta.tenantLabel}
                  </StatusBadge>
                ) : null}
              </div>

              {isCurrent && dateLine ? (
                <p className="mt-2 text-body font-medium text-ink">{dateLine}</p>
              ) : null}

              {isCurrent &&
              !dateLine &&
              (derivedStatus === 'grace' ||
                derivedStatus === 'expired' ||
                derivedStatus === 'unset') ? (
                <p className="mt-2 text-body text-ink">
                  {tenantAccessMessage({
                    status: derivedStatus,
                    accessUntil
                  })}
                </p>
              ) : null}

              <p className="mt-2 text-hint text-ink-secondary">
                {tenantPlanBlurb(key)}
              </p>
            </article>
          )
        })}
      </div>

      {planKey && extras.length > 0 ? (
        <p className="text-hint text-ink-secondary">
          Külön bekapcsolva:{' '}
          <span className="text-ink">
            {extras.map((e) => e.name).join(' · ')}
          </span>
        </p>
      ) : null}

      {smsUsage ? (
        <section
          className="flex flex-col gap-2 rounded-md border border-border bg-surface px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          aria-labelledby="subscription-sms-heading"
        >
          <div>
            <h2
              id="subscription-sms-heading"
              className="text-label font-semibold text-ink"
            >
              SMS ebben a hónapban
            </h2>
            <p className="mt-0.5 text-body text-ink">
              {smsMonthLabel(smsUsage.year, smsUsage.month)}
              {' · '}
              <span className="tabular-nums font-medium">
                {smsUsage.sentCount} db
              </span>
              {' · kb. '}
              <span className="tabular-nums">
                {formatHufAmount(smsUsage.estimatedCostHuf)}
              </span>{' '}
              nettó
              <span className="text-hint text-ink-secondary">
                {' '}
                ({formatHufAmount(smsUsage.unitPriceHuf)}/db)
              </span>
            </p>
          </div>
          <Link
            href="/beallitasok/elofizetes/sms"
            className={cn(
              buttonVariants({ variant: 'secondary', size: 'sm' }),
              'w-full sm:w-auto'
            )}
          >
            SMS napló
          </Link>
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
            {needsAttention
              ? 'Rendezzük az előfizetést'
              : 'Segítség kell?'}
          </h2>
          <p className="mt-0.5 text-body text-ink-secondary">
            Csomagváltás vagy hosszabbítás — hívd vagy írd meg, mi intézzük.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <a
            href={`tel:${SUPPORT_PHONE_E164}`}
            className={cn(
              buttonVariants({
                variant: needsAttention ? 'primary' : 'secondary',
                size: 'sm'
              }),
              'inline-flex w-full items-center justify-center gap-2 sm:w-auto'
            )}
          >
            <Phone className="size-3.5 shrink-0" aria-hidden />
            {SUPPORT_PHONE_DISPLAY}
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Előfizetés — Turinova')}`}
            className={cn(
              buttonVariants({ variant: 'secondary', size: 'sm' }),
              'inline-flex w-full items-center justify-center gap-2 sm:w-auto'
            )}
          >
            <Mail className="size-3.5 shrink-0" aria-hidden />
            {SUPPORT_EMAIL}
          </a>
        </div>
      </section>
    </div>
  )
}
