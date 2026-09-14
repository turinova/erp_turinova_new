'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  applyPlanToTenants,
  updatePlanFeatures
} from '@/lib/platform/entitlement-actions'
import type { ProductFeature, ProductPlan } from '@/lib/platform/entitlements'

type PlanRow = ProductPlan & {
  featureKeys: string[]
  tenantCount: number
}

export function PlansClient({
  plans,
  features
}: {
  plans: PlanRow[]
  features: ProductFeature[]
}) {
  const router = useRouter()
  const defaultPlan = plans.find((p) => p.is_default) ?? plans[0]
  const [selectedId, setSelectedId] = useState(defaultPlan?.id ?? '')
  const selected = plans.find((p) => p.id === selectedId) ?? defaultPlan
  const [keys, setKeys] = useState<Set<string>>(
    () => new Set(selected?.featureKeys ?? [])
  )
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!selected) return
    setKeys(new Set(selected.featureKeys))
  }, [selected])

  const byCategory = useMemo(() => {
    const cats = [...new Set(features.map((f) => f.category))]
    return cats.map((category) => ({
      category,
      items: features.filter((f) => f.category === category)
    }))
  }, [features])

  function selectPlan(plan: PlanRow) {
    setSelectedId(plan.id)
    setKeys(new Set(plan.featureKeys))
  }

  function toggle(key: string, always?: boolean) {
    if (always || key === '/home') return
    setKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleSave() {
    if (!selected) return
    startTransition(async () => {
      const result = await updatePlanFeatures({
        planId: selected.id,
        featureKeys: [...keys]
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Plan mentve.')
      router.refresh()
    })
  }

  function handleApply() {
    if (!selected) return
    startTransition(async () => {
      const result = await applyPlanToTenants(selected.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Alkalmazva.')
      router.refresh()
    })
  }

  if (!selected) {
    return (
      <p className="text-body text-ink-secondary">Nincs plan a rendszerben.</p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => selectPlan(plan)}
            className={[
              'rounded-md border px-3 py-1.5 text-body transition-colors',
              plan.id === selected.id
                ? 'border-ink bg-subtle text-ink'
                : 'border-border bg-surface text-ink-secondary hover:bg-subtle'
            ].join(' ')}
          >
            {plan.name}
            {plan.is_default ? ' · default' : ''}
            <span className="ml-2 text-hint tabular-nums text-ink-muted">
              {plan.tenantCount} cég
            </span>
          </button>
        ))}
      </div>

      <p className="text-body text-ink-secondary">
        {selected.description ??
          'A plan mentése csak a katalógust írja. A meglévő cégekre az Alkalmaz gomb írja át.'}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {byCategory.map((group) => (
          <div
            key={group.category}
            className="rounded-md border border-border bg-surface p-3"
          >
            <p className="mb-2 text-hint font-semibold text-ink-secondary">
              {group.category}
            </p>
            <ul className="space-y-1.5">
              {group.items.map((f) => {
                const locked = f.key === '/home'
                return (
                  <li key={f.key}>
                    <label className="flex cursor-pointer items-center gap-2 text-body text-ink">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border-border"
                        checked={keys.has(f.key)}
                        disabled={locked || pending}
                        onChange={() => toggle(f.key, locked)}
                      />
                      <span>{f.label}</span>
                      {locked ? (
                        <span className="text-hint text-ink-muted">
                          (kötelező)
                        </span>
                      ) : null}
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          loading={pending}
          disabled={selected.tenantCount === 0}
          onClick={handleApply}
        >
          Alkalmaz a plan cégeire ({selected.tenantCount})
        </Button>
        <Button
          type="button"
          variant="primary"
          loading={pending}
          onClick={handleSave}
        >
          Plan mentése
        </Button>
      </div>
    </div>
  )
}
