'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Minus,
  Plus,
  Printer,
  ScanBarcode,
  XCircle
} from 'lucide-react'
import { toast } from 'sonner'

import { ProductLabelPrintDialog } from '@/components/labels/product-label-print-dialog'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { FormField } from '@/components/patterns/form-field'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import {
  addExtraReceiptItem,
  cancelGoodsReceipt,
  lookupAccessoryForReceipt,
  receiveGoodsReceipt,
  saveGoodsReceiptQuantities,
  updateGoodsReceiptWarehouse
} from '@/lib/goods-receipts/actions'
import {
  PO_STATUS_LABEL,
  poStatusTone,
  type PurchaseOrderStatus
} from '@/lib/purchase-orders/parse'
import {
  qtyVariance,
  RECEIPT_STATUS_LABEL,
  receiptStatusTone
} from '@/lib/goods-receipts/parse'
import type { AccessoryUnitOption } from '@/lib/accessories/queries'
import type { GoodsReceiptDetail, GoodsReceiptItemRow } from '@/lib/goods-receipts/queries'
import type { ProductLabelPayload } from '@/lib/labels/types'
import { cn } from '@/lib/utils'

type WarehouseOption = {
  id: string
  name: string
  code: string
  is_default: boolean
}

type LabelTarget = {
  payload: ProductLabelPayload
  amount: number
}

type GoodsReceiptDetailClientProps = {
  initial: GoodsReceiptDetail
  canWrite: boolean
  onHandByAccessory: Record<string, number>
  warehouses: WarehouseOption[]
  canPrintLabels?: boolean
  units?: AccessoryUnitOption[]
}

function toLabelPayload(it: GoodsReceiptItemRow): ProductLabelPayload {
  return {
    id: it.accessory_id,
    name: it.name_snapshot,
    sku: it.sku_snapshot,
    barcode: it.barcode,
    barcodeInternal: it.barcode_internal,
    priceGross: it.price_gross,
    unitShortform: it.unit_shortform
  }
}

type QtyMap = Record<string, number>

type ExtraCandidate = {
  id: string
  name: string
  sku: string
  code: string
}

type VarianceTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

function buildQtyMap(detail: GoodsReceiptDetail): QtyMap {
  const map: QtyMap = {}
  for (const it of detail.items) {
    map[it.id] = it.quantity_received
  }
  return map
}

function formatQty(n: number) {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

function varianceMeta(
  received: number,
  target: number,
  isExtra: boolean
): { tone: VarianceTone; label: string; rowClass: string; qtyClass: string } {
  if (isExtra) {
    return {
      tone: 'warning',
      label: received > 0 ? 'PO-n kívüli' : 'PO-n kívüli · 0',
      rowClass: 'bg-warning-soft/50',
      qtyClass: 'text-warning-ink'
    }
  }
  const v = qtyVariance(received, target)
  if (v === 'zero') {
    return {
      tone: 'neutral',
      label: 'Még nincs',
      rowClass: '',
      qtyClass: 'text-ink-muted'
    }
  }
  if (v === 'under') {
    return {
      tone: 'info',
      label: `Hiányzik ${formatQty(target - received)}`,
      rowClass: 'bg-info-soft/40',
      qtyClass: 'text-info-ink'
    }
  }
  if (v === 'over') {
    return {
      tone: 'warning',
      label: `Többlet +${formatQty(received - target)}`,
      rowClass: 'bg-warning-soft/50',
      qtyClass: 'text-warning-ink'
    }
  }
  return {
    tone: 'success',
    label: 'Pontos',
    rowClass: 'bg-success-soft/45',
    qtyClass: 'text-success-ink'
  }
}

type OutcomeBanner = {
  tone: 'success' | 'warning' | 'info' | 'neutral' | 'danger'
  title: string
  detail: string
  Icon: typeof CheckCircle2
}

function buildOutcome(
  status: GoodsReceiptDetail['status'],
  items: GoodsReceiptDetail['items'],
  qtys: QtyMap
): OutcomeBanner {
  const poLines = items.filter((it) => !it.is_extra)
  const extras = items.filter((it) => it.is_extra && (qtys[it.id] ?? 0) > 0)

  let exact = 0
  let under = 0
  let over = 0
  let zero = 0
  let receivedUnits = 0
  let targetUnits = 0

  for (const it of poLines) {
    const qty = qtys[it.id] ?? 0
    receivedUnits += qty
    targetUnits += it.target_quantity
    const v = qtyVariance(qty, it.target_quantity)
    if (v === 'ok') exact += 1
    else if (v === 'under') under += 1
    else if (v === 'over') over += 1
    else zero += 1
  }

  const counted = exact + under + over
  const parts: string[] = []
  if (exact > 0) parts.push(`${exact} pontos`)
  if (under > 0) parts.push(`${under} hiányos`)
  if (over > 0) parts.push(`${over} többlet`)
  if (extras.length > 0) parts.push(`${extras.length} PO-n kívüli`)
  if (zero > 0 && status === 'checking') parts.push(`${zero} még üres`)
  const breakdown =
    parts.length > 0
      ? parts.join(' · ')
      : 'Nincs tétel ezen a beérkezésen.'

  if (status === 'cancelled') {
    return {
      tone: 'danger',
      title: 'Beérkezés törölve',
      detail: 'Ez az ellenőrzés nem került bevételezésre — a készlet nem változott.',
      Icon: XCircle
    }
  }

  if (status === 'received') {
    if (over === 0 && extras.length === 0 && under === 0 && zero === 0 && exact > 0) {
      return {
        tone: 'success',
        title: 'Minden rendben — pontosan egyezik',
        detail: `${formatQty(receivedUnits)} db került a készletre. ${breakdown}.`,
        Icon: CheckCircle2
      }
    }
    if (over === 0 && extras.length === 0 && (under > 0 || zero > 0)) {
      return {
        tone: 'info',
        title: 'Bevételezve — részleges ezen a szállítmányon',
        detail: `${formatQty(receivedUnits)} / ${formatQty(targetUnits)} db. ${breakdown}.`,
        Icon: CircleDashed
      }
    }
    if (exact > 0 && over === 0 && extras.length === 0) {
      return {
        tone: 'success',
        title: 'Bevételezve',
        detail: `${formatQty(receivedUnits)} db a készleten. ${breakdown}.`,
        Icon: CheckCircle2
      }
    }
    return {
      tone: 'warning',
      title: 'Bevételezve — volt eltérés',
      detail: `${formatQty(receivedUnits)} db a készleten. ${breakdown}.`,
      Icon: AlertTriangle
    }
  }

  // checking
  if (counted === 0) {
    return {
      tone: 'neutral',
      title: 'Számolás indulhat',
      detail: `Cél: ${formatQty(targetUnits)} db · ${poLines.length} tétel. Scannelj vagy írd be a kapott mennyiségeket.`,
      Icon: CircleDashed
    }
  }
  if (over === 0 && extras.length === 0 && under === 0 && zero === 0) {
    return {
      tone: 'success',
      title: 'Minden sor egyezik — bevételezhető',
      detail: `${formatQty(receivedUnits)} db. ${breakdown}.`,
      Icon: CheckCircle2
    }
  }
  if (over > 0 || extras.length > 0) {
    return {
      tone: 'warning',
      title: 'Eltérés a rendeléshez képest',
      detail: `${counted}/${poLines.length} tétel kitöltve. ${breakdown}. Bevételezheted — a készlet a kapott qty-vel nő.`,
      Icon: AlertTriangle
    }
  }
  return {
    tone: 'info',
    title: 'Számolás folyamatban',
    detail: `${counted}/${poLines.length} tétel · ${formatQty(receivedUnits)} / ${formatQty(targetUnits)} db. ${breakdown}.`,
    Icon: CircleDashed
  }
}

const outcomeShell: Record<
  OutcomeBanner['tone'],
  string
> = {
  success: 'border-success/35 bg-success-soft text-success-ink',
  warning: 'border-warning/35 bg-warning-soft text-warning-ink',
  info: 'border-info/35 bg-info-soft text-info-ink',
  danger: 'border-danger/35 bg-danger-soft text-danger-ink',
  neutral: 'border-border bg-subtle text-ink-secondary'
}

export function GoodsReceiptDetailClient({
  initial,
  canWrite,
  onHandByAccessory,
  warehouses,
  canPrintLabels = false,
  units = []
}: GoodsReceiptDetailClientProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [qtys, setQtys] = useState<QtyMap>(() => buildQtyMap(initial))
  const [barcode, setBarcode] = useState('')
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [warehouseId, setWarehouseId] = useState(initial.warehouse_id)
  const [extraCandidate, setExtraCandidate] = useState<ExtraCandidate | null>(
    null
  )
  const [labelTarget, setLabelTarget] = useState<LabelTarget | null>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const checking = initial.status === 'checking'
  const editable = canWrite && checking
  const showLabelPrint =
    canPrintLabels && initial.status === 'received'
  const showWarehousePicker = editable && warehouses.length > 1
  const warehouseName =
    warehouses.find((w) => w.id === warehouseId)?.name ??
    initial.warehouse_name

  useEffect(() => {
    setQtys(buildQtyMap(initial))
    setWarehouseId(initial.warehouse_id)
  }, [initial])

  const linesWithQty = useMemo(
    () =>
      initial.items.filter((it) => (qtys[it.id] ?? 0) > 0).map((it) => ({
        ...it,
        qty: qtys[it.id] ?? 0
      })),
    [initial.items, qtys]
  )

  const totalReceived = linesWithQty.reduce((a, it) => a + it.qty, 0)
  const overageLines = linesWithQty.filter(
    (it) => !it.is_extra && it.qty > it.target_quantity
  )
  const extraLines = linesWithQty.filter((it) => it.is_extra)

  const outcome = useMemo(
    () => buildOutcome(initial.status, initial.items, qtys),
    [initial.status, initial.items, qtys]
  )
  const OutcomeIcon = outcome.Icon

  useEffect(() => {
    if (
      editable &&
      barcodeRef.current &&
      !receiveOpen &&
      !deleteOpen &&
      !extraCandidate
    ) {
      barcodeRef.current.focus()
    }
  }, [editable, receiveOpen, deleteOpen, extraCandidate])

  function scheduleSave(next: QtyMap) {
    if (!editable) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void saveGoodsReceiptQuantities(initial.id, {
        items: Object.entries(next).map(([id, quantityReceived]) => ({
          id,
          quantityReceived
        }))
      }).then((result) => {
        if (!result.ok) toast.error(result.message)
      })
    }, 500)
  }

  function setQty(itemId: string, value: number) {
    const safe = Math.max(0, Math.min(1_000_000, value))
    const next = { ...qtys, [itemId]: safe }
    setQtys(next)
    scheduleSave(next)
  }

  function bump(itemId: string, delta: number) {
    setQty(itemId, (qtys[itemId] ?? 0) + delta)
  }

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editable || pending) return
    const code = barcode.trim()
    if (!code) return

    const match = initial.items.find((it) => {
      return (
        it.sku_snapshot.toLowerCase() === code.toLowerCase() ||
        (it.barcode && it.barcode === code) ||
        (it.barcode_internal && it.barcode_internal === code)
      )
    })

    if (match) {
      bump(match.id, 1)
      toast.success(`+1 ${match.name_snapshot}`)
      setBarcode('')
      barcodeRef.current?.focus()
      return
    }

    startTransition(async () => {
      const result = await lookupAccessoryForReceipt(code)
      setBarcode('')
      if (!result.ok) {
        toast.error(result.message)
        barcodeRef.current?.focus()
        return
      }
      setExtraCandidate({
        id: result.accessory.id,
        name: result.accessory.name,
        sku: result.accessory.sku,
        code
      })
    })
  }

  function handleAddExtra() {
    if (!extraCandidate) return
    startTransition(async () => {
      const result = await addExtraReceiptItem({
        receiptId: initial.id,
        accessoryId: extraCandidate.id
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message ?? 'Tétel hozzáadva.')
      setExtraCandidate(null)
      router.refresh()
    })
  }

  function handleReceive() {
    startTransition(async () => {
      const saved = await saveGoodsReceiptQuantities(initial.id, {
        items: Object.entries(qtys).map(([id, quantityReceived]) => ({
          id,
          quantityReceived
        }))
      })
      if (!saved.ok) {
        toast.error(saved.message)
        setReceiveOpen(false)
        return
      }

      const result = await receiveGoodsReceipt(initial.id)
      if (!result.ok) {
        toast.error(result.message)
        setReceiveOpen(false)
        return
      }

      toast.success(result.message ?? 'Bevételezve.')
      setReceiveOpen(false)
      router.refresh()
    })
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelGoodsReceipt(initial.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Beérkezés törölve.')
      setDeleteOpen(false)
      router.push(`/beszallitoi-rendelesek/${initial.purchase_order_id}`)
      router.refresh()
    })
  }

  function handleWarehouseChange(nextId: string) {
    if (!editable || nextId === warehouseId || pending) return
    const prev = warehouseId
    setWarehouseId(nextId)
    startTransition(async () => {
      const result = await updateGoodsReceiptWarehouse(initial.id, nextId)
      if (!result.ok) {
        setWarehouseId(prev)
        toast.error(result.message)
        return
      }
      toast.success('Célraktár mentve.')
      router.refresh()
    })
  }

  return (
    <div className="pb-14">
      <PageHeader
        title={initial.receipt_number}
        description={`${initial.supplier_name} · ${warehouseName}`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={receiptStatusTone(initial.status)}>
              {RECEIPT_STATUS_LABEL[initial.status]}
            </StatusBadge>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                router.push(
                  `/beszallitoi-rendelesek/${initial.purchase_order_id}`
                )
              }
            >
              Vissza a rendeléshez
            </Button>
            {editable ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-danger-ink hover:text-danger-ink"
                  disabled={pending}
                  onClick={() => setDeleteOpen(true)}
                >
                  Törlés
                </Button>
                <Button
                  type="button"
                  disabled={pending || linesWithQty.length === 0}
                  onClick={() => setReceiveOpen(true)}
                >
                  Bevételezés
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-body text-ink-secondary">
        <span>
          Rendelés:{' '}
          <Link
            href={`/beszallitoi-rendelesek/${initial.purchase_order_id}`}
            className="font-medium text-ink underline-offset-2 hover:underline"
          >
            {initial.po_number}
          </Link>
        </span>
        <StatusBadge
          tone={poStatusTone(initial.po_status as PurchaseOrderStatus)}
        >
          {PO_STATUS_LABEL[initial.po_status as PurchaseOrderStatus] ??
            initial.po_status}
        </StatusBadge>
        <span className="text-ink-muted">·</span>
        {showWarehousePicker ? (
          <div className="min-w-[14rem]">
            <MenuSelect
              id="receipt-warehouse"
              value={warehouseId}
              allowEmpty={false}
              disabled={pending}
              searchable={warehouses.length > 8}
              options={warehouses.map((w) => ({
                value: w.id,
                label: `${w.name} (${w.code})${w.is_default ? ' · alap' : ''}`
              }))}
              onChange={handleWarehouseChange}
            />
          </div>
        ) : (
          <span>{warehouseName}</span>
        )}
        {initial.received_at ? (
          <>
            <span className="text-ink-muted">·</span>
            <span className="tabular-nums">
              {new Date(initial.received_at).toLocaleString('hu-HU')}
            </span>
          </>
        ) : null}
      </div>

      {showWarehousePicker ? (
        <p className="mb-3 text-hint text-ink-secondary">
          Célraktár — a bevételezés ide kerül. Változás azonnal mentődik.
        </p>
      ) : null}

      <div
        className={cn(
          'mb-3 flex gap-2.5 rounded-md border px-3 py-2.5',
          outcomeShell[outcome.tone]
        )}
        role="status"
      >
        <OutcomeIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="text-body font-semibold text-inherit">{outcome.title}</p>
          <p className="text-hint opacity-90">{outcome.detail}</p>
        </div>
      </div>

      {editable ? (
        <form className="mb-3 max-w-md" onSubmit={handleBarcodeSubmit}>
          <FormField
            label="Vonalkód / SKU"
            htmlFor="receipt-barcode"
            hint="Scanneld — ha nincs a listán, felajánljuk PO-n kívüliként."
          >
            <div className="relative">
              <ScanBarcode
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <Input
                ref={barcodeRef}
                id="receipt-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="pl-8"
                autoComplete="off"
                placeholder="Vonalkód…"
                disabled={pending}
              />
            </div>
          </FormField>
        </form>
      ) : null}

      <DataTable>
        <DataTableHead>
          <DataTableRow>
            <DataTableHeaderCell>Termék</DataTableHeaderCell>
            <DataTableHeaderCell align="right">Készleten</DataTableHeaderCell>
            <DataTableHeaderCell align="right">Cél</DataTableHeaderCell>
            <DataTableHeaderCell className="w-[180px] text-center">
              Kapott
            </DataTableHeaderCell>
            <DataTableHeaderCell>Állapot</DataTableHeaderCell>
            {showLabelPrint ? (
              <DataTableHeaderCell className="w-12 text-right">
                <span className="sr-only">Címke</span>
              </DataTableHeaderCell>
            ) : null}
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {initial.items.map((it) => {
            const qty = qtys[it.id] ?? 0
            const meta = varianceMeta(qty, it.target_quantity, it.is_extra)
            const onHand = onHandByAccessory[it.accessory_id]
            const canPrintLine = showLabelPrint && qty > 0
            return (
              <DataTableRow
                key={it.id}
                className={cn(meta.rowClass || 'bg-surface')}
              >
                <DataTableCell>
                  <div className="font-medium text-ink">
                    {it.name_snapshot}
                    {it.is_extra ? (
                      <StatusBadge tone="warning" className="ml-2 align-middle">
                        PO-n kívüli
                      </StatusBadge>
                    ) : null}
                  </div>
                  <div className="text-hint text-ink-secondary">
                    {it.sku_snapshot}
                    {it.unit_shortform ? ` · ${it.unit_shortform}` : ''}
                  </div>
                </DataTableCell>
                <DataTableCell align="right">
                  <span className="text-ink-secondary tabular-nums">
                    {onHand == null ? '—' : formatQty(onHand)}
                  </span>
                </DataTableCell>
                <DataTableCell align="right">
                  <span className="tabular-nums">
                    {it.is_extra ? '—' : formatQty(it.target_quantity)}
                  </span>
                </DataTableCell>
                <DataTableCell>
                  {editable ? (
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Csökkent"
                        disabled={qty <= 0 || pending}
                        onClick={() => bump(it.id, -1)}
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        className={cn(
                          'w-16 text-center font-semibold tabular-nums',
                          meta.qtyClass
                        )}
                        value={qty}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          setQty(it.id, Number.isFinite(n) ? n : 0)
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Növel"
                        disabled={pending}
                        onClick={() => bump(it.id, 1)}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'text-center text-body font-semibold tabular-nums',
                        meta.qtyClass
                      )}
                    >
                      {formatQty(qty)}
                    </div>
                  )}
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                </DataTableCell>
                {showLabelPrint ? (
                  <DataTableCell className="text-right">
                    {canPrintLine ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Címke: ${it.name_snapshot}`}
                        title="Címke nyomtatása"
                        onClick={() =>
                          setLabelTarget({
                            payload: toLabelPayload(it),
                            amount: Math.max(1, Math.round(qty))
                          })
                        }
                      >
                        <Printer className="size-3.5" aria-hidden />
                      </Button>
                    ) : null}
                  </DataTableCell>
                ) : null}
              </DataTableRow>
            )
          })}
        </DataTableBody>
      </DataTable>

      <ConfirmDialog
        open={receiveOpen}
        onOpenChange={(open) => {
          if (!pending) setReceiveOpen(open)
        }}
        title="Bevételezés"
        description={`${linesWithQty.length} tétel, összesen ${formatQty(totalReceived)} db kerül a készletre (${warehouseName}). Ez nem vonható vissza.`}
        confirmLabel="Bevételezés"
        variant="primary"
        loading={pending}
        onConfirm={handleReceive}
      >
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border bg-subtle px-3 py-2 text-body">
          {linesWithQty.map((it) => (
            <li key={it.id} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">
                {it.name_snapshot}
                {it.is_extra ? (
                  <span className="text-warning-ink"> · PO-n kívüli</span>
                ) : null}
                {!it.is_extra && it.qty > it.target_quantity ? (
                  <span className="text-warning-ink"> · több</span>
                ) : null}
              </span>
              <span className="shrink-0 tabular-nums font-medium">
                {formatQty(it.qty)}
              </span>
            </li>
          ))}
        </ul>
        {overageLines.length > 0 || extraLines.length > 0 ? (
          <p className="mt-2 text-hint text-warning-ink">
            {extraLines.length > 0
              ? `${extraLines.length} PO-n kívüli tétel. `
              : null}
            {overageLines.length > 0
              ? `${overageLines.length} sorban több érkezett a célnál.`
              : null}
          </p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(extraCandidate)}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setExtraCandidate(null)
            barcodeRef.current?.focus()
          }
        }}
        title="Nem volt a rendelésen"
        description={
          extraCandidate
            ? `„${extraCandidate.name}” (${extraCandidate.sku}) nincs ezen a beérkezésen. Hozzáadod PO-n kívüli tételként? A készlet a bevételezéskor nő.`
            : ''
        }
        confirmLabel="Hozzáadás PO-n kívül"
        cancelLabel="Mégsem"
        variant="primary"
        loading={pending}
        onConfirm={handleAddExtra}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!pending) setDeleteOpen(open)
        }}
        title="Beérkezés törlése"
        description={`Biztosan törlöd a(z) „${initial.receipt_number}” ellenőrzést? A számolás elveszik.`}
        confirmLabel="Törlés"
        loading={pending}
        onConfirm={handleCancel}
      />

      {canPrintLabels ? (
        <ProductLabelPrintDialog
          open={Boolean(labelTarget)}
          payload={labelTarget?.payload ?? null}
          units={units}
          initialAmount={labelTarget?.amount ?? 1}
          onClose={() => setLabelTarget(null)}
        />
      ) : null}
    </div>
  )
}
