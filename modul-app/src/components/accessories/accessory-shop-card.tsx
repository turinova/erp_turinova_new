'use client'

import { ArrowRight, CircleAlert } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormSection } from '@/components/patterns/form-section'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Switch } from '@/components/ui/switch'
import { SHOP_READY_LABEL, shopReadyTone } from '@/lib/accessories/web-shop'
import { setShopAvailability } from '@/lib/webshop/product-actions'
import type { ShopRequirementIssue } from '@/lib/webshop/product-parse'
import type { ShopCardStatus } from '@/lib/webshop/product-queries'

/** Az alap termékoldalon csak ennyi a webshopból: kapcsoló, állapot, link a modul szerkesztőjéhez. */
export function AccessoryShopCard({
  accessoryId,
  status,
  canWrite
}: {
  accessoryId: string | null
  status: ShopCardStatus | null
  canWrite: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [sellable, setSellable] = useState(status?.sellable ?? false)
  const [blocked, setBlocked] = useState<ShopRequirementIssue[]>([])
  const editorHref = accessoryId ? `/webshop/katalogus/${accessoryId}` : null

  function onToggle(next: boolean) {
    if (!accessoryId) return
    startTransition(async () => {
      const r = await setShopAvailability([accessoryId], next)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      const mine = r.blocked.find((b) => b.id === accessoryId)
      if (mine) {
        setBlocked(mine.issues)
        toast.error('Még nem tehető ki a boltba — nézd meg, mi hiányzik.')
        return
      }
      setBlocked([])
      setSellable(next)
      toast.success(next ? 'Kint van az online boltban.' : 'Levéve az online boltból.')
      router.refresh()
    })
  }

  const level = status?.ready.level ?? 'off'

  return (
    <FormSection
      title="Online bolt"
      description="A bolt adatait (leírás, kategória, kulcsadatok) a Webshop modulban szerkesztheted."
      columns={1}
      headerAside={
        accessoryId && sellable ? (
          <StatusBadge tone={shopReadyTone(level)}>{SHOP_READY_LABEL[level]}</StatusBadge>
        ) : null
      }
    >
      {accessoryId ? (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <Switch
            id="accessory-shop-sellable"
            checked={sellable}
            disabled={pending || !canWrite}
            onCheckedChange={onToggle}
            label="Elérhető az online boltban"
            description={sellable ? 'Kint van, a vásárlók látják.' : 'Nincs kint a boltban.'}
          />
          {editorHref ? (
            <Link
              href={editorHref}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Bolt adatok szerkesztése
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : (
        <p className="text-hint text-ink-secondary">Mentés után kapcsolható be.</p>
      )}

      {blocked.length > 0 && editorHref ? (
        <div
          className="space-y-1 rounded-md border border-warning/30 bg-warning-soft px-2.5 py-2 text-hint text-warning-ink"
          role="status"
        >
          <p className="flex items-center gap-1.5 font-medium">
            <CircleAlert className="size-3.5 shrink-0" aria-hidden />
            A bekapcsoláshoz még kell:
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {blocked.map((i) => (
              <li key={i.field}>{i.message}</li>
            ))}
          </ul>
          <Link href={`${editorHref}#csoport-alapok`} className="inline-block underline underline-offset-2">
            Kitöltöm a bolt adatokat
          </Link>
        </div>
      ) : null}
    </FormSection>
  )
}
