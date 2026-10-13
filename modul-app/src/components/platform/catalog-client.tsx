'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { AddonsClient } from '@/components/platform/addons-client'
import { PlansClient } from '@/components/platform/plans-client'
import { StatusBadge } from '@/components/patterns/status-badge'
import { formatHuf } from '@/lib/billing/estimate'
import type { ProductAddon, ProductFeature, ProductPlan } from '@/lib/platform/entitlements'
import {
  PLAN_KEY,
  planBundleHint
} from '@/lib/platform/plan-bundles'
import { cn } from '@/lib/utils'

type PlanRow = ProductPlan & {
  featureKeys: string[]
  tenantCount: number
}

type AddonRow = ProductAddon & {
  featureKeys: string[]
  enabledCount: number
}

const PLAN_ORDER = [
  PLAN_KEY.BOLT,
  PLAN_KEY.BOLT_PLUS,
  PLAN_KEY.MUHELY,
  PLAN_KEY.PRO
] as const

export function CatalogClient({
  plans,
  features,
  addons
}: {
  plans: PlanRow[]
  features: ProductFeature[]
  addons: AddonRow[]
}) {
  const searchParams = useSearchParams()
  const [advanced, setAdvanced] = useState(
    () => searchParams.get('advanced') === '1'
  )

  const ordered = useMemo(() => {
    const byKey = new Map(plans.map((p) => [p.key, p]))
    const primary = PLAN_ORDER.map((k) => byKey.get(k)).filter(
      Boolean
    ) as PlanRow[]
    const rest = plans.filter(
      (p) => !(PLAN_ORDER as readonly string[]).includes(p.key)
    )
    return [...primary, ...rest]
  }, [plans])

  const salesAddons = useMemo(
    () =>
      addons.filter(
        (a) =>
          a.active &&
          !['beszerzes', 'pos', 'product_labels'].includes(a.key)
      ),
    [addons]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-ink">Katalógus</h1>
        <p className="mt-1 text-body text-ink-secondary">
          Négy plan · nettó havidíj. Add-onok a plan bundelben (PDA à la carte
          Műhelyen). Feature mátrix csak Haladóban.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ordered.map((plan) => (
          <article
            key={plan.id}
            className={cn(
              'rounded-md border border-border bg-surface p-4',
              plan.is_default && 'ring-1 ring-ink/15'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-body font-semibold text-ink">{plan.name}</h2>
              {plan.is_default ? (
                <StatusBadge tone="info">Default</StatusBadge>
              ) : null}
            </div>
            <p className="mt-2 text-[1.35rem] font-semibold tabular-nums text-ink">
              {formatHuf(plan.price_monthly_huf)}
              <span className="ml-1 text-hint font-normal text-ink-secondary">
                /hó
              </span>
            </p>
            <p className="mt-2 text-hint text-ink-secondary">
              {planBundleHint(plan.key) || plan.description || '—'}
            </p>
            <p className="mt-3 text-hint text-ink-muted">
              {plan.tenantCount} cég · {plan.featureKeys.length} feature
            </p>
          </article>
        ))}
      </div>

      <div className="rounded-md border border-border bg-surface">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-body font-medium text-ink hover:bg-subtle"
          onClick={() => setAdvanced((v) => !v)}
          aria-expanded={advanced}
        >
          <span>Haladó: plan feature-ök, ár szerkesztés, add-onok</span>
          <span className="text-hint text-ink-secondary">
            {advanced ? 'Elrejt' : 'Megnyit'}
          </span>
        </button>
        {advanced ? (
          <div className="space-y-8 border-t border-border p-4">
            <section>
              <h3 className="mb-3 text-body font-semibold text-ink">
                Planek szerkesztése
              </h3>
              <PlansClient plans={plans} features={features} />
            </section>
            <section>
              <h3 className="mb-3 text-body font-semibold text-ink">
                Add-on katalógus
              </h3>
              <p className="mb-3 text-hint text-ink-secondary">
                Bundelt add-onok listaára általában 0 Ft. PDA = Műhely à la
                carte. Legacy inaktív sorok elrejtve a listából fent.
              </p>
              <AddonsClient addons={salesAddons} features={features} />
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
