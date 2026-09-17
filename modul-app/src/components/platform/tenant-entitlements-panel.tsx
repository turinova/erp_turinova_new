'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { MenuSelect } from '@/components/ui/menu-select'
import {
  setTenantAddon,
  setTenantFeatureOverrides,
  setTenantPlan
} from '@/lib/platform/entitlement-actions'
import type { ProductAddon, ProductPlan } from '@/lib/platform/entitlements'
import type { TenantFeatureRow } from '@/lib/platform/entitlement-queries'
import {
  LAPSZABASZAT_ADDON_KEY,
  LAPSZABASZAT_DEPENDENT_ADDON_KEYS
} from '@/lib/lapszabaszat/types'

type AddonRow = ProductAddon & {
  featureKeys: string[]
  enabled: boolean
}

export function TenantEntitlementsPanel({
  tenantId,
  plans,
  currentPlanId,
  entitledCount,
  addons,
  features
}: {
  tenantId: string
  plans: ProductPlan[]
  currentPlanId: string | null
  entitledCount: number
  addons: AddonRow[]
  features: TenantFeatureRow[]
}) {
  const router = useRouter()
  const [planId, setPlanId] = useState(currentPlanId ?? '')
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(features.map((f) => [f.key, f.entitled]))
  )

  useEffect(() => {
    setPlanId(currentPlanId ?? '')
  }, [currentPlanId])

  useEffect(() => {
    setDraft(Object.fromEntries(features.map((f) => [f.key, f.entitled])))
  }, [features])

  const dirty = useMemo(() => {
    return features.some((f) => draft[f.key] !== f.entitled)
  }, [draft, features])

  const byCategory = useMemo(() => {
    const cats = [...new Set(features.map((f) => f.category))]
    return cats.map((category) => ({
      category,
      items: features.filter((f) => f.category === category)
    }))
  }, [features])

  const lapszabaszatOn = useMemo(
    () =>
      addons.some((a) => a.key === LAPSZABASZAT_ADDON_KEY && a.enabled),
    [addons]
  )

  function handlePlanSave() {
    if (!planId) return
    startTransition(async () => {
      const result = await setTenantPlan({ tenantId, planId })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Plan beállítva.')
      router.refresh()
    })
  }

  function handleAddonToggle(addonId: string, enabled: boolean) {
    startTransition(async () => {
      const result = await setTenantAddon({ tenantId, addonId, enabled })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Kész.')
      router.refresh()
    })
  }

  function handleFeaturesSave() {
    startTransition(async () => {
      const desired: Record<string, boolean> = {}
      for (const f of features) {
        if (f.key === '/home') continue
        desired[f.key] = Boolean(draft[f.key])
      }
      const result = await setTenantFeatureOverrides({ tenantId, desired })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Feature-ök mentve.')
      router.refresh()
    })
  }

  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-body font-semibold text-ink">Csomag és add-onok</h2>
          <p className="text-hint text-ink-secondary">
            Manuális kapcsolás · jelenleg {entitledCount} feature aktív
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <label
            htmlFor="tenant-plan"
            className="mb-1 block text-hint text-ink-secondary"
          >
            Plan
          </label>
          <MenuSelect
            id="tenant-plan"
            value={planId}
            disabled={pending}
            allowEmpty={false}
            placeholder="Válassz…"
            options={plans.map((p) => ({
              value: p.id,
              label: p.is_default ? `${p.name} (default)` : p.name
            }))}
            onChange={setPlanId}
          />
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={pending}
          disabled={!planId || planId === currentPlanId}
          onClick={handlePlanSave}
        >
          Plan mentése
        </Button>
      </div>

      <div className="mb-5">
        <p className="mb-2 text-hint font-semibold text-ink-secondary">
          Add-onok
        </p>
        {addons.length === 0 ? (
          <p className="text-body text-ink-secondary">
            Nincs aktív add-on a katalógusban. Hozz létre a Platform → Add-onok
            menüben.
          </p>
        ) : (
          <ul className="space-y-2">
            {addons.map((addon) => {
              const needsLapszabaszat = (
                LAPSZABASZAT_DEPENDENT_ADDON_KEYS as readonly string[]
              ).includes(addon.key)
              const blocked = needsLapszabaszat && !lapszabaszatOn && !addon.enabled

              return (
                <li
                  key={addon.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-body font-medium text-ink">{addon.name}</p>
                    <p className="text-hint text-ink-secondary">
                      {addon.featureKeys.length} feature
                      {addon.description ? ` · ${addon.description}` : ''}
                    </p>
                    {blocked ? (
                      <p className="mt-0.5 text-[11px] text-warning-ink">
                        Kell a Lapszabászat add-on.
                      </p>
                    ) : null}
                    {addon.key === LAPSZABASZAT_ADDON_KEY && addon.enabled ? (
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        Kikapcsoláskor a Partner és SMS add-on is leáll.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={addon.enabled ? 'success' : 'neutral'}>
                      {addon.enabled ? 'Bekapcsolva' : 'Ki'}
                    </StatusBadge>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={pending || blocked}
                      onClick={() =>
                        handleAddonToggle(addon.id, !addon.enabled)
                      }
                    >
                      {addon.enabled ? 'Kikapcsolás' : 'Bekapcsolás'}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-hint font-semibold text-ink-secondary">
              Feature-ök ennél a cégnél
            </p>
            <p className="text-hint text-ink-muted">
              Kikapcsolhatsz plan-beli dolgokat is. „Override” = eltér az
              alapoktól.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={pending}
            disabled={!dirty}
            onClick={handleFeaturesSave}
          >
            Feature-ök mentése
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {byCategory.map((group) => (
            <div
              key={group.category}
              className="rounded-md border border-border px-3 py-2"
            >
              <p className="mb-1.5 text-hint font-semibold text-ink-muted">
                {group.category}
              </p>
              <ul className="space-y-1.5">
                {group.items.map((f) => {
                  const locked = f.key === '/home'
                  const willOverride =
                    !locked && Boolean(draft[f.key]) !== f.inBase
                  return (
                    <li key={f.key}>
                      <label className="flex cursor-pointer items-center gap-2 text-body text-ink">
                        <input
                          type="checkbox"
                          className="size-3.5 rounded border-border"
                          checked={Boolean(draft[f.key])}
                          disabled={locked || pending}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [f.key]: e.target.checked
                            }))
                          }
                        />
                        <span className="min-w-0 flex-1">{f.label}</span>
                        {locked ? (
                          <span className="text-hint text-ink-muted">
                            (kötelező)
                          </span>
                        ) : null}
                        {willOverride || f.override !== null ? (
                          <StatusBadge tone="warning">Override</StatusBadge>
                        ) : null}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
