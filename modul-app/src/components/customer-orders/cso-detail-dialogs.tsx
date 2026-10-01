'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Lock, Search } from 'lucide-react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
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
import { MenuSelect, type MenuSelectOption } from '@/components/ui/menu-select'
import { Textarea } from '@/components/ui/textarea'
import { grossFromNet } from '@/lib/accessories/parse'
import {
  addSpecialOrderItemsAction,
  attachAccessoryToSpecialOrderItemAction,
  cancelSpecialOrderItemAction,
  updateSpecialOrderHeaderAction,
  updateSpecialOrderItemAction
} from '@/lib/customer-orders/actions'
import {
  CSO_STATUS_LABEL,
  csoItemEditRules,
  type CustomerSpecialOrderDetail,
  type CustomerSpecialOrderItemRow
} from '@/lib/customer-orders/types'
import { searchPurchaseProductsAction } from '@/lib/purchase-orders/actions'
import type { PurchaseProductSearchItem } from '@/lib/purchase-orders/queries'
import { formatMoneyFt } from '@/lib/sales/parse'

function parseMoney(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

function parseQty(raw: string): number | null {
  const n = Number(raw.trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

function unitGross(p: PurchaseProductSearchItem): number {
  return grossFromNet(Number(p.price_net) || 0, Number(p.tax_rate_percent) || 0)
}

function LockedHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-body text-ink-secondary">
      <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

// ---------------------------------------------------------------------------
// Termékkereső (katalógus)
// ---------------------------------------------------------------------------

export function CsoProductSearch({
  id,
  onPick,
  autoFocus = false
}: {
  id: string
  onPick: (p: PurchaseProductSearchItem) => void
  autoFocus?: boolean
}) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PurchaseProductSearchItem[]>([])
  const [searching, setSearching] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const term = q.trim()
    if (term.length < 2) {
      setHits([])
      return
    }
    timer.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchPurchaseProductsAction(term)
      setSearching(false)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      setHits(res.rows)
    }, 280)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [q])

  return (
    <div className="relative">
      <label className="sr-only" htmlFor={id}>
        Termék keresése
      </label>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
        aria-hidden
      />
      <Input
        id={id}
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Termék keresése (név, SKU)…"
        className="pl-8"
        autoComplete="off"
      />
      {q.trim().length >= 2 && (hits.length > 0 || searching) ? (
        <ul
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-surface shadow-elev2"
          role="listbox"
        >
          {searching && hits.length === 0 ? (
            <li className="px-2.5 py-2 text-body text-ink-secondary">
              Keresés…
            </li>
          ) : null}
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-2.5 py-2 text-left hover:bg-subtle"
                onClick={() => {
                  onPick(hit)
                  setQ('')
                  setHits([])
                }}
              >
                <span className="min-w-0">
                  <span className="block whitespace-normal break-words text-[14px] font-semibold leading-snug text-ink">
                    {hit.name}
                  </span>
                  <span className="block break-all font-mono text-body text-ink-secondary">
                    {hit.sku}
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap pt-0.5 text-body font-semibold tabular-nums text-ink">
                  {formatMoneyFt(unitGross(hit))} Ft
                  <span className="font-normal text-ink-secondary">
                    {' '}
                    / {hit.unit_shortform || 'db'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fejadatok szerkesztése
// ---------------------------------------------------------------------------

export function CsoHeaderEditDialog({
  open,
  onOpenChange,
  order
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: CustomerSpecialOrderDetail
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(order.customerName)
  const [mobile, setMobile] = useState(order.customerMobile)
  const [deposit, setDeposit] = useState('')
  const [promised, setPromised] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setName(order.customerName)
    setMobile(order.customerMobile)
    setDeposit(order.depositAmount != null ? String(order.depositAmount) : '')
    setPromised(order.promisedDate ?? '')
    setNote(order.note ?? '')
    setErrors({})
  }, [open, order])

  const mobileChanged = mobile.trim() !== order.customerMobile

  function save() {
    startTransition(async () => {
      const res = await updateSpecialOrderHeaderAction({
        orderId: order.id,
        customerName: name,
        customerMobile: mobile,
        depositAmount: parseMoney(deposit),
        promisedDate: promised || null,
        note: note || null
      })
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        toast.error(res.message)
        return
      }
      toast.success(res.message ?? 'Mentve.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3 pr-10">
          <DialogTitle>Rendelés adatai</DialogTitle>
          <DialogDescription className="mt-1">
            {order.orderNumber} — ügyfél, előleg, ígért nap.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
          <FormField
            label="Név"
            htmlFor="cso-h-name"
            required
            error={errors.customerName}
            className="sm:col-span-2"
          >
            <Input
              id="cso-h-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField
            label="Telefon"
            htmlFor="cso-h-mobile"
            required
            error={errors.customerMobile}
            className="sm:col-span-2"
          >
            <Input
              id="cso-h-mobile"
              value={mobile}
              inputMode="tel"
              onChange={(e) => setMobile(e.target.value)}
            />
          </FormField>
          {mobileChanged && order.smsSentAt ? (
            <p className="text-body text-warning-ink sm:col-span-2">
              Az értesítő SMS a régi számra ment ki — mentés után újraküldheted.
            </p>
          ) : null}
          <FormField
            label="Előleg (Ft)"
            htmlFor="cso-h-deposit"
            optionalLabel
            error={errors.depositAmount}
          >
            <Input
              id="cso-h-deposit"
              value={deposit}
              inputMode="decimal"
              placeholder="0"
              onChange={(e) => setDeposit(e.target.value)}
            />
          </FormField>
          <FormField
            label="Ígért nap"
            htmlFor="cso-h-promised"
            optionalLabel
            error={errors.promisedDate}
          >
            <Input
              id="cso-h-promised"
              type="date"
              value={promised}
              onChange={(e) => setPromised(e.target.value)}
            />
          </FormField>
          <FormField
            label="Megjegyzés"
            htmlFor="cso-h-note"
            optionalLabel
            error={errors.note}
            className="sm:col-span-2"
          >
            <Textarea
              id="cso-h-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[3.5rem]"
            />
          </FormField>
        </div>
        <DialogFooter className="border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button type="button" loading={pending} onClick={save}>
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Tétel szerkesztése (státusz-szabályok)
// ---------------------------------------------------------------------------

export function CsoItemEditDialog({
  open,
  onOpenChange,
  orderId,
  item,
  supplierOptions,
  supplierSearchable
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  item: CustomerSpecialOrderItemRow | null
  supplierOptions: MenuSelectOption[]
  supplierSearchable: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [note, setNote] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)

  useEffect(() => {
    if (!open || !item) return
    setName(item.name)
    setSku(item.sku ?? '')
    setQty(String(item.qty))
    setPrice(item.unitPriceGross != null ? String(item.unitPriceGross) : '')
    setSupplierId(item.supplierId ?? '')
    setNote(item.note ?? '')
  }, [open, item])

  if (!item) return null
  const current = item
  const rules = csoItemEditRules(current.status, current.poStatus)
  const isCatalog = Boolean(current.accessoryId)
  const canEditName = rules.name && !isCatalog

  function save() {
    const q = parseQty(qty)
    if (rules.qty && q == null) {
      toast.error('A mennyiség legyen nagyobb nullánál.')
      return
    }
    startTransition(async () => {
      const res = await updateSpecialOrderItemAction({
        orderId,
        itemId: current.id,
        patch: {
          ...(canEditName ? { name, sku: sku || null } : {}),
          ...(rules.qty && q != null ? { qty: q } : {}),
          ...(rules.price ? { unitPriceGross: parseMoney(price) } : {}),
          ...(rules.supplier ? { supplierId: supplierId || null } : {}),
          ...(rules.note ? { note: note || null } : {})
        }
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(res.message ?? 'Mentve.')
      onOpenChange(false)
      router.refresh()
    })
  }

  function attach(p: PurchaseProductSearchItem) {
    startTransition(async () => {
      const res = await attachAccessoryToSpecialOrderItemAction({
        orderId,
        itemId: current.id,
        accessoryId: p.id
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(res.message ?? 'Termék hozzárendelve.')
      onOpenChange(false)
      router.refresh()
    })
  }

  function doCancel() {
    startTransition(async () => {
      const res = await cancelSpecialOrderItemAction({
        orderId,
        itemId: current.id
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(res.message ?? 'Kész.')
      setConfirmCancel(false)
      onOpenChange(false)
      router.refresh()
    })
  }

  const cancelTexts =
    rules.cancel === 'release'
      ? {
          button: 'Foglalás feloldása',
          title: 'Feloldod a foglalást?',
          description:
            'A vevő nem viszi el a tételt. Az áru a polcon marad és szabadon eladható. A tétel „Törölve” lesz.'
        }
      : {
          button: 'Tétel lemondása',
          title: 'Lemondod a tételt?',
          description:
            current.status === 'rendelve'
              ? current.poStatus === 'draft'
                ? `A beszállítói rendelés vázlatából (${current.poNumber ?? 'PO'}) is kikerül.`
                : `A beszállítói rendelés (${current.poNumber ?? 'PO'}) már elment — ha megérkezik, az áru a polcra kerül.`
              : 'A tétel „Törölve” lesz. Később visszaállítható.'
        }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg gap-0 p-0">
          <DialogHeader className="border-b border-border px-4 py-3 pr-10">
            <DialogTitle>Tétel szerkesztése</DialogTitle>
            <DialogDescription className="mt-1">
              Státusz: {CSO_STATUS_LABEL[current.status]}
              {current.poNumber ? ` · ${current.poNumber}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[min(70vh,34rem)] space-y-3 overflow-y-auto px-4 py-3">
            {canEditName ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <FormField label="Név" htmlFor="cso-e-name" required>
                  <Input
                    id="cso-e-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </FormField>
                <FormField label="SKU" htmlFor="cso-e-sku" optionalLabel>
                  <Input
                    id="cso-e-sku"
                    value={sku}
                    className="font-mono"
                    onChange={(e) => setSku(e.target.value)}
                  />
                </FormField>
              </div>
            ) : (
              <div>
                <p className="whitespace-normal break-words text-[15px] font-semibold leading-snug text-ink">
                  {current.name}
                </p>
                <p className="break-all text-body text-ink-secondary">
                  <span className="font-mono">{current.sku || 'nincs SKU'}</span>
                  {isCatalog ? ' · Katalógus' : ' · Szabad tétel'}
                </p>
              </div>
            )}

            {!isCatalog && current.status === 'felveve' ? (
              <div className="space-y-1 rounded-md border border-border bg-subtle p-2.5">
                <p className="text-label text-ink">Katalógus termék hozzárendelése</p>
                <p className="text-body text-ink-secondary">
                  Beszállítói rendeléshez kell. A név, SKU, egység és a fő
                  beszállító is átjön.
                </p>
                <CsoProductSearch id="cso-e-attach" onPick={attach} />
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={`Mennyiség (${current.unitShortform})`} htmlFor="cso-e-qty">
                <Input
                  id="cso-e-qty"
                  value={qty}
                  inputMode="decimal"
                  disabled={!rules.qty}
                  className="tabular-nums"
                  onChange={(e) => setQty(e.target.value)}
                />
              </FormField>
              <FormField
                label={`Bruttó ár / ${current.unitShortform} (Ft)`}
                htmlFor="cso-e-price"
              >
                <Input
                  id="cso-e-price"
                  value={price}
                  inputMode="decimal"
                  disabled={!rules.price}
                  placeholder="amit a vevőnek mondasz"
                  className="tabular-nums"
                  onChange={(e) => setPrice(e.target.value)}
                />
              </FormField>
            </div>
            {rules.qtyLockedReason ? (
              <LockedHint>{rules.qtyLockedReason}</LockedHint>
            ) : current.status === 'rendelve' ? (
              <p className="text-body text-ink-secondary">
                A beszállítói rendelés még vázlat — a mennyiség ott is frissül.
              </p>
            ) : null}

            <FormField label="Beszállító" htmlFor="cso-e-supplier">
              {rules.supplier ? (
                <MenuSelect
                  id="cso-e-supplier"
                  value={supplierId}
                  onChange={setSupplierId}
                  allowEmpty
                  emptyLabel="Nincs beszállító"
                  searchable={supplierSearchable}
                  options={supplierOptions}
                  wrap
                />
              ) : (
                <p className="text-body text-ink">
                  {current.supplierName ?? '—'}
                </p>
              )}
            </FormField>
            {!rules.supplier ? (
              <LockedHint>
                Listára helyezés után a beszállító nem cserélhető — mondd le és
                vedd fel újra, ha kell.
              </LockedHint>
            ) : null}

            <FormField label="Megjegyzés" htmlFor="cso-e-note" optionalLabel>
              <Textarea
                id="cso-e-note"
                value={note}
                disabled={!rules.note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[3rem]"
              />
            </FormField>
          </div>

          <DialogFooter className="items-center border-t border-border px-4 py-3 sm:justify-between">
            {rules.cancel ? (
              <Button
                type="button"
                variant="ghost"
                className="text-danger-ink hover:text-danger-ink"
                disabled={pending}
                onClick={() => setConfirmCancel(true)}
              >
                {cancelTexts.button}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-1.5 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                Mégse
              </Button>
              <Button type="button" loading={pending} onClick={save}>
                Mentés
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={cancelTexts.title}
        description={cancelTexts.description}
        confirmLabel={cancelTexts.button}
        loading={pending}
        onConfirm={doCancel}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Új tétel hozzáadása
// ---------------------------------------------------------------------------

export function CsoAddItemDialog({
  open,
  onOpenChange,
  orderId,
  supplierOptions,
  supplierSearchable,
  unitOptions,
  defaultUnit
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  supplierOptions: MenuSelectOption[]
  supplierSearchable: boolean
  unitOptions: MenuSelectOption[]
  defaultUnit: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [accessoryId, setAccessoryId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState(defaultUnit)
  const [price, setPrice] = useState('')
  const [supplierId, setSupplierId] = useState('')

  useEffect(() => {
    if (!open) return
    setAccessoryId(null)
    setName('')
    setSku('')
    setQty('1')
    setUnit(defaultUnit)
    setPrice('')
    setSupplierId('')
  }, [open, defaultUnit])

  function pick(p: PurchaseProductSearchItem) {
    setAccessoryId(p.id)
    setName(p.name)
    setSku(p.sku || '')
    setUnit(p.unit_shortform || defaultUnit)
    const g = unitGross(p)
    setPrice(g > 0 ? String(g) : '')
    setSupplierId(p.primary_supplier_id ?? '')
  }

  function save() {
    const q = parseQty(qty)
    if (!name.trim()) {
      toast.error('Add meg a termék nevét.')
      return
    }
    if (q == null) {
      toast.error('A mennyiség legyen nagyobb nullánál.')
      return
    }
    startTransition(async () => {
      const res = await addSpecialOrderItemsAction({
        orderId,
        items: [
          {
            name: name.trim(),
            qty: q,
            unitShortform: unit || 'db',
            sku: sku || null,
            unitPriceGross: parseMoney(price),
            accessoryId,
            supplierId: supplierId || null,
            note: null
          }
        ]
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(res.message ?? 'Tétel hozzáadva.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3 pr-10">
          <DialogTitle>Tétel hozzáadása</DialogTitle>
          <DialogDescription className="mt-1">
            Keress a katalógusban, vagy írd be szabad tételként.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-4 py-3">
          <CsoProductSearch id="cso-add-search" onPick={pick} autoFocus />

          {accessoryId ? (
            <div className="flex items-start justify-between gap-2 rounded-md border border-border bg-subtle p-2.5">
              <div className="min-w-0">
                <p className="whitespace-normal break-words text-[14px] font-semibold leading-snug text-ink">
                  {name}
                </p>
                <p className="break-all text-body text-ink-secondary">
                  <span className="font-mono">{sku || 'nincs SKU'}</span> ·
                  Katalógus
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAccessoryId(null)
                  setName('')
                  setSku('')
                  setPrice('')
                  setSupplierId('')
                }}
              >
                Másik termék
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <FormField label="Név (szabad tétel)" htmlFor="cso-add-name">
                <Input
                  id="cso-add-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>
              <FormField label="SKU" htmlFor="cso-add-sku" optionalLabel>
                <Input
                  id="cso-add-sku"
                  value={sku}
                  className="font-mono"
                  onChange={(e) => setSku(e.target.value)}
                />
              </FormField>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[8rem_7rem_1fr]">
            <FormField label="Mennyiség" htmlFor="cso-add-qty">
              <Input
                id="cso-add-qty"
                value={qty}
                inputMode="decimal"
                className="tabular-nums"
                onChange={(e) => setQty(e.target.value)}
              />
            </FormField>
            <FormField label="Egység" htmlFor="cso-add-unit">
              {accessoryId ? (
                <p className="pt-1.5 text-body text-ink">{unit}</p>
              ) : (
                <MenuSelect
                  id="cso-add-unit"
                  value={unit}
                  onChange={(v) => v && setUnit(v)}
                  allowEmpty={false}
                  options={unitOptions}
                />
              )}
            </FormField>
            <FormField label="Bruttó ár / egység (Ft)" htmlFor="cso-add-price">
              <Input
                id="cso-add-price"
                value={price}
                inputMode="decimal"
                className="tabular-nums"
                onChange={(e) => setPrice(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Beszállító" htmlFor="cso-add-supplier" optionalLabel>
            <MenuSelect
              id="cso-add-supplier"
              value={supplierId}
              onChange={setSupplierId}
              allowEmpty
              emptyLabel="Nincs beszállító"
              searchable={supplierSearchable}
              options={supplierOptions}
              wrap
            />
          </FormField>
        </div>
        <DialogFooter className="border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button type="button" loading={pending} onClick={save}>
            Tétel hozzáadása
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
