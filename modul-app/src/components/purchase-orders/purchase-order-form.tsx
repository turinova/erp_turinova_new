'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { ExternalLink, Mail, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { PurchaseOrderEmailDialog } from '@/components/purchase-orders/purchase-order-email-dialog'
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
  fetchAccessorySupplierSkusAction,
  fetchSupplierProcurementAidsAction,
  markPurchaseOrderOrdered,
  searchPurchaseLinearsAction,
  searchPurchaseProductsAction,
  searchPurchaseSheetsAction,
  updatePurchaseOrder
} from '@/lib/purchase-orders/actions'
import { openOrCreateGoodsReceipt } from '@/lib/goods-receipts/actions'
import {
  lineAmounts,
  linearUnitNetFromPerMeter,
  mergePurchaseOrderItems,
  PO_ORDER_KIND_LABEL,
  PO_STATUS_LABEL,
  poOrderKindTone,
  poStatusTone,
  sheetSquareMeters,
  sheetUnitNetFromPerSqm,
  sumOrderAmounts,
  type PurchaseOrderFormInput,
  type PurchaseOrderItemInput,
  type PurchaseOrderKind,
  type PurchaseOrderStatus
} from '@/lib/purchase-orders/parse'
import type { PurchaseOrderDetail } from '@/lib/purchase-orders/queries'
import type {
  PurchaseLinearSearchItem,
  PurchaseProductSearchItem,
  PurchaseSheetSearchItem
} from '@/lib/purchase-orders/queries'
import { buildSupplierProductUrl } from '@/lib/suppliers/order-channels'
import type { SupplierProcurementAids } from '@/lib/suppliers/queries'
import type { SupplierSelectOption } from '@/lib/suppliers/queries'
import { cn } from '@/lib/utils'

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
  /** Anyag (tábla+munkalap) PO — csak Lapszabászat add-onnal. */
  canOrderMaterial?: boolean
  suppliers: SupplierSelectOption[]
  warehouses: WarehouseOption[]
  receipts?: GoodsReceiptForPoRow[]
  /** Szerverről előtöltött beszállítói webshop/e-mail segéd. */
  initialProcurementAids?: SupplierProcurementAids | null
  initialSupplierSkus?: Record<string, string>
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
      orderKind: 'product',
      supplierId: '',
      warehouseId: defaultWarehouseId(warehouses),
      expectedDate: '',
      note: '',
      currency: 'HUF',
      items: []
    }
  }
  return {
    orderKind: initial.order_kind || 'product',
    supplierId: initial.supplier_id,
    warehouseId: initial.warehouse_id || defaultWarehouseId(warehouses),
    expectedDate: initial.expected_date ?? '',
    note: initial.note ?? '',
    currency: (initial.currency as 'HUF' | 'EUR' | 'USD') || 'HUF',
    items: initial.items.map((it): PurchaseOrderItemInput => {
      if (it.line_kind === 'sheet_material' && it.sheet_material_id) {
        return {
          lineKind: 'sheet_material',
          sheetMaterialId: it.sheet_material_id,
          nameSnapshot: it.name_snapshot,
          skuSnapshot: it.sku_snapshot,
          quantity: it.quantity,
          netPrice: it.net_price,
          taxRateId: it.tax_rate_id,
          taxRatePercent: it.tax_rate_percent,
          unitShortform: 'tábla',
          pricePerAreaNet: it.price_per_area_net,
          areaOrLengthFactor: it.area_or_length_factor
        }
      }
      if (it.line_kind === 'linear_material' && it.linear_material_id) {
        return {
          lineKind: 'linear_material',
          linearMaterialId: it.linear_material_id,
          nameSnapshot: it.name_snapshot,
          skuSnapshot: it.sku_snapshot,
          quantity: it.quantity,
          netPrice: it.net_price,
          taxRateId: it.tax_rate_id,
          taxRatePercent: it.tax_rate_percent,
          unitShortform: it.unit_shortform === 'fm' ? 'fm' : 'db',
          pricePerAreaNet: it.price_per_area_net,
          areaOrLengthFactor: it.area_or_length_factor
        }
      }
      return {
        lineKind: 'accessory',
        accessoryId: it.accessory_id!,
        nameSnapshot: it.name_snapshot,
        skuSnapshot: it.sku_snapshot,
        quantity: it.quantity,
        netPrice: it.net_price,
        taxRateId: it.tax_rate_id,
        taxRatePercent: it.tax_rate_percent,
        unitId: it.unit_id!,
        unitShortform: it.unit_shortform
      }
    })
  }
}

function productToItem(p: PurchaseProductSearchItem): PurchaseOrderItemInput {
  const net =
    p.purchase_price_net != null && p.purchase_price_net > 0
      ? p.purchase_price_net
      : p.price_net
  return {
    lineKind: 'accessory',
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

function sheetToItem(p: PurchaseSheetSearchItem): PurchaseOrderItemInput {
  const perSqm =
    p.purchase_price_net != null && p.purchase_price_net > 0
      ? p.purchase_price_net
      : p.price_net
  const area = sheetSquareMeters(p.length_mm, p.width_mm)
  const unitNet = sheetUnitNetFromPerSqm(p.length_mm, p.width_mm, perSqm)
  return {
    lineKind: 'sheet_material',
    sheetMaterialId: p.id,
    nameSnapshot: p.name,
    skuSnapshot: `${p.length_mm}×${p.width_mm}×${p.thickness_mm} · ${p.machine_code}`,
    quantity: 1,
    netPrice: unitNet,
    taxRateId: p.tax_rate_id,
    taxRatePercent: p.tax_rate_percent,
    unitShortform: 'tábla',
    pricePerAreaNet: Math.round(perSqm),
    areaOrLengthFactor: area
  }
}

function linearToItem(p: PurchaseLinearSearchItem): PurchaseOrderItemInput {
  const perM =
    p.purchase_price_net != null && p.purchase_price_net > 0
      ? p.purchase_price_net
      : p.price_net
  const stockUnit = p.stock_unit === 'fm' ? 'fm' : 'db'
  const unitNet =
    stockUnit === 'fm'
      ? Math.round(perM)
      : linearUnitNetFromPerMeter(p.length_mm, perM)
  return {
    lineKind: 'linear_material',
    linearMaterialId: p.id,
    nameSnapshot: p.name,
    skuSnapshot: `${p.material_type} · ${p.length_mm}×${p.width_mm}×${p.thickness_mm}`,
    quantity: 1,
    netPrice: unitNet,
    taxRateId: p.tax_rate_id,
    taxRatePercent: p.tax_rate_percent,
    unitShortform: stockUnit,
    pricePerAreaNet: Math.round(perM),
    areaOrLengthFactor: p.length_mm / 1000
  }
}

function itemRowKey(it: PurchaseOrderItemInput, index: number) {
  if (it.lineKind === 'accessory') return `a:${it.accessoryId}:${index}`
  if (it.lineKind === 'sheet_material')
    return `s:${it.sheetMaterialId}:${index}`
  return `l:${it.linearMaterialId}:${index}`
}

function itemHref(it: PurchaseOrderItemInput): string | null {
  if (it.lineKind === 'accessory')
    return `/torzsadatok/alapanyagok/termekek/${it.accessoryId}`
  if (it.lineKind === 'sheet_material')
    return `/torzsadatok/alapanyagok/tablas-anyagok/${it.sheetMaterialId}`
  if (it.lineKind === 'linear_material')
    return `/torzsadatok/alapanyagok/szalas-anyagok/${it.linearMaterialId}`
  return null
}

export function PurchaseOrderForm({
  mode,
  initial,
  canWrite,
  canOrderMaterial = false,
  suppliers,
  warehouses,
  receipts = [],
  initialProcurementAids = null,
  initialSupplierSkus = {}
}: PurchaseOrderFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<PurchaseOrderFormInput>(() => {
    const base = detailToForm(initial, warehouses)
    if (!canOrderMaterial && base.orderKind === 'material' && mode === 'create') {
      return { ...base, orderKind: 'product', items: [] }
    }
    return base
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [searchQ, setSearchQ] = useState('')
  const [searchHits, setSearchHits] = useState<PurchaseProductSearchItem[]>([])
  const [sheetHits, setSheetHits] = useState<PurchaseSheetSearchItem[]>([])
  const [linearHits, setLinearHits] = useState<PurchaseLinearSearchItem[]>([])
  const [materialTab, setMaterialTab] = useState<'sheet' | 'linear'>('sheet')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [markOpen, setMarkOpen] = useState(false)
  const [closeIncompleteOpen, setCloseIncompleteOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailSent, setEmailSent] = useState(Boolean(initial?.email_sent))
  const [procurementAids, setProcurementAids] =
    useState<SupplierProcurementAids | null>(initialProcurementAids)
  const [supplierSkus, setSupplierSkus] =
    useState<Record<string, string>>(initialSupplierSkus)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  const status: PurchaseOrderStatus = initial?.status ?? 'draft'
  const orderKind: PurchaseOrderKind = form.orderKind
  const kindLocked = mode === 'edit'
  const materialWriteOk = orderKind !== 'material' || canOrderMaterial
  const editable = canWrite && status === 'draft' && materialWriteOk
  const showKindPicker = canOrderMaterial || (kindLocked && orderKind === 'material')
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
    const supplierId = form.supplierId
    if (!supplierId) {
      setProcurementAids(null)
      return
    }
    let cancelled = false
    void (async () => {
      const result = await fetchSupplierProcurementAidsAction(supplierId)
      if (cancelled) return
      if (!result.ok) {
        setProcurementAids(null)
        return
      }
      setProcurementAids(result.aids)
    })()
    return () => {
      cancelled = true
    }
  }, [form.supplierId])

  useEffect(() => {
    const supplierId = form.supplierId
    if (!supplierId) {
      setSupplierSkus({})
      return
    }
    const accessoryIds = form.items
      .filter((it) => it.lineKind === 'accessory' && 'accessoryId' in it)
      .map((it) => (it as { accessoryId: string }).accessoryId)
    if (accessoryIds.length === 0) {
      setSupplierSkus({})
      return
    }
    let cancelled = false
    void (async () => {
      const skuRes = await fetchAccessorySupplierSkusAction(
        supplierId,
        accessoryIds
      )
      if (cancelled || !skuRes.ok) return
      setSupplierSkus(skuRes.map)
    })()
    return () => {
      cancelled = true
    }
  }, [form.supplierId, form.items])

  useEffect(() => {
    if (!editable) return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const q = searchQ.trim()
    if (q.length < 2) {
      setSearchHits([])
      setSheetHits([])
      setLinearHits([])
      setSearchOpen(false)
      return
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      if (orderKind === 'product') {
        const result = await searchPurchaseProductsAction(q)
        setSearching(false)
        if (!result.ok) {
          toast.error(result.message)
          return
        }
        setSearchHits(result.rows)
        setSearchOpen(true)
        return
      }
      if (materialTab === 'sheet') {
        const result = await searchPurchaseSheetsAction(q)
        setSearching(false)
        if (!result.ok) {
          toast.error(result.message)
          return
        }
        setSheetHits(result.rows)
        setSearchOpen(true)
        return
      }
      const result = await searchPurchaseLinearsAction(q)
      setSearching(false)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setLinearHits(result.rows)
      setSearchOpen(true)
    }, 280)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [searchQ, editable, orderKind, materialTab])

  function patch(p: Partial<PurchaseOrderFormInput>) {
    setForm((prev) => ({ ...prev, ...p }))
  }

  function addProduct(p: PurchaseProductSearchItem) {
    const next = mergePurchaseOrderItems([...form.items, productToItem(p)])
    patch({ items: next })
    setSearchQ('')
    setSearchHits([])
    setSearchOpen(false)
  }

  function addSheet(p: PurchaseSheetSearchItem) {
    const next = mergePurchaseOrderItems([...form.items, sheetToItem(p)])
    patch({ items: next })
    setSearchQ('')
    setSheetHits([])
    setSearchOpen(false)
  }

  function addLinear(p: PurchaseLinearSearchItem) {
    const next = mergePurchaseOrderItems([...form.items, linearToItem(p)])
    patch({ items: next })
    setSearchQ('')
    setLinearHits([])
    setSearchOpen(false)
  }

  function updateItem(index: number, patchItem: Partial<PurchaseOrderItemInput>) {
    const next = form.items.map((it, i) =>
      i === index ? ({ ...it, ...patchItem } as PurchaseOrderItemInput) : it
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
        items: mergePurchaseOrderItems(form.items)
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
          items: mergePurchaseOrderItems(form.items)
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
      toast.success('Elküldöttként megjelölve — a rendelés nem szerkeszthető.')
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
                <StatusBadge tone={poOrderKindTone(orderKind)}>
                  {PO_ORDER_KIND_LABEL[orderKind]}
                </StatusBadge>
                <StatusBadge tone={poStatusTone(status)}>
                  {PO_STATUS_LABEL[status]}
                </StatusBadge>
                {emailSent ? (
                  <StatusBadge tone="success">E-mail jelölve</StatusBadge>
                ) : null}
                {showReceive && receiveSummary ? (
                  <span className="text-hint text-ink-secondary tabular-nums">
                    {formatQty(receiveSummary.received_qty)} /{' '}
                    {formatQty(receiveSummary.ordered_qty)} ·{' '}
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
            {form.supplierId && form.items.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEmailOpen(true)}
              >
                <Mail className="size-3.5" aria-hidden />
                E-mail szöveg
              </Button>
            ) : null}
            {editable ? (
              <Button
                type="button"
                variant={
                  mode === 'edit' && status === 'draft' ? 'secondary' : 'primary'
                }
                loading={pending}
                onClick={handleSave}
              >
                {mode === 'edit' && status === 'draft'
                  ? 'Vázlat mentése'
                  : 'Rendelés mentése'}
              </Button>
            ) : null}
            {canWrite &&
            materialWriteOk &&
            status === 'draft' &&
            mode === 'edit' &&
            initial ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => setMarkOpen(true)}
                disabled={form.items.length === 0 || pending}
              >
                Elküldtem a beszállítónak
              </Button>
            ) : null}
            {canWrite &&
            materialWriteOk &&
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
            materialWriteOk &&
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

      <div
        className={cn(
          'w-full max-w-6xl space-y-2.5',
          orderKind === 'material' && 'border-l-[3px] border-l-info pl-3'
        )}
      >
        <FormSection title="Alapadatok" columns={4}>
          {showKindPicker ? (
            mode === 'create' || !kindLocked ? (
              <FormField
                label="Mit rendelünk?"
                htmlFor="po-kind"
                required
                error={fieldErrors.orderKind}
                className="sm:col-span-4"
                hint="Termék = pánt, csavar… · Anyag = táblás + munkalap együtt (Lapszabászat)."
              >
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={orderKind === 'product' ? 'primary' : 'secondary'}
                    disabled={!editable || (kindLocked && form.items.length > 0)}
                    onClick={() => {
                      if (form.items.length > 0 && orderKind !== 'product') {
                        toast.message('Töröld a tételeket a típusváltáshoz.')
                        return
                      }
                      patch({ orderKind: 'product', items: [] })
                    }}
                  >
                    Termékek
                  </Button>
                  <Button
                    type="button"
                    variant={orderKind === 'material' ? 'primary' : 'secondary'}
                    disabled={
                      !canOrderMaterial ||
                      !editable ||
                      (kindLocked && form.items.length > 0)
                    }
                    onClick={() => {
                      if (!canOrderMaterial) {
                        toast.message(
                          'Anyag rendeléshez Lapszabászat add-on kell.'
                        )
                        return
                      }
                      if (form.items.length > 0 && orderKind !== 'material') {
                        toast.message('Töröld a tételeket a típusváltáshoz.')
                        return
                      }
                      patch({ orderKind: 'material', items: [] })
                    }}
                  >
                    Anyagok (tábla + munkalap)
                  </Button>
                </div>
              </FormField>
            ) : (
              <div className="sm:col-span-4 space-y-1">
                <p className="text-body text-ink-secondary">
                  {orderKind === 'material'
                    ? 'Ezen a rendelésen táblás és szálas (munkalap) anyag.'
                    : 'Ezen a rendelésen csak termékek.'}
                </p>
                {orderKind === 'material' && !canOrderMaterial ? (
                  <p className="text-caption text-warning">
                    Anyag rendelés szerkesztéséhez / beérkezéséhez Lapszabászat
                    add-on kell.
                  </p>
                ) : null}
              </div>
            )
          ) : null}

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

        <FormSection
          title="Tételek"
          description={
            orderKind === 'material'
              ? 'Táblás és szálas/munkalap anyag — mennyiség táblában / db / fm.'
              : 'Csak termékek (SKU / név / vonalkód).'
          }
          columns={4}
        >
          <div className="col-span-full space-y-2.5">
            {fieldErrors.items ? (
              <p className="text-hint text-danger-ink" role="alert">
                {fieldErrors.items}
              </p>
            ) : null}

            {editable ? (
              <div ref={searchWrapRef} className="relative max-w-xl space-y-2">
                {orderKind === 'material' ? (
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={materialTab === 'sheet' ? 'primary' : 'secondary'}
                      onClick={() => {
                        setMaterialTab('sheet')
                        setSearchQ('')
                        setSearchOpen(false)
                      }}
                    >
                      Táblás
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        materialTab === 'linear' ? 'primary' : 'secondary'
                      }
                      onClick={() => {
                        setMaterialTab('linear')
                        setSearchQ('')
                        setSearchOpen(false)
                      }}
                    >
                      Szálas / munkalap
                    </Button>
                  </div>
                ) : null}
                <label className="sr-only" htmlFor="po-product-search">
                  {orderKind === 'material' ? 'Anyag keresése' : 'Termék keresése'}
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
                    aria-hidden
                  />
                  <Input
                    id="po-product-search"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    onFocus={() => {
                      if (
                        searchHits.length > 0 ||
                        sheetHits.length > 0 ||
                        linearHits.length > 0
                      ) {
                        setSearchOpen(true)
                      }
                    }}
                    placeholder={
                      orderKind === 'product'
                        ? 'Termék keresése (név, SKU, vonalkód)…'
                        : materialTab === 'sheet'
                          ? 'Táblás anyag keresése…'
                          : 'Szálas / munkalap keresése…'
                    }
                    className="pl-8"
                    autoComplete="off"
                  />
                </div>
                {searchOpen &&
                (searchHits.length > 0 ||
                  sheetHits.length > 0 ||
                  linearHits.length > 0 ||
                  searching) ? (
                  <ul
                    className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface shadow-md"
                    role="listbox"
                  >
                    {searching &&
                    searchHits.length === 0 &&
                    sheetHits.length === 0 &&
                    linearHits.length === 0 ? (
                      <li className="px-2.5 py-2 text-hint text-ink-secondary">
                        Keresés…
                      </li>
                    ) : null}
                    {orderKind === 'product'
                      ? searchHits.map((hit) => (
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
                        ))
                      : null}
                    {orderKind === 'material' && materialTab === 'sheet'
                      ? sheetHits.map((hit) => (
                          <li key={hit.id}>
                            <button
                              type="button"
                              className="flex w-full flex-col gap-0.5 px-2.5 py-2 text-left hover:bg-subtle"
                              onClick={() => addSheet(hit)}
                            >
                              <span className="text-body font-medium text-ink">
                                {hit.name}
                              </span>
                              <span className="text-hint text-ink-secondary">
                                {hit.manufacturer_name} · {hit.length_mm}×
                                {hit.width_mm}×{hit.thickness_mm} ·{' '}
                                {formatMoneyFt(
                                  hit.purchase_price_net ?? hit.price_net
                                )}{' '}
                                / m²
                              </span>
                            </button>
                          </li>
                        ))
                      : null}
                    {orderKind === 'material' && materialTab === 'linear'
                      ? linearHits.map((hit) => (
                          <li key={hit.id}>
                            <button
                              type="button"
                              className="flex w-full flex-col gap-0.5 px-2.5 py-2 text-left hover:bg-subtle"
                              onClick={() => addLinear(hit)}
                            >
                              <span className="text-body font-medium text-ink">
                                {hit.name}
                              </span>
                              <span className="text-hint text-ink-secondary">
                                {hit.manufacturer_name} · {hit.material_type} ·{' '}
                                {hit.length_mm} mm ·{' '}
                                {formatMoneyFt(
                                  hit.purchase_price_net ?? hit.price_net
                                )}{' '}
                                / m
                              </span>
                            </button>
                          </li>
                        ))
                      : null}
                    {!searching &&
                    searchHits.length === 0 &&
                    sheetHits.length === 0 &&
                    linearHits.length === 0 ? (
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
                  ? orderKind === 'material'
                    ? 'Adj hozzá táblás vagy szálas anyagot a keresővel.'
                    : 'Adj hozzá terméket a keresővel.'
                  : 'Nincs tétel.'}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[40rem] border-collapse text-body">
                  <thead>
                    <tr className="border-b border-border bg-subtle text-left text-label text-ink-secondary">
                      <th className="px-2.5 py-2 font-medium">
                        {orderKind === 'material' ? 'Anyag' : 'Termék'}
                      </th>
                      <th className="px-2.5 py-2 font-medium">Azonosító</th>
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
                      const href = itemHref(it)
                      const accessoryId =
                        it.lineKind === 'accessory' ? it.accessoryId : null
                      const shopUrl = procurementAids?.internetUrlTemplate
                        ? buildSupplierProductUrl({
                            urlTemplate: procurementAids.internetUrlTemplate,
                            sku: it.skuSnapshot,
                            supplierSku: accessoryId
                              ? supplierSkus[accessoryId]
                              : null,
                            name: it.nameSnapshot
                          })
                        : null
                      return (
                        <tr
                          key={itemRowKey(it, index)}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-2.5 py-2 font-medium text-ink">
                            {shopUrl ? (
                              <a
                                href={shopUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-info underline-offset-2 hover:underline"
                                title="Megnyitás a beszállító webshopjában"
                              >
                                {it.nameSnapshot}
                                <ExternalLink
                                  className="size-3 shrink-0"
                                  aria-hidden
                                />
                              </a>
                            ) : href ? (
                              <Link
                                href={href}
                                className="underline-offset-2 hover:underline"
                              >
                                {it.nameSnapshot}
                              </Link>
                            ) : (
                              it.nameSnapshot
                            )}
                            {shopUrl && href ? (
                              <p className="mt-0.5">
                                <Link
                                  href={href}
                                  className="text-hint text-ink-muted underline-offset-2 hover:underline"
                                >
                                  Törzsadat
                                </Link>
                              </p>
                            ) : null}
                            {it.lineKind === 'sheet_material' &&
                            it.areaOrLengthFactor != null &&
                            it.pricePerAreaNet != null ? (
                              <p className="mt-0.5 text-hint text-ink-muted">
                                {it.areaOrLengthFactor.toFixed(2)} m²/tábla ·{' '}
                                {formatMoneyFt(it.pricePerAreaNet)} / m²
                              </p>
                            ) : null}
                          </td>
                          <td className="px-2.5 py-2 text-ink-secondary">
                            {it.skuSnapshot}
                          </td>
                          <td className="px-2.5 py-2 text-right">
                            {editable ? (
                              <div className="inline-flex flex-col items-end gap-0.5">
                                <div className="inline-flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min={
                                      it.lineKind === 'sheet_material' ? 1 : 0.001
                                    }
                                    step={
                                      it.lineKind === 'sheet_material' ? 1 : 'any'
                                    }
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
                                {it.lineKind !== 'accessory' &&
                                it.unitShortform !== 'fm' &&
                                it.areaOrLengthFactor != null &&
                                it.areaOrLengthFactor > 0 ? (
                                  <span className="text-hint tabular-nums text-ink-muted">
                                    ≈{' '}
                                    {(
                                      it.quantity * it.areaOrLengthFactor
                                    ).toLocaleString('hu-HU', {
                                      maximumFractionDigits: 1
                                    })}{' '}
                                    {it.lineKind === 'sheet_material'
                                      ? 'm²'
                                      : 'm'}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="inline-flex flex-col items-end">
                                <span className="tabular-nums">
                                  {formatQty(it.quantity)} {it.unitShortform}
                                </span>
                                {it.lineKind !== 'accessory' &&
                                it.unitShortform !== 'fm' &&
                                it.areaOrLengthFactor != null &&
                                it.areaOrLengthFactor > 0 ? (
                                  <span className="text-hint tabular-nums text-ink-muted">
                                    ≈{' '}
                                    {(
                                      it.quantity * it.areaOrLengthFactor
                                    ).toLocaleString('hu-HU', {
                                      maximumFractionDigits: 1
                                    })}{' '}
                                    {it.lineKind === 'sheet_material'
                                      ? 'm²'
                                      : 'm'}
                                  </span>
                                ) : null}
                              </span>
                            )}
                          </td>
                          {showReceive ? (
                            <>
                              <td className="px-2.5 py-2 text-right tabular-nums font-medium">
                                <span className="inline-flex flex-col items-end">
                                  <span>
                                    {formatQty(received)} {it.unitShortform}
                                  </span>
                                  {it.lineKind !== 'accessory' &&
                                  it.unitShortform !== 'fm' &&
                                  it.areaOrLengthFactor != null &&
                                  it.areaOrLengthFactor > 0 &&
                                  received > 0 ? (
                                    <span className="text-hint font-normal text-ink-muted">
                                      ≈{' '}
                                      {(
                                        received * it.areaOrLengthFactor
                                      ).toLocaleString('hu-HU', {
                                        maximumFractionDigits: 1
                                      })}{' '}
                                      {it.lineKind === 'sheet_material'
                                        ? 'm²'
                                        : 'm'}
                                    </span>
                                  ) : null}
                                </span>
                              </td>
                              <td className="px-2.5 py-2 text-right tabular-nums text-ink-secondary">
                                <span className="inline-flex flex-col items-end">
                                  <span>
                                    {formatQty(remaining)} {it.unitShortform}
                                  </span>
                                  {it.lineKind !== 'accessory' &&
                                  it.unitShortform !== 'fm' &&
                                  it.areaOrLengthFactor != null &&
                                  it.areaOrLengthFactor > 0 &&
                                  remaining > 0 ? (
                                    <span className="text-hint text-ink-muted">
                                      ≈{' '}
                                      {(
                                        remaining * it.areaOrLengthFactor
                                      ).toLocaleString('hu-HU', {
                                        maximumFractionDigits: 1
                                      })}{' '}
                                      {it.lineKind === 'sheet_material'
                                        ? 'm²'
                                        : 'm'}
                                    </span>
                                  ) : null}
                                </span>
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
        title="Elküldted a beszállítónak?"
        description="Telefon / e-mail / webshop után jelöld elküldöttnek. Utána a tételek nem szerkeszthetők."
        confirmLabel="Igen, elküldve"
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

      <PurchaseOrderEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        poId={initial?.id ?? null}
        poNumber={initial?.po_number ?? null}
        supplierName={
          procurementAids?.name ??
          suppliers.find((s) => s.id === form.supplierId)?.name ??
          initial?.supplier_name ??
          'Beszállító'
        }
        supplierEmail={procurementAids?.email ?? null}
        introHtml={procurementAids?.emailPoIntroHtml ?? null}
        items={form.items.map((it) => ({
          name: it.nameSnapshot,
          sku: it.skuSnapshot,
          quantity: it.quantity,
          unit: it.unitShortform,
          lineKind: it.lineKind
        }))}
        canMarkSent={Boolean(initial?.id) && status !== 'cancelled'}
        onMarkedSent={() => {
          setEmailSent(true)
          router.refresh()
        }}
      />
    </div>
  )
}
