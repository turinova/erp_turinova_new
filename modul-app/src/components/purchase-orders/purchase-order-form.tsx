'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Textarea } from '@/components/ui/textarea'
import { formatMoneyFt } from '@/lib/accessories/parse'
import {
  RECEIPT_STATUS_LABEL,
  receiptStatusTone,
  qtyVariance
} from '@/lib/goods-receipts/parse'
import type { GoodsReceiptForPoRow } from '@/lib/goods-receipts/queries'
import {
  closePurchaseOrderIncomplete,
  createPurchaseOrder,
  markPurchaseOrderOrdered,
  searchPurchaseProductsAction,
  updatePurchaseOrder
} from '@/lib/purchase-orders/actions'
import { openOrCreateGoodsReceipt } from '@/lib/goods-receipts/actions'
import {
  lineAmounts,
  mergeItemsByAccessory,
  PO_STATUS_LABEL,
  poStatusTone,
  sumOrderAmounts,
  type PurchaseOrderFormInput,
  type PurchaseOrderItemInput,
  type PurchaseOrderStatus
} from '@/lib/purchase-orders/parse'
import type { PurchaseOrderDetail } from '@/lib/purchase-orders/queries'
import type { PurchaseProductSearchItem } from '@/lib/purchase-orders/queries'
import type { SupplierSelectOption } from '@/lib/suppliers/queries'

type WarehouseOption = {
  id: string
  name: string
  code: string
  is_default: boolean
}

type PurchaseOrderFormProps = {
  mode: 'create' | 'edit'
  initial?: PurchaseOrderDetail | null
  canWrite: boolean
  suppliers: SupplierSelectOption[]
  warehouses: WarehouseOption[]
  receipts?: GoodsReceiptForPoRow[]
}

function formatQty(n: number) {
  return new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 3
  }).format(n)
}

function formatShortDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('hu-HU')
  } catch {
    return '—'
  }
}

function lineReceiveLabel(received: number, ordered: number) {
  const v = qtyVariance(received, ordered)
  if (v === 'ok') return { tone: 'success' as const, label: 'Teljes' }
  if (v === 'over') return { tone: 'warning' as const, label: 'Többlet' }
  if (v === 'under') return { tone: 'warning' as const, label: 'Részleges' }
  return { tone: 'neutral' as const, label: 'Vár' }
}

function defaultWarehouseId(warehouses: WarehouseOption[]) {
  return (
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? ''
  )
}

function detailToForm(
  initial: PurchaseOrderDetail | null | undefined,
  warehouses: WarehouseOption[]
): PurchaseOrderFormInput {
  if (!initial) {
    return {
      supplierId: '',
      warehouseId: defaultWarehouseId(warehouses),
      expectedDate: '',
      note: '',
      currency: 'HUF',
      items: []
    }
  }
  return {
    supplierId: initial.supplier_id,
    warehouseId: initial.warehouse_id || defaultWarehouseId(warehouses),
    expectedDate: initial.expected_date ?? '',
    note: initial.note ?? '',
    currency: (initial.currency as 'HUF' | 'EUR' | 'USD') || 'HUF',
    items: initial.items.map((it) => ({
      accessoryId: it.accessory_id,
      nameSnapshot: it.name_snapshot,
      skuSnapshot: it.sku_snapshot,
      quantity: it.quantity,
      netPrice: it.net_price,
      taxRateId: it.tax_rate_id,
      taxRatePercent: it.tax_rate_percent,
      unitId: it.unit_id,
      unitShortform: it.unit_shortform
    }))
  }
}

function productToItem(p: PurchaseProductSearchItem): PurchaseOrderItemInput {
  const net =
    p.purchase_price_net != null && p.purchase_price_net > 0
      ? p.purchase_price_net
      : p.price_net
  return {
    accessoryId: p.id,
    nameSnapshot: p.name,
    skuSnapshot: p.sku,
    quantity: 1,
    netPrice: Math.round(net),
    taxRateId: p.tax_rate_id,
    taxRatePercent: p.tax_rate_percent,
    unitId: p.unit_id,
    unitShortform: p.unit_shortform
  }
}

export function PurchaseOrderForm({
  mode,
  initial,
  canWrite,
  suppliers,
  warehouses,
  receipts = []
}: PurchaseOrderFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<PurchaseOrderFormInput>(() =>
    detailToForm(initial, warehouses)
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [searchQ, setSearchQ] = useState('')
  const [searchHits, setSearchHits] = useState<PurchaseProductSearchItem[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [markOpen, setMarkOpen] = useState(false)
  const [closeIncompleteOpen, setCloseIncompleteOpen] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  const status: PurchaseOrderStatus = initial?.status ?? 'draft'
  const editable = canWrite && status === 'draft'
  const showWarehousePicker = warehouses.length > 1
  const warehouseLabel = (() => {
    const fromList = warehouses.find((w) => w.id === form.warehouseId)
    if (fromList) return `${fromList.name} (${fromList.code})`
    if (initial?.warehouse_id === form.warehouseId && initial.warehouse_name) {
      return initial.warehouse_code
        ? `${initial.warehouse_name} (${initial.warehouse_code})`
        : initial.warehouse_name
    }
    return '—'
  })()
  const showReceive =
    mode === 'edit' && status !== 'draft' && status !== 'cancelled'
  const receiveSummary = initial?.receive_summary
  const checkingReceipt = receipts.find((r) => r.status === 'checking')
  const totals = sumOrderAmounts(
    form.items.map((it) => ({
      quantity: it.quantity,
      netPrice: it.netPrice,
      taxRatePercent: it.taxRatePercent
    }))
  )

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    if (!editable) return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const q = searchQ.trim()
    if (q.length < 2) {
      setSearchHits([])
      setSearchOpen(false)
      return
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const result = await searchPurchaseProductsAction(q)
      setSearching(false)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setSearchHits(result.rows)
      setSearchOpen(true)
    }, 280)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [searchQ, editable])

  function patch(p: Partial<PurchaseOrderFormInput>) {
    setForm((prev) => ({ ...prev, ...p }))
  }

  function addProduct(p: PurchaseProductSearchItem) {
    const next = mergeItemsByAccessory([...form.items, productToItem(p)])
    patch({ items: next })
    setSearchQ('')
    setSearchHits([])
    setSearchOpen(false)
  }

  function updateItem(index: number, patchItem: Partial<PurchaseOrderItemInput>) {
    const next = form.items.map((it, i) =>
      i === index ? { ...it, ...patchItem } : it
    )
    patch({ items: next })
  }

  function removeItem(index: number) {
    patch({ items: form.items.filter((_, i) => i !== index) })
  }

  function handleSave() {
    if (!editable) return
    startTransition(async () => {
      const payload = {
        ...form,
        items: mergeItemsByAccessory(form.items)
      }
      const result =
        mode === 'edit' && initial
          ? await updatePurchaseOrder({ id: initial.id, ...payload })
          : await createPurchaseOrder(payload)

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      setFieldErrors({})
      if (mode === 'edit') {
        toast.success('Rendelés mentve.')
      }
      router.push(`/beszallitoi-rendelesek/${result.id}`)
      router.refresh()
    })
  }

  function handleMarkOrdered() {
    if (!initial || !canWrite) return
    startTransition(async () => {
      if (status === 'draft' && editable) {
        const payload = {
          ...form,
          items: mergeItemsByAccessory(form.items)
        }
        const saved = await updatePurchaseOrder({
          id: initial.id,
          ...payload
        })
        if (!saved.ok) {
          setFieldErrors(saved.fieldErrors ?? {})
          toast.error(saved.message)
          setMarkOpen(false)
          return
        }
      }
      const result = await markPurchaseOrderOrdered(initial.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Rendelés megrendelve.')
      setMarkOpen(false)
      router.refresh()
    })
  }

  const title =
    mode === 'edit'
      ? (initial?.po_number ?? 'Rendelés')
      : 'Új beszállítói rendelés'

  return (
    <div className="pb-14">
      <PageHeader
        title={title}
        description="Beszerzés → Beszállítói rendelések"
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {mode === 'edit' && initial ? (
              <>
                <StatusBadge tone={poStatusTone(status)}>
                  {PO_STATUS_LABEL[status]}
                </StatusBadge>
                {showReceive && receiveSummary ? (
                  <span className="text-hint text-ink-secondary tabular-nums">
                    {formatQty(receiveSummary.received_qty)} /{' '}
                    {formatQty(receiveSummary.ordered_qty)} db ·{' '}
                    {receiveSummary.percent}%
                  </span>
                ) : null}
              </>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/beszallitoi-rendelesek')}
            >
              Vissza a listához
            </Button>
            {editable ? (
              <Button type="button" loading={pending} onClick={handleSave}>
                Rendelés mentése
              </Button>
            ) : null}
            {canWrite && status === 'draft' && mode === 'edit' && initial ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => setMarkOpen(true)}
                disabled={form.items.length === 0 || pending}
              >
                Megrendelés jelölése
              </Button>
            ) : null}
            {canWrite &&
            mode === 'edit' &&
            initial &&
            (status === 'ordered' || status === 'partial') ? (
              <Button
                type="button"
                variant="primary"
                loading={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await openOrCreateGoodsReceipt(initial.id)
                    if (!result.ok) {
                      toast.error(result.message)
                      router.refresh()
                      return
                    }
                    router.push(`/beerkezesek/${result.id}`)
                    router.refresh()
                  })
                }}
              >
                Áru megérkezett
              </Button>
            ) : null}
            {canWrite &&
            mode === 'edit' &&
            initial &&
            (status === 'ordered' || status === 'partial') ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setCloseIncompleteOpen(true)}
              >
                Rendelés lezárása (hiányos)
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="w-full max-w-6xl space-y-2.5">
        <FormSection title="Fejléc" columns={4}>
          <FormField
            label="Beszállító"
            htmlFor="po-supplier"
            required
            error={fieldErrors.supplierId}
            className="sm:col-span-2"
          >
            <MenuSelect
              id="po-supplier"
              value={form.supplierId}
              disabled={!editable}
              allowEmpty
              emptyLabel="Válassz…"
              placeholder="Válassz beszállítót…"
              searchable={suppliers.length > 8}
              options={suppliers.map((s) => ({
                value: s.id,
                label: s.name
              }))}
              onChange={(v) => patch({ supplierId: v })}
            />
          </FormField>

          {showWarehousePicker || !editable ? (
            <FormField
              label="Célraktár"
              htmlFor="po-warehouse"
              required={editable && showWarehousePicker}
              error={fieldErrors.warehouseId}
              hint={
                editable
                  ? 'Ide érkezik a készlet bevételezéskor.'
                  : undefined
              }
              className="sm:col-span-2"
            >
              {editable && showWarehousePicker ? (
                <MenuSelect
                  id="po-warehouse"
                  value={form.warehouseId}
                  allowEmpty={false}
                  searchable={warehouses.length > 8}
                  options={warehouses.map((w) => ({
                    value: w.id,
                    label: `${w.name} (${w.code})${w.is_default ? ' · alap' : ''}`
                  }))}
                  onChange={(v) => patch({ warehouseId: v })}
                />
              ) : (
                <Input
                  id="po-warehouse"
                  value={warehouseLabel}
                  disabled
                  readOnly
                />
              )}
            </FormField>
          ) : null}

          <FormField
            label="Várható érkezés"
            htmlFor="po-expected"
            optionalLabel
            error={fieldErrors.expectedDate}
          >
            <Input
              id="po-expected"
              type="date"
              value={form.expectedDate}
              disabled={!editable}
              onChange={(e) => patch({ expectedDate: e.target.value })}
            />
          </FormField>

          <FormField
            label="Pénznem"
            htmlFor="po-currency"
            error={fieldErrors.currency}
          >
            <MenuSelect
              id="po-currency"
              value={form.currency}
              disabled={!editable}
              allowEmpty={false}
              options={[
                { value: 'HUF', label: 'HUF' },
                { value: 'EUR', label: 'EUR' },
                { value: 'USD', label: 'USD' }
              ]}
              onChange={(v) =>
                patch({ currency: v as 'HUF' | 'EUR' | 'USD' })
              }
            />
          </FormField>

          <FormField
            label="Megjegyzés"
            htmlFor="po-note"
            optionalLabel
            error={fieldErrors.note}
            className="sm:col-span-4"
          >
            <Textarea
              id="po-note"
              value={form.note}
              disabled={!editable}
              onChange={(e) => patch({ note: e.target.value })}
              placeholder="pl. Webshopon leadva, referenciakód…"
              className="min-h-[4rem]"
            />
          </FormField>
        </FormSection>

        <FormSection title="Tételek" description="Csak termékek (SKU / név / vonalkód)." columns={4}>
          <div className="col-span-full space-y-2.5">
            {fieldErrors.items ? (
              <p className="text-hint text-danger-ink" role="alert">
                {fieldErrors.items}
              </p>
            ) : null}

            {editable ? (
              <div ref={searchWrapRef} className="relative max-w-xl">
                <label className="sr-only" htmlFor="po-product-search">
                  Termék keresése
                </label>
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
                  aria-hidden
                />
                <Input
                  id="po-product-search"
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
                            {hit.sku} ·{' '}
                            {formatMoneyFt(
                              hit.purchase_price_net ?? hit.price_net
                            )}{' '}
                            / {hit.unit_shortform}
                          </span>
                        </button>
                      </li>
                    ))}
                    {!searching && searchHits.length === 0 ? (
                      <li className="px-2.5 py-2 text-hint text-ink-secondary">
                        Nincs találat.
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {form.items.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary">
                {editable
                  ? 'Adj hozzá terméket a keresővel.'
                  : 'Nincs tétel.'}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[40rem] border-collapse text-body">
                  <thead>
                    <tr className="border-b border-border bg-subtle text-left text-label text-ink-secondary">
                      <th className="px-2.5 py-2 font-medium">Termék</th>
                      <th className="px-2.5 py-2 font-medium">SKU</th>
                      <th className="px-2.5 py-2 font-medium text-right">
                        Mennyiség
                      </th>
                      {showReceive ? (
                        <>
                          <th className="px-2.5 py-2 font-medium text-right">
                            Beérkezett
                          </th>
                          <th className="px-2.5 py-2 font-medium text-right">
                            Hiányzik
                          </th>
                          <th className="px-2.5 py-2 font-medium">Állapot</th>
                        </>
                      ) : null}
                      <th className="px-2.5 py-2 font-medium text-right">
                        Nettó / eg.
                      </th>
                      <th className="px-2.5 py-2 font-medium text-right">
                        ÁFA
                      </th>
                      <th className="px-2.5 py-2 font-medium text-right">
                        Összesen
                      </th>
                      {editable ? (
                        <th className="w-[1%] px-2.5 py-2 font-medium" />
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((it, index) => {
                      const line = lineAmounts(
                        it.quantity,
                        it.netPrice,
                        it.taxRatePercent
                      )
                      const received =
                        initial?.items[index]?.quantity_received ?? 0
                      const remaining = Math.max(0, it.quantity - received)
                      const receiveMeta = lineReceiveLabel(
                        received,
                        it.quantity
                      )
                      return (
                        <tr
                          key={`${it.accessoryId}-${index}`}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-2.5 py-2 font-medium text-ink">
                            {it.accessoryId ? (
                              <Link
                                href={`/torzsadatok/alapanyagok/termekek/${it.accessoryId}`}
                                className="underline-offset-2 hover:underline"
                              >
                                {it.nameSnapshot}
                              </Link>
                            ) : (
                              it.nameSnapshot
                            )}
                          </td>
                          <td className="px-2.5 py-2 text-ink-secondary">
                            {it.skuSnapshot}
                          </td>
                          <td className="px-2.5 py-2 text-right">
                            {editable ? (
                              <div className="inline-flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={0.001}
                                  step="any"
                                  className="h-8 w-20 text-right"
                                  value={it.quantity}
                                  onChange={(e) =>
                                    updateItem(index, {
                                      quantity: Number(e.target.value) || 0
                                    })
                                  }
                                />
                                <span className="text-hint text-ink-muted">
                                  {it.unitShortform}
                                </span>
                              </div>
                            ) : (
                              <span className="tabular-nums">
                                {formatQty(it.quantity)} {it.unitShortform}
                              </span>
                            )}
                          </td>
                          {showReceive ? (
                            <>
                              <td className="px-2.5 py-2 text-right tabular-nums font-medium">
                                {formatQty(received)} {it.unitShortform}
                              </td>
                              <td className="px-2.5 py-2 text-right tabular-nums text-ink-secondary">
                                {formatQty(remaining)} {it.unitShortform}
                              </td>
                              <td className="px-2.5 py-2">
                                <StatusBadge tone={receiveMeta.tone}>
                                  {receiveMeta.label}
                                </StatusBadge>
                              </td>
                            </>
                          ) : null}
                          <td className="px-2.5 py-2 text-right">
                            {editable ? (
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                className="ml-auto h-8 w-24 text-right"
                                value={it.netPrice}
                                onChange={(e) =>
                                  updateItem(index, {
                                    netPrice: Math.round(
                                      Number(e.target.value) || 0
                                    )
                                  })
                                }
                              />
                            ) : (
                              <span className="tabular-nums">
                                {formatMoneyFt(it.netPrice)}
                              </span>
                            )}
                          </td>
                          <td className="px-2.5 py-2 text-right text-ink-secondary tabular-nums">
                            {it.taxRatePercent}%
                          </td>
                          <td className="px-2.5 py-2 text-right font-medium tabular-nums">
                            {formatMoneyFt(line.net)}
                          </td>
                          {editable ? (
                            <td className="px-2.5 py-2 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-danger-ink"
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </Button>
                            </td>
                          ) : null}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col items-end gap-0.5 border-t border-border pt-2.5 text-body">
              {showReceive && receiveSummary ? (
                <div className="mb-1.5 flex min-w-[14rem] justify-between gap-6 text-ink-secondary">
                  <span>Beérkezés</span>
                  <span className="tabular-nums font-medium text-ink">
                    {formatQty(receiveSummary.received_qty)} /{' '}
                    {formatQty(receiveSummary.ordered_qty)} db (
                    {receiveSummary.percent}%)
                  </span>
                </div>
              ) : null}
              <div className="flex min-w-[14rem] justify-between gap-6">
                <span className="text-ink-secondary">Nettó</span>
                <span className="tabular-nums font-medium">
                  {formatMoneyFt(totals.net)}
                </span>
              </div>
              <div className="flex min-w-[14rem] justify-between gap-6">
                <span className="text-ink-secondary">ÁFA</span>
                <span className="tabular-nums">{formatMoneyFt(totals.vat)}</span>
              </div>
              <div className="flex min-w-[14rem] justify-between gap-6">
                <span className="text-ink-secondary">Bruttó</span>
                <span className="tabular-nums font-medium">
                  {formatMoneyFt(totals.gross)}
                </span>
              </div>
            </div>
          </div>
        </FormSection>

        {showReceive ? (
          <FormSection title="Beérkezések" columns={2}>
            <div className="sm:col-span-2">
              {receipts.length === 0 ? (
                <p className="text-body text-ink-secondary">
                  Még nincs beérkezés ehhez a rendeléshez.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {receipts.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/beerkezesek/${r.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-body hover:bg-subtle"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink">
                            {r.receipt_number}
                          </span>
                          <StatusBadge tone={receiptStatusTone(r.status)}>
                            {RECEIPT_STATUS_LABEL[r.status]}
                          </StatusBadge>
                          <span className="text-hint text-ink-muted">
                            {r.items_count} tétel
                          </span>
                        </div>
                        <span className="text-hint text-ink-secondary tabular-nums">
                          {formatShortDate(r.received_at ?? r.created_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {checkingReceipt ? (
                <p className="mt-2 text-body text-ink-secondary">
                  Folyamatban:{' '}
                  <Link
                    href={`/beerkezesek/${checkingReceipt.id}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                  >
                    {checkingReceipt.receipt_number}
                  </Link>{' '}
                  — folytasd az ellenőrzést, vagy zárd le a bevételezést.
                </p>
              ) : null}
            </div>
          </FormSection>
        ) : null}

        {initial?.closed_incomplete_at ? (
          <p className="rounded-md border border-border bg-subtle px-3 py-2.5 text-body text-ink-secondary">
            Hiányosan lezárva{' '}
            <span className="tabular-nums">
              {formatShortDate(initial.closed_incomplete_at)}
            </span>
            . A hiányzó tételeket nem várod többet.
          </p>
        ) : null}

        {status === 'ordered' || status === 'partial' ? (
          <p className="rounded-md border border-border bg-subtle px-3 py-2.5 text-body text-ink-secondary">
            Ha megérkezett az áru, kattints az <strong>Áru megérkezett</strong>{' '}
            gombra. Ha a maradékot már nem várod:{' '}
            <strong>Rendelés lezárása (hiányos)</strong>.
          </p>
        ) : null}

        {editable ? (
          <div className="flex justify-end gap-1.5 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/beszallitoi-rendelesek')}
            >
              Mégse
            </Button>
            <Button type="button" loading={pending} onClick={handleSave}>
              <Plus className="size-3.5" aria-hidden />
              Rendelés mentése
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={markOpen}
        onOpenChange={(open) => {
          if (!open && !pending) setMarkOpen(false)
        }}
        title="Megrendelés jelölése"
        description="A rendelés ezután nem szerkeszthető. Megrendelted a beszállítónál (telefon / webshop / e-mail)?"
        confirmLabel="Megrendelés jelölése"
        cancelLabel="Mégse"
        variant="primary"
        loading={pending}
        onConfirm={handleMarkOrdered}
      />

      <ConfirmDialog
        open={closeIncompleteOpen}
        onOpenChange={(open) => {
          if (!open && !pending) setCloseIncompleteOpen(false)
        }}
        title="Rendelés lezárása hiányosan"
        description="A még hiányzó tételeket nem várod többet. A rendelés Beérkezett lesz — ez nem vonható vissza. Nyitott ellenőrzés alatt lévő beérkezés esetén előbb azt kell befejezni vagy törölni."
        confirmLabel="Lezárás hiányosan"
        cancelLabel="Mégse"
        variant="danger"
        loading={pending}
        onConfirm={() => {
          if (!initial) return
          startTransition(async () => {
            const result = await closePurchaseOrderIncomplete(initial.id)
            if (!result.ok) {
              toast.error(result.message)
              return
            }
            toast.success('Rendelés lezárva (hiányos).')
            setCloseIncompleteOpen(false)
            router.refresh()
          })
        }}
      />
    </div>
  )
}
