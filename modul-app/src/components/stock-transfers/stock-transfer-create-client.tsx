'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Textarea } from '@/components/ui/textarea'
import { searchPurchaseProductsAction } from '@/lib/purchase-orders/actions'
import type { PurchaseProductSearchItem } from '@/lib/purchase-orders/queries'
import {
  createStockTransferAction,
  getTransferOnHandAction
} from '@/lib/stock-transfers/actions'
import { cn } from '@/lib/utils'

type WarehouseOption = {
  id: string
  name: string
  code: string
  is_default: boolean
}

type Line = {
  accessoryId: string
  name: string
  sku: string
  unitShortform: string
  quantity: number
  onHand: number | null
}

type StockTransferCreateClientProps = {
  warehouses: WarehouseOption[]
  canWrite: boolean
  initialFromWarehouseId?: string
  initialAccessory?: {
    id: string
    name: string
    sku: string
    unitShortform: string
  } | null
}

function formatQty(n: number) {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

export function StockTransferCreateClient({
  warehouses,
  canWrite,
  initialFromWarehouseId,
  initialAccessory
}: StockTransferCreateClientProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const defaultFrom =
    initialFromWarehouseId &&
    warehouses.some((w) => w.id === initialFromWarehouseId)
      ? initialFromWarehouseId
      : warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? ''
  const defaultTo =
    warehouses.find((w) => w.id !== defaultFrom)?.id ?? ''

  const [fromId, setFromId] = useState(defaultFrom)
  const [toId, setToId] = useState(defaultTo)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>(() =>
    initialAccessory
      ? [
          {
            accessoryId: initialAccessory.id,
            name: initialAccessory.name,
            sku: initialAccessory.sku,
            unitShortform: initialAccessory.unitShortform,
            quantity: 1,
            onHand: null
          }
        ]
      : []
  )
  const [searchQ, setSearchQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchHits, setSearchHits] = useState<PurchaseProductSearchItem[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((w) => ({
        value: w.id,
        label: w.name,
        hint: w.code
      })),
    [warehouses]
  )

  const toOptions = useMemo(
    () => warehouseOptions.filter((o) => o.value !== fromId),
    [warehouseOptions, fromId]
  )

  useEffect(() => {
    if (toId === fromId) {
      const next = warehouses.find((w) => w.id !== fromId)?.id ?? ''
      setToId(next)
    }
  }, [fromId, toId, warehouses])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const q = searchQ.trim()
    if (q.length < 1) {
      setSearchHits([])
      setSearching(false)
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(() => {
      void searchPurchaseProductsAction(q).then((res) => {
        setSearching(false)
        if (res.ok) {
          setSearchHits(res.rows)
          setSearchOpen(true)
        } else {
          setSearchHits([])
        }
      })
    }, 220)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [searchQ])

  useEffect(() => {
    if (!fromId || lines.length === 0) return
    let cancelled = false
    void (async () => {
      const next = await Promise.all(
        lines.map(async (line) => {
          const res = await getTransferOnHandAction(line.accessoryId, fromId)
          return {
            ...line,
            onHand: res.ok ? res.onHand : null
          }
        })
      )
      if (!cancelled) setLines(next)
    })()
    return () => {
      cancelled = true
    }
    // Refresh on-hand when warehouse or line set identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only when fromId or accessory ids change
  }, [fromId, lines.map((l) => l.accessoryId).join('|')])

  function addProduct(hit: PurchaseProductSearchItem) {
    setLines((prev) => {
      if (prev.some((l) => l.accessoryId === hit.id)) {
        toast.message('Ez a termék már a listán van.')
        return prev
      }
      return [
        ...prev,
        {
          accessoryId: hit.id,
          name: hit.name,
          sku: hit.sku,
          unitShortform: hit.unit_shortform,
          quantity: 1,
          onHand: null
        }
      ]
    })
    setSearchQ('')
    setSearchOpen(false)
    setSearchHits([])
  }

  function setQty(accessoryId: string, quantity: number) {
    setLines((prev) =>
      prev.map((l) =>
        l.accessoryId === accessoryId
          ? { ...l, quantity: Math.max(0, quantity) }
          : l
      )
    )
  }

  function removeLine(accessoryId: string) {
    setLines((prev) => prev.filter((l) => l.accessoryId !== accessoryId))
  }

  function validate(): string | null {
    if (!fromId || !toId) return 'Válaszd ki a forrás- és célraktárat.'
    if (fromId === toId) return 'A forrás- és célraktár nem lehet ugyanaz.'
    if (lines.length === 0) return 'Adj hozzá legalább egy terméket.'
    for (const line of lines) {
      if (!(line.quantity > 0)) {
        return `Adj meg pozitív mennyiséget: ${line.name}.`
      }
      if (line.onHand != null && line.quantity > line.onHand + 0.0001) {
        return `Nincs elég készlet: ${line.name} (készleten: ${formatQty(line.onHand)}).`
      }
    }
    return null
  }

  function openConfirm() {
    const err = validate()
    if (err) {
      setFormError(err)
      toast.error(err)
      return
    }
    setFormError(null)
    setConfirmOpen(true)
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await createStockTransferAction({
        fromWarehouseId: fromId,
        toWarehouseId: toId,
        note: note.trim() || null,
        items: lines.map((l) => ({
          accessoryId: l.accessoryId,
          quantity: l.quantity
        }))
      })
      if (!result.ok) {
        setFormError(result.message)
        toast.error(result.message)
        setConfirmOpen(false)
        return
      }
      toast.success(
        result.transferNumber
          ? `Áttárolás kész: ${result.transferNumber}`
          : 'Áttárolás kész.'
      )
      router.push(`/keszlet/atadasok/${result.id}`)
      router.refresh()
    })
  }

  const fromName = warehouses.find((w) => w.id === fromId)?.name ?? '—'
  const toName = warehouses.find((w) => w.id === toId)?.name ?? '—'

  if (!canWrite) {
    return (
      <div className="space-y-3">
        <PageHeader title="Új áttárolás" />
        <p className="text-body text-ink-secondary">Nincs írási jogosultságod.</p>
      </div>
    )
  }

  if (warehouses.length < 2) {
    return (
      <div className="space-y-3">
        <PageHeader title="Új áttárolás" />
        <p className="rounded-md border border-warning/35 bg-warning-soft px-3 py-2.5 text-body text-warning-ink">
          Legalább két aktív raktár kell.{' '}
          <Link
            href="/torzsadatok/rendszer/raktarak"
            className="font-medium underline-offset-2 hover:underline"
          >
            Raktárak
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Új áttárolás"
        description="A készlet azonnal átkerül a célraktárba."
        actions={
          <Button type="button" onClick={openConfirm} disabled={pending}>
            Átadás rögzítése
          </Button>
        }
      />

      {formError ? (
        <p
          className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger-ink"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <FormSection title="Raktárak" columns={2}>
        <FormField label="Honnan" htmlFor="transfer-from">
          <MenuSelect
            id="transfer-from"
            value={fromId}
            onChange={setFromId}
            allowEmpty={false}
            options={warehouseOptions}
            placeholder="Forrásraktár"
          />
        </FormField>
        <FormField label="Hová" htmlFor="transfer-to">
          <MenuSelect
            id="transfer-to"
            value={toId}
            onChange={setToId}
            allowEmpty={false}
            options={toOptions}
            placeholder="Célraktár"
          />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Megjegyzés (opcionális)" htmlFor="transfer-note">
            <Textarea
              id="transfer-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Tételek" columns={2}>
        <div className="sm:col-span-2 space-y-3">
          <div ref={searchWrapRef} className="relative max-w-xl">
            <label className="sr-only" htmlFor="transfer-product-search">
              Termék keresése
            </label>
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              id="transfer-product-search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onFocus={() => {
                if (searchHits.length > 0) setSearchOpen(true)
              }}
              placeholder="Termék keresése (név, SKU, vonalkód)…"
              className="pl-8"
              autoComplete="off"
            />
            {searchOpen && (searchHits.length > 0 || searching) ? (
              <ul
                className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface shadow-md"
                role="listbox"
              >
                {searching && searchHits.length === 0 ? (
                  <li className="px-2.5 py-2 text-hint text-ink-secondary">
                    Keresés…
                  </li>
                ) : null}
                {searchHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 px-2.5 py-2 text-left hover:bg-subtle"
                      onClick={() => addProduct(hit)}
                    >
                      <span className="text-body font-medium text-ink">
                        {hit.name}
                      </span>
                      <span className="text-hint text-ink-secondary">
                        {hit.sku} · {hit.unit_shortform}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {lines.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
              Adj hozzá terméket a keresővel.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[36rem] border-collapse text-body">
                <thead>
                  <tr className="border-b border-border bg-subtle text-left text-label text-ink-secondary">
                    <th className="px-2.5 py-2 font-medium">Termék</th>
                    <th className="px-2.5 py-2 font-medium text-right">
                      Készleten
                    </th>
                    <th className="px-2.5 py-2 font-medium text-right">
                      Mennyiség
                    </th>
                    <th className="px-2.5 py-2 font-medium w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const over =
                      line.onHand != null && line.quantity > line.onHand + 0.0001
                    return (
                      <tr
                        key={line.accessoryId}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-2.5 py-2">
                          <div className="font-medium text-ink">{line.name}</div>
                          <div className="text-hint text-ink-secondary">
                            {line.sku} · {line.unitShortform}
                          </div>
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-ink-secondary">
                          {line.onHand == null ? '…' : formatQty(line.onHand)}
                        </td>
                        <td className="px-2.5 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            className={cn(
                              'ml-auto w-24 text-right tabular-nums',
                              over && 'border-danger'
                            )}
                            value={line.quantity}
                            onChange={(e) => {
                              const n = Number(e.target.value)
                              setQty(
                                line.accessoryId,
                                Number.isFinite(n) ? n : 0
                              )
                            }}
                          />
                        </td>
                        <td className="px-2.5 py-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Sor törlése"
                            onClick={() => removeLine(line.accessoryId)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1"
            onClick={() => {
              document.getElementById('transfer-product-search')?.focus()
            }}
          >
            <Plus className="size-3.5" aria-hidden />
            Termék hozzáadása
          </Button>
        </div>
      </FormSection>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!pending) setConfirmOpen(open)
        }}
        title="Átadás rögzítése"
        description={`${lines.length} tétel kerül át: ${fromName} → ${toName}. Ez nem vonható vissza.`}
        confirmLabel="Átadás rögzítése"
        variant="primary"
        loading={pending}
        onConfirm={handleSubmit}
      />
    </div>
  )
}
