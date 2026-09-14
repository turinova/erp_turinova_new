'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  createProductAddon,
  updateProductAddon
} from '@/lib/platform/entitlement-actions'
import type { ProductAddon, ProductFeature } from '@/lib/platform/entitlements'

type AddonRow = ProductAddon & {
  featureKeys: string[]
  enabledCount: number
}

export function AddonsClient({
  addons,
  features
}: {
  addons: AddonRow[]
  features: ProductFeature[]
}) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [edit, setEdit] = useState<AddonRow | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={() => setCreateOpen(true)}
        >
          Új add-on
        </Button>
      </div>

      {addons.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-3 py-4 text-body text-ink-secondary">
          Még nincs add-on. Hozz létre egyet, majd a cég detailen kapcsold be
          manuálisan.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {addons.map((addon) => (
            <li
              key={addon.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
            >
              <div>
                <p className="font-medium text-ink">{addon.name}</p>
                <p className="text-hint text-ink-secondary">
                  {addon.key} · {addon.featureKeys.length} feature ·{' '}
                  {addon.enabledCount} cég
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={addon.active ? 'success' : 'neutral'}>
                  {addon.active ? 'Aktív' : 'Inaktív'}
                </StatusBadge>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEdit(addon)}
                >
                  Szerkesztés
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddonFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        features={features}
        mode="create"
        onDone={() => {
          setCreateOpen(false)
          router.refresh()
        }}
      />

      {edit ? (
        <AddonFormDialog
          open={Boolean(edit)}
          onOpenChange={(open) => {
            if (!open) setEdit(null)
          }}
          features={features}
          mode="edit"
          initial={edit}
          onDone={() => {
            setEdit(null)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function AddonFormDialog({
  open,
  onOpenChange,
  features,
  mode,
  initial,
  onDone
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  features: ProductFeature[]
  mode: 'create' | 'edit'
  initial?: AddonRow
  onDone: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [name, setName] = useState(initial?.name ?? '')
  const [key, setKey] = useState(initial?.key ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [keys, setKeys] = useState<Set<string>>(
    () => new Set(initial?.featureKeys ?? [])
  )
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const byCategory = useMemo(() => {
    const cats = [...new Set(features.map((f) => f.category))]
    return cats.map((category) => ({
      category,
      items: features.filter((f) => f.category === category)
    }))
  }, [features])

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setKey(initial?.key ?? '')
    setDescription(initial?.description ?? '')
    setActive(initial?.active ?? true)
    setKeys(new Set(initial?.featureKeys ?? []))
    setError(null)
  }, [open, initial])

  function toggle(featureKey: string) {
    setKeys((prev) => {
      const next = new Set(prev)
      if (next.has(featureKey)) next.delete(featureKey)
      else next.add(featureKey)
      return next
    })
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      if (mode === 'create') {
        const result = await createProductAddon({
          name,
          key: key || undefined,
          description,
          featureKeys: [...keys]
        })
        if (!result.ok) {
          setError(result.message)
          toast.error(result.message)
          return
        }
        toast.success(result.message ?? 'Létrehozva.')
      } else if (initial) {
        const result = await updateProductAddon({
          addonId: initial.id,
          name,
          description,
          active,
          featureKeys: [...keys]
        })
        if (!result.ok) {
          setError(result.message)
          toast.error(result.message)
          return
        }
        toast.success(result.message ?? 'Mentve.')
      }
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-[560px] overflow-y-auto"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Új add-on' : 'Add-on szerkesztése'}
          </DialogTitle>
          <DialogDescription>
            Az add-on feature-eit csak a platform kapcsolja be cégenként.
          </DialogDescription>
        </DialogHeader>

        <FormField label="Név" htmlFor="addon-name">
          <Input
            id="addon-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
          />
        </FormField>

        {mode === 'create' ? (
          <FormField label="Kulcs (opcionális)" htmlFor="addon-key">
            <Input
              id="addon-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="pl. raktar-plus"
              disabled={pending}
            />
          </FormField>
        ) : null}

        <FormField label="Leírás" htmlFor="addon-desc">
          <Input
            id="addon-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={pending}
          />
        </FormField>

        {mode === 'edit' ? (
          <label className="flex items-center gap-2 text-body text-ink">
            <input
              type="checkbox"
              className="size-3.5 rounded border-border"
              checked={active}
              disabled={pending}
              onChange={(e) => setActive(e.target.checked)}
            />
            Aktív (listázható a cég detailen)
          </label>
        ) : null}

        <div className="space-y-3">
          <p className="text-hint font-semibold text-ink-secondary">
            Feature-ök
          </p>
          {byCategory.map((group) => (
            <div key={group.category}>
              <p className="mb-1 text-hint text-ink-muted">{group.category}</p>
              <ul className="space-y-1">
                {group.items.map((f) => (
                  <li key={f.key}>
                    <label className="flex cursor-pointer items-center gap-2 text-body text-ink">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border-border"
                        checked={keys.has(f.key)}
                        disabled={pending}
                        onChange={() => toggle(f.key)}
                      />
                      {f.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {error ? (
          <p className="text-body text-danger-ink" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={pending}
            onClick={handleSave}
          >
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
