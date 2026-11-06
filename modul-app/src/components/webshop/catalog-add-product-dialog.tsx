'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatMoneyFt } from '@/lib/accessories/parse'
import {
  addShopProductsByManufacturer,
  ensureShopProduct,
  previewShopAddByManufacturer,
  searchManufacturersForShopAdd,
  searchProductsForShopAdd,
  type ShopAddByManufacturerPreview,
  type ShopAddManufacturerHit,
  type ShopAddSearchHit
} from '@/lib/webshop/product-actions'
import { cn } from '@/lib/utils'

type Mode = 'product' | 'manufacturer'

const n = (v: number) => v.toLocaleString('hu-HU')

export function CatalogAddProductDialog({
  open,
  onOpenChange,
  onManufacturerAdded
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Gyártó szerinti tömeges hozzáadás után — tipikusan Készül szűrő + invalidate. */
  onManufacturerAdded?: () => void
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('product')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<ShopAddSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [mfrQ, setMfrQ] = useState('')
  const [mfrHits, setMfrHits] = useState<ShopAddManufacturerHit[]>([])
  const [mfrSearching, setMfrSearching] = useState(false)
  const [selectedMfr, setSelectedMfr] = useState<ShopAddManufacturerHit | null>(null)
  const [preview, setPreview] = useState<ShopAddByManufacturerPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [remainingAfterRun, setRemainingAfterRun] = useState<number | null>(null)

  useEffect(() => {
    if (!open) {
      setMode('product')
      setQ('')
      setRows([])
      setPendingId(null)
      setMfrQ('')
      setMfrHits([])
      setSelectedMfr(null)
      setPreview(null)
      setRemainingAfterRun(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || mode !== 'product') return
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setRows([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      setSearching(true)
      void searchProductsForShopAdd(trimmed).then((r) => {
        if (cancelled) return
        setSearching(false)
        if (!r.ok) {
          toast.error(r.message)
          setRows([])
          return
        }
        setRows(r.rows)
      })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q, open, mode])

  useEffect(() => {
    if (!open || mode !== 'manufacturer' || selectedMfr) return
    const trimmed = mfrQ.trim()
    if (trimmed.length < 1) {
      setMfrHits([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      setMfrSearching(true)
      void searchManufacturersForShopAdd(trimmed).then((r) => {
        if (cancelled) return
        setMfrSearching(false)
        if (!r.ok) {
          toast.error(r.message)
          setMfrHits([])
          return
        }
        setMfrHits(r.rows)
      })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [mfrQ, open, mode, selectedMfr])

  useEffect(() => {
    if (!open || mode !== 'manufacturer' || !selectedMfr) {
      setPreview(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setRemainingAfterRun(null)
    void previewShopAddByManufacturer(selectedMfr.id).then((r) => {
      if (cancelled) return
      setPreviewLoading(false)
      if (!r.ok) {
        toast.error(r.message)
        setPreview(null)
        return
      }
      setPreview(r.preview)
    })
    return () => {
      cancelled = true
    }
  }, [selectedMfr, open, mode])

  function add(id: string) {
    setPendingId(id)
    startTransition(async () => {
      const r = await ensureShopProduct(id)
      setPendingId(null)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      toast.success(r.created ? 'Hozzáadva a bolthoz — töltsd ki, majd Live.' : 'Már a boltban van.')
      onOpenChange(false)
      router.push(`/webshop/katalogus/${id}`)
      router.refresh()
    })
  }

  function pickManufacturer(hit: ShopAddManufacturerHit) {
    setSelectedMfr(hit)
    setMfrQ(hit.name)
    setMfrHits([])
    setRemainingAfterRun(null)
  }

  function clearManufacturer() {
    setSelectedMfr(null)
    setPreview(null)
    setRemainingAfterRun(null)
    setMfrQ('')
    setMfrHits([])
  }

  function addByManufacturer() {
    if (!selectedMfr) return
    startTransition(async () => {
      const r = await addShopProductsByManufacturer(selectedMfr.id)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      if (r.remaining > 0) {
        setRemainingAfterRun(r.remaining)
        toast.warning(
          `${n(r.added)} termék hozzáadva — még ${n(r.remaining)} maradt. Folytasd a gombbal.`
        )
        const again = await previewShopAddByManufacturer(selectedMfr.id)
        if (again.ok) setPreview(again.preview)
        onManufacturerAdded?.()
        return
      }
      toast.success(
        r.added > 0
          ? `${n(r.added)} termék a boltban — Készül. A Live-ot a listán kapcsolod.`
          : 'Minden termék már a boltban van.'
      )
      onOpenChange(false)
      onManufacturerAdded?.()
    })
  }

  const toAdd = remainingAfterRun ?? preview?.toAdd ?? 0
  const primaryLabel =
    remainingAfterRun != null && remainingAfterRun > 0
      ? `Folytatom (${n(remainingAfterRun)} maradt)`
      : toAdd > 0
        ? `${n(toAdd)} termék hozzáadása`
        : 'Nincs mit hozzáadni'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-3 p-4">
        <DialogHeader>
          <DialogTitle>Termék hozzáadása a bolthoz</DialogTitle>
          <DialogDescription>
            {mode === 'product'
              ? 'Keress az ERP termékek között. A Live-ot utána kapcsolod be.'
              : 'Egy gyártó összes aktív termékét felveszed. A Live kikapcsolva marad.'}
          </DialogDescription>
        </DialogHeader>

        <div
          role="tablist"
          aria-label="Hozzáadás mód"
          className="inline-flex gap-1 rounded-lg border border-border bg-subtle p-1"
        >
          {(
            [
              { key: 'product', label: 'Egy termék' },
              { key: 'manufacturer', label: 'Gyártó szerint' }
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={mode === tab.key}
              onClick={() => setMode(tab.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                mode === tab.key
                  ? 'bg-ink text-white'
                  : 'text-ink-secondary hover:bg-surface hover:text-ink'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode === 'product' ? (
          <>
            <div className="relative">
              <label className="sr-only" htmlFor="shop-add-search">
                Termék keresése
              </label>
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <Input
                id="shop-add-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Név, cikkszám, vonalkód…"
                className="pl-8"
                autoFocus
                autoComplete="off"
              />
            </div>
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {q.trim().length < 2 ? (
                <li className="px-3 py-6 text-center text-hint text-ink-secondary">
                  Írj legalább 2 karaktert.
                </li>
              ) : searching ? (
                <li className="px-3 py-6 text-center text-hint text-ink-secondary">Keresés…</li>
              ) : rows.length === 0 ? (
                <li className="px-3 py-6 text-center text-hint text-ink-secondary">Nincs találat.</li>
              ) : (
                rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      disabled={row.in_shop || pending}
                      onClick={() => add(row.id)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-body',
                        row.in_shop
                          ? 'cursor-not-allowed bg-subtle text-ink-muted'
                          : 'text-ink hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary'
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{row.name}</span>
                        <span className="text-hint tabular-nums text-ink-secondary">
                          {row.sku} · {formatMoneyFt(row.price_gross)}
                        </span>
                      </span>
                      {row.in_shop ? (
                        <span className="shrink-0 text-hint">Már a boltban</span>
                      ) : pendingId === row.id ? (
                        <span className="shrink-0 text-hint">…</span>
                      ) : (
                        <span className="shrink-0 text-hint font-medium">Hozzáad</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Mégse
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="shop-add-manufacturer" className="mb-1 block text-hint text-ink-secondary">
                Gyártó
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
                  aria-hidden
                />
                <Input
                  id="shop-add-manufacturer"
                  value={mfrQ}
                  onChange={(e) => {
                    setMfrQ(e.target.value)
                    if (selectedMfr) {
                      setSelectedMfr(null)
                      setPreview(null)
                      setRemainingAfterRun(null)
                    }
                  }}
                  placeholder="Pl. Hranipex"
                  className="pl-8"
                  autoFocus
                  autoComplete="off"
                />
              </div>
              {!selectedMfr && mfrQ.trim().length >= 1 ? (
                <ul className="mt-1.5 max-h-40 divide-y divide-border overflow-y-auto rounded-md border border-border">
                  {mfrSearching ? (
                    <li className="px-3 py-3 text-center text-hint text-ink-secondary">Keresés…</li>
                  ) : mfrHits.length === 0 ? (
                    <li className="px-3 py-3 text-center text-hint text-ink-secondary">
                      Nincs ilyen gyártó.
                    </li>
                  ) : (
                    mfrHits.map((hit) => (
                      <li key={hit.id}>
                        <button
                          type="button"
                          onClick={() => pickManufacturer(hit)}
                          className="w-full px-3 py-2 text-left text-body text-ink hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        >
                          {hit.name}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
              {selectedMfr ? (
                <button
                  type="button"
                  onClick={clearManufacturer}
                  className="mt-1.5 text-hint text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
                >
                  Másik gyártó
                </button>
              ) : null}
            </div>

            {selectedMfr ? (
              <div className="rounded-md border border-border bg-subtle px-3 py-2.5">
                {previewLoading || !preview ? (
                  <p className="text-hint text-ink-secondary">Számolás…</p>
                ) : (
                  <>
                    <p className="text-body text-ink">
                      <span className="font-medium">{preview.manufacturerName}</span>
                      {' — '}
                      {n(preview.total)} termék · {n(preview.inShop)} már a boltban
                      {preview.inactive > 0
                        ? ` · ${n(preview.inactive)} inaktív (kimarad)`
                        : null}
                    </p>
                    {preview.toAdd === 0 ? (
                      <p className="mt-1 text-hint text-ink-secondary">
                        Minden {preview.manufacturerName} termék már a boltban.
                      </p>
                    ) : preview.sample.length > 0 ? (
                      <p className="mt-1 text-hint text-ink-muted">
                        Pl. {preview.sample.join(' · ')}
                        {preview.toAdd > preview.sample.length ? '…' : null}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <p className="py-4 text-center text-hint text-ink-secondary">
                Válassz gyártót a listából.
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Mégse
              </Button>
              <Button
                type="button"
                disabled={!selectedMfr || previewLoading || !preview || toAdd <= 0 || pending}
                loading={pending}
                onClick={addByManufacturer}
              >
                {primaryLabel}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
