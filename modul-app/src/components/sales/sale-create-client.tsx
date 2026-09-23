'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Minus, Plus, Search, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { SaleAddFeeDialog } from '@/components/sales/sale-add-fee-dialog'
import {
  billingFromCustomer,
  billingHasAny,
  billingToFormInput,
  DocumentBillingFields,
  EMPTY_DOCUMENT_BILLING,
  type DocumentBillingState
} from '@/components/sales/document-billing-fields'
import { SaleQuickCustomerDialog } from '@/components/sales/sale-quick-customer-dialog'
import { SaleTotalsBreakdown } from '@/components/sales/sale-totals-breakdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Textarea } from '@/components/ui/textarea'
import type { OptiCustomerOption } from '@/lib/customers/queries'
import type { FeeTypeListItem } from '@/lib/fee-types/queries'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import {
  createSaleAction,
  searchSaleProductsAction
} from '@/lib/sales/actions'
import { isDeferredPaymentMethodName } from '@/lib/sales/payment-kind'
import type { SaleProductSearchItem } from '@/lib/sales/queries'
import { formatMoneyFt } from '@/lib/sales/parse'
import {
  computeSaleTotals,
  isCashPaymentMethodName
} from '@/lib/sales/totals'
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
  unitPriceGross: number
  taxPercent: number
  discountPercentage: number
  onHand: number | null
}

type FeeLine = {
  key: string
  feeTypeId: string
  name: string
  unitPriceGross: number
  taxRatePercent: number
}

type Props = {
  warehouses: WarehouseOption[]
  customers: OptiCustomerOption[]
  paymentMethods: PaymentMethodOption[]
  feeTypes: FeeTypeListItem[]
  canWrite: boolean
}

function formatOnHand(n: number) {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

export function SaleCreateClient({
  warehouses,
  customers: initialCustomers,
  paymentMethods,
  feeTypes,
  canWrite
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const defaultWh =
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? ''

  const [warehouseId, setWarehouseId] = useState(defaultWh)
  const [customers, setCustomers] = useState(initialCustomers)
  const [customerId, setCustomerId] = useState('')
  const [billing, setBilling] = useState<DocumentBillingState>(
    EMPTY_DOCUMENT_BILLING
  )
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false)
  const [feeDialogOpen, setFeeDialogOpen] = useState(false)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [fees, setFees] = useState<FeeLine[]>([])
  const [globalDiscPct, setGlobalDiscPct] = useState(0)
  const [paymentMethodId, setPaymentMethodId] = useState(
    paymentMethods[0]?.id ?? ''
  )
  const [splitPay, setSplitPay] = useState(false)
  const [pay2MethodId, setPay2MethodId] = useState('')
  const [pay2Amount, setPay2Amount] = useState(0)
  /** Utalás: áru átadva most → fulfilled+stock; default false = függőben. */
  const [fulfillNow, setFulfillNow] = useState(false)
  /** Billing panel + detailen bizonylat dialógus (nincs auto Agent a create-en). */
  const [wantBilling, setWantBilling] = useState(false)

  const [searchQ, setSearchQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchHits, setSearchHits] = useState<SaleProductSearchItem[]>([])
  const [inStockOnly, setInStockOnly] = useState(false)
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

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: c.name,
        hint: c.mobile ?? c.email ?? undefined
      })),
    [customers]
  )

  const paymentOptions = useMemo(
    () =>
      paymentMethods.map((p) => ({
        value: p.id,
        label: p.name
      })),
    [paymentMethods]
  )

  const pay1Name =
    paymentMethods.find((p) => p.id === paymentMethodId)?.name ?? ''
  const pay2Name =
    paymentMethods.find((p) => p.id === pay2MethodId)?.name ?? ''
  const pay1Deferred = isDeferredPaymentMethodName(pay1Name)
  const pay2Deferred = isDeferredPaymentMethodName(pay2Name)
  const isDeferred = !splitPay && pay1Deferred
  const applyCashRound = !splitPay && isCashPaymentMethodName(pay1Name)

  const totals = useMemo(
    () =>
      computeSaleTotals({
        lines: lines.map((l) => ({
          quantity: l.quantity,
          unitPriceGross: l.unitPriceGross,
          discountPercentage: l.discountPercentage,
          taxPercent: l.taxPercent
        })),
        fees: fees.map((f) => ({
          unitPriceGross: f.unitPriceGross,
          taxPercent: f.taxRatePercent
        })),
        globalDiscountPercent: globalDiscPct,
        applyCashRound
      }),
    [lines, fees, globalDiscPct, applyCashRound]
  )

  const pay1Amount = splitPay
    ? Math.max(0, totals.due - Math.round(pay2Amount || 0))
    : totals.due

  const overstockLines = lines.filter(
    (l) => l.onHand != null && l.quantity > l.onHand + 0.0001
  )

  useEffect(() => {
    if (isDeferred) setSplitPay(false)
  }, [isDeferred])

  /** Utalás = számlázási szándék — panel + ügyfél billing behúzás. */
  const wasDeferred = useRef(false)
  useEffect(() => {
    if (isDeferred && !wasDeferred.current) {
      setWantBilling(true)
      const c = customers.find((x) => x.id === customerId)
      if (c) setBilling(billingFromCustomer(c))
    }
    wasDeferred.current = isDeferred
  }, [isDeferred, customerId, customers])

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
    if (q.length < 1 || !warehouseId) {
      setSearchHits([])
      setSearching(false)
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(() => {
      void searchSaleProductsAction(q, warehouseId, inStockOnly).then((res) => {
        setSearching(false)
        if (res.ok) {
          setSearchHits(res.rows)
          setSearchOpen(true)
        } else setSearchHits([])
      })
    }, 220)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [searchQ, warehouseId, inStockOnly])

  useEffect(() => {
    if (!warehouseId || lines.length === 0) return
    let cancelled = false
    const accessoryIds = lines.map((l) => l.accessoryId)
    void (async () => {
      const { getTransferOnHandAction } = await import(
        '@/lib/stock-transfers/actions'
      )
      const next = await Promise.all(
        lines.map(async (line) => {
          const res = await getTransferOnHandAction(
            line.accessoryId,
            warehouseId
          )
          return { ...line, onHand: res.ok ? res.onHand : null }
        })
      )
      if (!cancelled) {
        setLines((prev) => {
          if (prev.map((p) => p.accessoryId).join() !== accessoryIds.join()) {
            return prev
          }
          return next.map((n, i) => ({
            ...prev[i]!,
            onHand: n.onHand
          }))
        })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, lines.map((l) => l.accessoryId).join('|')])

  function applyCustomer(id: string) {
    setCustomerId(id)
    const c = customers.find((x) => x.id === id)
    if (c) setBilling(billingFromCustomer(c))
    else setBilling(EMPTY_DOCUMENT_BILLING)
  }

  function addProduct(hit: SaleProductSearchItem) {
    setLines((prev) => {
      if (prev.some((l) => l.accessoryId === hit.id)) {
        toast.message('Ez a termék már a listán van.')
        return prev
      }
      const taxPct = Number(hit.tax_rate_percent ?? 0)
      const net = Number(hit.price_net ?? 0)
      const gross = Math.round(net * (1 + taxPct / 100))
      if (hit.on_hand <= 0) {
        toast.message('Nincs készleten — az eladás így is rögzíthető.')
      }
      return [
        ...prev,
        {
          accessoryId: hit.id,
          name: hit.name,
          sku: hit.sku,
          unitShortform: hit.unit_shortform,
          quantity: 1,
          unitPriceGross: gross,
          taxPercent: taxPct,
          discountPercentage: 0,
          onHand: hit.on_hand
        }
      ]
    })
    setSearchQ('')
    setSearchOpen(false)
    setSearchHits([])
  }

  function validate(): string | null {
    if (!warehouseId) return 'Válaszd ki a raktárat.'
    if (lines.length === 0) return 'Adj hozzá legalább egy terméket.'
    if (!paymentMethodId) return 'Válassz fizetési módot.'
    if (paymentMethods.length === 0) {
      return 'Nincs aktív fizetési mód. Vedd fel a Törzsadatoknál.'
    }
    for (const line of lines) {
      if (!(line.quantity > 0)) return `Adj meg mennyiséget: ${line.name}.`
    }
    if (splitPay) {
      if (pay1Deferred || pay2Deferred) {
        return 'Megosztott fizetésnél utalás most nem támogatott. Válassz készpénzt/kártyát, vagy rögzítsd utalással fizetetlenül.'
      }
      if (!pay2MethodId) return 'Válaszd ki a második fizetési módot.'
      if (pay2Amount <= 0) return 'A második fizetés legyen pozitív.'
      if (pay1Amount <= 0)
        return 'Az első fizetés összege nem lehet 0 vagy negatív.'
    }
    if (totals.due <= 0) return 'A végösszeg legyen pozitív.'
    if ((wantBilling || isDeferred) && !billingHasAny(billing)) {
      return 'Számlázási adat hiányzik — töltsd ki (adószám / név / cím), vagy válassz ügyfelet számlázási adatokkal.'
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
      const payments = isDeferred
        ? []
        : splitPay
          ? [
              { paymentMethodId, amount: pay1Amount },
              {
                paymentMethodId: pay2MethodId,
                amount: Math.round(pay2Amount)
              }
            ]
          : [{ paymentMethodId, amount: totals.due }]

      const result = await createSaleAction({
        warehouseId,
        customerId: customerId || null,
        channel: 'manual',
        note: note.trim() || null,
        discountPercentage: globalDiscPct || 0,
        discountAmount: 0,
        fulfillNow: isDeferred ? fulfillNow : false,
        billing:
          (isDeferred || wantBilling) && billingHasAny(billing)
            ? billingToFormInput(billing)
            : undefined,
        items: lines.map((l) => ({
          accessoryId: l.accessoryId,
          quantity: l.quantity,
          unitPriceGross: l.unitPriceGross,
          discountPercentage: l.discountPercentage || 0,
          discountAmount: 0
        })),
        fees: fees.map((f) => ({
          feeTypeId: f.feeTypeId,
          name: f.name.trim(),
          quantity: 1,
          unitPriceGross: Math.round(f.unitPriceGross),
          taxRatePercent: f.taxRatePercent
        })),
        payments
      })

      if (!result.ok) {
        setFormError(result.message)
        toast.error(result.message)
        setConfirmOpen(false)
        return
      }

      const deferredPending = isDeferred && !fulfillNow
      toast.success(
        result.saleNumber
          ? deferredPending
            ? `Rendelés rögzítve: ${result.saleNumber} (átadásra vár)`
            : `Eladás kész: ${result.saleNumber}${isDeferred ? ' (fizetetlen)' : ''}`
          : deferredPending
            ? 'Rendelés rögzítve (átadásra vár).'
            : isDeferred
              ? 'Eladás rögzítve (fizetetlen).'
              : 'Eladás rögzítve.'
      )

      // Utalás: mindig díjbekérő út (billing hiány → detail kitöltés). KP: csak ha kérték.
      const issueQ = isDeferred
        ? '?issue=proforma'
        : wantBilling && billingHasAny(billing)
          ? '?issue=normal'
          : ''

      router.push(`/ertekesitesek/${result.id}${issueQ}`)
      router.refresh()
    })
  }

  if (!canWrite) {
    return (
      <div className="space-y-3">
        <PageHeader title="Új értékesítés" />
        <p className="text-body text-ink-secondary">Nincs írási jogosultságod.</p>
      </div>
    )
  }

  if (warehouses.length === 0) {
    return (
      <div className="space-y-3">
        <PageHeader title="Új értékesítés" />
        <p className="text-body text-warning-ink">
          Nincs aktív raktár. Előbb hozz létre egyet.
        </p>
      </div>
    )
  }

  const hasCart = lines.length > 0 || fees.length > 0

  let confirmDesc = `${lines.length} termék · ${formatMoneyFt(totals.due)} Ft. A készlet azonnal csökken. Ez nem vonható vissza.`
  if (isDeferred && !fulfillNow) {
    confirmDesc = `${lines.length} termék · ${formatMoneyFt(totals.due)} Ft. Átadásra vár (utalás) — a készlet még NEM csökken. Rögzítés után díjbekérő következik.`
  } else if (isDeferred && fulfillNow) {
    confirmDesc = `${lines.length} termék · ${formatMoneyFt(totals.due)} Ft. Fizetetlen, de áru átadva — a készlet azonnal csökken. Rögzítés után díjbekérő.`
  } else if (wantBilling && billingHasAny(billing)) {
    confirmDesc = `${lines.length} termék · ${formatMoneyFt(totals.due)} Ft. A készlet csökken. Számlát a következő képernyőn állíthatod ki.`
  }
  if (overstockLines.length > 0 && (fulfillNow || !isDeferred)) {
    confirmDesc += ` Figyelem: ${overstockLines.length} tétel készlethiányos — a készlet negatívba mehet.`
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Új értékesítés"
        description="Kosár + fizetés. Számla / díjbekérő a rögzítés után, külön lépésben."
      />

      {formError ? (
        <p
          className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger-ink"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-3">
          <FormSection title="Fejléc" columns={3}>
            <FormField label="Raktár" htmlFor="sale-wh" required>
              {warehouses.length === 1 ? (
                <Input
                  id="sale-wh"
                  value={`${warehouses[0]!.name} (${warehouses[0]!.code})`}
                  disabled
                  readOnly
                />
              ) : (
                <MenuSelect
                  id="sale-wh"
                  value={warehouseId}
                  onChange={setWarehouseId}
                  allowEmpty={false}
                  options={warehouseOptions}
                />
              )}
            </FormField>
            <FormField label="Ügyfél" htmlFor="sale-customer" optionalLabel>
              <div className="flex gap-1.5">
                <div className="min-w-0 flex-1">
                  <MenuSelect
                    id="sale-customer"
                    value={customerId}
                    onChange={applyCustomer}
                    allowEmpty
                    emptyLabel="Vendég / nincs ügyfél"
                    searchable={customers.length > 8}
                    options={customerOptions}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="Új ügyfél"
                  onClick={() => setQuickCustomerOpen(true)}
                >
                  <UserPlus className="size-3.5" aria-hidden />
                </Button>
              </div>
            </FormField>
            <FormField label="Megjegyzés" htmlFor="sale-note" optionalLabel>
              <Textarea
                id="sale-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Opcionális…"
              />
            </FormField>
          </FormSection>

          {(wantBilling || isDeferred) ? (
            <FormSection
              title="Számlázás"
              description={
                isDeferred
                  ? 'Utalásnál kötelező. Adószám → automatikus cégadat. Rögzítés után díjbekérő.'
                  : 'Csak ezen az eladáson. Adószám → automatikus cégadat. A bizonylatot a rögzítés után állítod ki.'
              }
              columns={1}
            >
              <DocumentBillingFields
                value={billing}
                onChange={setBilling}
                disabled={pending}
                idPrefix="sale-bill"
                enableTaxpayerLookup
                hint="Kötelező díjbekérőhöz / számlához."
              />
            </FormSection>
          ) : null}

          <FormSection title="Tételek" columns={1}>
            <div ref={searchWrapRef} className="relative sm:col-span-full">
              <label className="sr-only" htmlFor="sale-product-search">
                Termék keresése
              </label>
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <Input
                id="sale-product-search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onFocus={() => {
                  if (searchHits.length > 0) setSearchOpen(true)
                }}
                placeholder="Termék (név, SKU, vonalkód)…"
                className="pl-8"
                autoComplete="off"
                autoFocus
              />
              {searchOpen && (searchHits.length > 0 || searching) ? (
                <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-surface shadow-md">
                  {searching && searchHits.length === 0 ? (
                    <li className="px-2.5 py-2 text-hint text-ink-secondary">
                      Keresés…
                    </li>
                  ) : null}
                  {searchHits.map((hit) => {
                    const zero = hit.on_hand <= 0
                    return (
                      <li key={hit.id}>
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-2 px-2.5 py-2 text-left hover:bg-subtle"
                          onClick={() => addProduct(hit)}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-body font-medium text-ink">
                              {hit.name}
                            </span>
                            <span className="text-hint text-ink-secondary">
                              {hit.sku} ·{' '}
                              {formatMoneyFt(
                                Math.round(
                                  hit.price_net *
                                    (1 + hit.tax_rate_percent / 100)
                                )
                              )}{' '}
                              Ft
                            </span>
                          </span>
                          <span
                            className={cn(
                              'shrink-0 tabular-nums text-hint',
                              zero ? 'text-warning-ink' : 'text-ink-secondary'
                            )}
                          >
                            {formatOnHand(hit.on_hand)} {hit.unit_shortform}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>

            <label className="flex items-center gap-2 text-hint text-ink-secondary sm:col-span-full">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="size-3.5"
              />
              Csak készleten
            </label>

            {!hasCart ? (
              <p className="rounded-md border border-dashed border-border bg-subtle p-4 text-body text-ink-secondary sm:col-span-full">
                Keress terméket, majd add a kosárhoz.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border sm:col-span-full">
                <table className="w-full min-w-[36rem] border-collapse text-body">
                  <thead>
                    <tr className="border-b border-border bg-subtle text-left text-label text-ink-secondary">
                      <th className="px-2.5 py-2 font-medium">Tétel</th>
                      <th className="px-2.5 py-2 font-medium text-right">
                        Készlet
                      </th>
                      <th className="px-2.5 py-2 font-medium text-right">
                        Qty
                      </th>
                      <th className="px-2.5 py-2 font-medium text-right">
                        Bruttó egységár
                      </th>
                      <th className="px-2.5 py-2 font-medium text-right">
                        Kedv%
                      </th>
                      <th className="px-2.5 py-2 font-medium text-right">
                        Bruttó összeg
                      </th>
                      <th className="w-10 px-2.5 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const over =
                        line.onHand != null &&
                        line.quantity > line.onHand + 0.0001
                      const before = Math.round(
                        line.quantity * line.unitPriceGross
                      )
                      const disc = Math.round(
                        (before * (line.discountPercentage || 0)) / 100
                      )
                      const g = Math.max(0, before - disc)
                      return (
                        <tr
                          key={line.accessoryId}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-2.5 py-2">
                            <div className="font-medium text-ink">
                              {line.name}
                            </div>
                            <div className="text-hint text-ink-secondary">
                              {line.sku}
                            </div>
                            {over ? (
                              <div className="text-hint text-warning-ink">
                                Készlethiány — eladás így is mehet
                              </div>
                            ) : null}
                          </td>
                          <td
                            className={cn(
                              'px-2.5 py-2 text-right tabular-nums',
                              over ? 'text-warning-ink' : 'text-ink-secondary'
                            )}
                          >
                            {line.onHand == null
                              ? '…'
                              : formatOnHand(line.onHand)}
                          </td>
                          <td className="px-2.5 py-2 text-right">
                            <div className="ml-auto flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                aria-label="Mennyiség csökkentése"
                                disabled={line.quantity <= 1}
                                onClick={() =>
                                  setLines((prev) =>
                                    prev.map((l) =>
                                      l.accessoryId === line.accessoryId
                                        ? {
                                            ...l,
                                            quantity: Math.max(
                                              1,
                                              l.quantity - 1
                                            )
                                          }
                                        : l
                                    )
                                  )
                                }
                              >
                                <Minus className="size-3.5" aria-hidden />
                              </Button>
                              <Input
                                type="number"
                                min={1}
                                step="any"
                                className={cn(
                                  'w-14 text-center tabular-nums',
                                  over && 'border-warning'
                                )}
                                value={line.quantity}
                                onChange={(e) => {
                                  const n = Number(e.target.value)
                                  setLines((prev) =>
                                    prev.map((l) =>
                                      l.accessoryId === line.accessoryId
                                        ? {
                                            ...l,
                                            quantity:
                                              Number.isFinite(n) && n > 0
                                                ? n
                                                : 1
                                          }
                                        : l
                                    )
                                  )
                                }}
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                aria-label="Mennyiség növelése"
                                onClick={() =>
                                  setLines((prev) =>
                                    prev.map((l) =>
                                      l.accessoryId === line.accessoryId
                                        ? { ...l, quantity: l.quantity + 1 }
                                        : l
                                    )
                                  )
                                }
                              >
                                <Plus className="size-3.5" aria-hidden />
                              </Button>
                            </div>
                          </td>
                          <td className="px-2.5 py-2 text-right">
                            <Input
                              type="number"
                              min={0}
                              className="ml-auto w-24 text-right tabular-nums"
                              value={line.unitPriceGross}
                              onChange={(e) => {
                                const n = Number(e.target.value)
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.accessoryId === line.accessoryId
                                      ? {
                                          ...l,
                                          unitPriceGross: Number.isFinite(n)
                                            ? n
                                            : 0
                                        }
                                      : l
                                  )
                                )
                              }}
                            />
                          </td>
                          <td className="px-2.5 py-2 text-right">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              className="ml-auto w-14 text-right tabular-nums"
                              value={line.discountPercentage}
                              onChange={(e) => {
                                const n = Number(e.target.value)
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.accessoryId === line.accessoryId
                                      ? {
                                          ...l,
                                          discountPercentage: Number.isFinite(n)
                                            ? Math.min(100, Math.max(0, n))
                                            : 0
                                        }
                                      : l
                                  )
                                )
                              }}
                            />
                          </td>
                          <td className="px-2.5 py-2 text-right font-semibold tabular-nums">
                            {formatMoneyFt(g)}
                          </td>
                          <td className="px-2.5 py-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label="Sor törlése"
                              onClick={() =>
                                setLines((prev) =>
                                  prev.filter(
                                    (l) => l.accessoryId !== line.accessoryId
                                  )
                                )
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                    {fees.map((fee) => (
                      <tr
                        key={fee.key}
                        className="border-b border-border last:border-0 bg-subtle/40"
                      >
                        <td className="px-2.5 py-2" colSpan={2}>
                          <div className="font-medium text-ink">{fee.name}</div>
                          <div className="text-hint text-ink-secondary">
                            Díj
                          </div>
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-ink-secondary">
                          1
                        </td>
                        <td className="px-2.5 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            className="ml-auto w-24 text-right tabular-nums"
                            value={fee.unitPriceGross}
                            onChange={(e) => {
                              const n = Number(e.target.value)
                              setFees((prev) =>
                                prev.map((f) =>
                                  f.key === fee.key
                                    ? {
                                        ...f,
                                        unitPriceGross: Number.isFinite(n)
                                          ? n
                                          : 0
                                      }
                                    : f
                                )
                              )
                            }}
                          />
                        </td>
                        <td className="px-2.5 py-2 text-right text-ink-muted">
                          —
                        </td>
                        <td className="px-2.5 py-2 text-right font-semibold tabular-nums">
                          {formatMoneyFt(Math.round(fee.unitPriceGross))}
                        </td>
                        <td className="px-2.5 py-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Díj törlése"
                            onClick={() =>
                              setFees((prev) =>
                                prev.filter((f) => f.key !== fee.key)
                              )
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="sm:col-span-full">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={feeTypes.length === 0}
                onClick={() => setFeeDialogOpen(true)}
              >
                <Plus className="size-3.5" aria-hidden />
                Díj
              </Button>
              {feeTypes.length === 0 ? (
                <p className="mt-1 text-hint text-ink-secondary">
                  Nincs aktív díjtípus — Törzsadatok → Díj típusok.
                </p>
              ) : null}
            </div>
          </FormSection>
        </div>

        <aside className="space-y-3 rounded-md border border-border bg-surface p-3 lg:sticky lg:top-3">
          <SaleTotalsBreakdown
            totals={totals}
            footerHint={
              overstockLines.length > 0
                ? `${overstockLines.length} tétel készlethiányos`
                : null
            }
          />

          <FormField label="Globál kedvezmény %" htmlFor="sale-global-disc">
            <Input
              id="sale-global-disc"
              type="number"
              min={0}
              max={100}
              className="tabular-nums"
              value={globalDiscPct}
              onChange={(e) => {
                const n = Number(e.target.value)
                setGlobalDiscPct(
                  Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
                )
              }}
            />
          </FormField>

          <FormField label="Fizetési mód" htmlFor="sale-pay">
            <MenuSelect
              id="sale-pay"
              value={paymentMethodId}
              onChange={setPaymentMethodId}
              allowEmpty={false}
              options={paymentOptions}
            />
          </FormField>

          {isDeferred ? (
            <div className="space-y-2">
              <p className="rounded-md border border-border bg-subtle px-2.5 py-2 text-hint text-ink-secondary">
                Utalás: az eladás{' '}
                <strong className="font-medium text-ink">fizetetlen</strong>{' '}
                marad. A készlet csak átadáskor csökken
                {fulfillNow ? ' (most átadod).' : '.'}
              </p>
              <label className="flex items-center gap-2 text-body text-ink">
                <input
                  type="checkbox"
                  checked={fulfillNow}
                  onChange={(e) => setFulfillNow(e.target.checked)}
                  className="size-3.5"
                />
                Áru átadva most
              </label>
            </div>
          ) : null}

          {!isDeferred ? (
            <label className="flex items-center gap-2 text-body text-ink">
              <input
                type="checkbox"
                checked={splitPay}
                onChange={(e) => setSplitPay(e.target.checked)}
                className="size-3.5"
              />
              Megosztott fizetés
            </label>
          ) : null}

          {splitPay && !isDeferred ? (
            <div className="space-y-2">
              <FormField label="2. fizetési mód" htmlFor="sale-pay2">
                <MenuSelect
                  id="sale-pay2"
                  value={pay2MethodId}
                  onChange={setPay2MethodId}
                  allowEmpty={false}
                  options={paymentOptions}
                />
              </FormField>
              <FormField label="2. összeg (Ft)" htmlFor="sale-pay2-amt">
                <Input
                  id="sale-pay2-amt"
                  type="number"
                  min={0}
                  className="tabular-nums"
                  value={pay2Amount}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setPay2Amount(Number.isFinite(n) ? n : 0)
                  }}
                />
              </FormField>
              <p className="text-hint text-ink-secondary">
                1.: {formatMoneyFt(pay1Amount)} Ft · 2.:{' '}
                {formatMoneyFt(Math.round(pay2Amount))} Ft
              </p>
            </div>
          ) : null}

          {isDeferred ? (
            <p className="rounded-md border border-border bg-subtle px-2.5 py-2 text-center text-hint text-ink-secondary">
              Utalás → számlázás kötelező · rögzítés után díjbekérő
            </p>
          ) : (
            <Button
              type="button"
              variant={wantBilling ? 'secondary' : 'ghost'}
              size="sm"
              className="w-full"
              aria-pressed={wantBilling}
              onClick={() => setWantBilling((v) => !v)}
            >
              {wantBilling ? 'Számlát kér · szerkeszt' : 'Számlát kér'}
            </Button>
          )}

          <Button
            type="button"
            className="w-full"
            onClick={openConfirm}
            disabled={pending}
          >
            {isDeferred && !fulfillNow
              ? 'Rendelés rögzítése'
              : 'Eladás rögzítése'}
          </Button>
        </aside>
      </div>

      <SaleAddFeeDialog
        open={feeDialogOpen}
        onOpenChange={setFeeDialogOpen}
        feeTypes={feeTypes}
        onAdd={(fee) =>
          setFees((prev) => [
            ...prev,
            {
              key: `fee-${Date.now()}`,
              ...fee
            }
          ])
        }
      />

      <SaleQuickCustomerDialog
        open={quickCustomerOpen}
        onOpenChange={setQuickCustomerOpen}
        onCreated={(c) => {
          const opt = {
            id: c.id,
            name: c.name,
            mobile: c.mobile,
            email: null as string | null,
            billing_name: null as string | null,
            billing_country: 'Magyarország',
            billing_city: null as string | null,
            billing_postal_code: null as string | null,
            billing_street: null as string | null,
            billing_house_number: null as string | null,
            billing_tax_number: null as string | null
          }
          setCustomers((prev) => {
            if (prev.some((x) => x.id === c.id)) return prev
            return [opt, ...prev]
          })
          applyCustomer(c.id)
          setBilling(billingFromCustomer({ ...opt, name: c.name }))
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!pending) setConfirmOpen(open)
        }}
        title={
          isDeferred && !fulfillNow
            ? 'Rendelés rögzítése'
            : 'Eladás rögzítése'
        }
        description={confirmDesc}
        confirmLabel={
          isDeferred && !fulfillNow
            ? 'Rendelés rögzítése'
            : 'Eladás rögzítése'
        }
        variant="primary"
        loading={pending}
        onConfirm={handleSubmit}
      />
    </div>
  )
}
