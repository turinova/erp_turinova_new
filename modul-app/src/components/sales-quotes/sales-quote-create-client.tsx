'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { Minus, Plus, Search, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { SaleAddFeeDialog } from '@/components/sales/sale-add-fee-dialog'
import { SaleQuickCustomerDialog } from '@/components/sales/sale-quick-customer-dialog'
import { SaleTotalsBreakdown } from '@/components/sales/sale-totals-breakdown'
import {
  EMPTY_QUOTE_BILLING,
  QuoteBillingFields,
  type QuoteBillingState
} from '@/components/sales-quotes/quote-billing-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import type { OptiCustomerOption } from '@/lib/customers/queries'
import type { FeeTypeListItem } from '@/lib/fee-types/queries'
import { searchSaleProductsAction } from '@/lib/sales/actions'
import { formatMoneyFt } from '@/lib/sales/parse'
import { computeSaleTotals } from '@/lib/sales/totals'
import { createSalesQuoteAction } from '@/lib/sales-quotes/actions'
import type { SaleProductSearchItem } from '@/lib/sales/queries'

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
  feeTypes: FeeTypeListItem[]
  canWrite: boolean
}

function productToLine(hit: SaleProductSearchItem): Line {
  const taxPct = Number(hit.tax_rate_percent ?? 0)
  const net = Number(hit.price_net ?? 0)
  return {
    accessoryId: hit.id,
    name: hit.name,
    sku: hit.sku,
    unitShortform: hit.unit_shortform,
    quantity: 1,
    unitPriceGross: Math.round(net * (1 + taxPct / 100)),
    taxPercent: taxPct,
    discountPercentage: 0,
    onHand: hit.on_hand
  }
}

export function SalesQuoteCreateClient({
  warehouses,
  customers: initialCustomers,
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
  const [billing, setBilling] = useState<QuoteBillingState>(EMPTY_QUOTE_BILLING)
  const [lines, setLines] = useState<Line[]>([])
  const [fees, setFees] = useState<FeeLine[]>([])
  const [globalDiscPct, setGlobalDiscPct] = useState(0)
  const [note, setNote] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchHits, setSearchHits] = useState<SaleProductSearchItem[]>([])
  const [searching, setSearching] = useState(false)
  const [feeOpen, setFeeOpen] = useState(false)
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false)

  function applyCustomerBilling(id: string) {
    const c = customers.find((x) => x.id === id)
    if (!c) {
      setBilling(EMPTY_QUOTE_BILLING)
      return
    }
    setBilling({
      billingName: c.billing_name || c.name || '',
      billingCountry: c.billing_country || 'Magyarország',
      billingCity: c.billing_city || '',
      billingPostalCode: c.billing_postal_code || '',
      billingStreet: c.billing_street || '',
      billingHouseNumber: c.billing_house_number || '',
      billingTaxNumber: c.billing_tax_number || ''
    })
  }

  function onCustomerChange(id: string) {
    setCustomerId(id)
    applyCustomerBilling(id)
  }

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
        applyCashRound: false
      }),
    [lines, fees, globalDiscPct]
  )

  useEffect(() => {
    const q = searchQ.trim()
    if (q.length < 1 || !warehouseId) {
      setSearchHits([])
      return
    }
    setSearching(true)
    const t = setTimeout(() => {
      void searchSaleProductsAction(q, warehouseId, false).then((res) => {
        setSearching(false)
        setSearchHits(res.ok ? res.rows : [])
      })
    }, 180)
    return () => clearTimeout(t)
  }, [searchQ, warehouseId])

  function addHit(hit: SaleProductSearchItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.accessoryId === hit.id)
      if (existing) {
        return prev.map((l) =>
          l.accessoryId === hit.id
            ? { ...l, quantity: l.quantity + 1, onHand: hit.on_hand }
            : l
        )
      }
      return [...prev, productToLine(hit)]
    })
    setSearchQ('')
    setSearchHits([])
  }

  function submit() {
    if (!canWrite) return
    if (!customerId) {
      toast.error('Válassz ügyfelet.')
      return
    }
    if (lines.length === 0) {
      toast.error('Adj hozzá legalább egy terméket.')
      return
    }
    startTransition(async () => {
      const result = await createSalesQuoteAction({
        warehouseId,
        customerId,
        note: note || null,
        validUntil: validUntil || null,
        discountPercentage: globalDiscPct || 0,
        billing: {
          billingName: billing.billingName || null,
          billingCountry: billing.billingCountry || 'Magyarország',
          billingCity: billing.billingCity || null,
          billingPostalCode: billing.billingPostalCode || null,
          billingStreet: billing.billingStreet || null,
          billingHouseNumber: billing.billingHouseNumber || null,
          billingTaxNumber: billing.billingTaxNumber || null
        },
        items: lines.map((l) => ({
          accessoryId: l.accessoryId,
          quantity: l.quantity,
          unitPriceGross: l.unitPriceGross,
          discountPercentage: l.discountPercentage || 0
        })),
        fees: fees.map((f) => ({
          feeTypeId: f.feeTypeId,
          name: f.name,
          quantity: 1,
          unitPriceGross: Math.round(f.unitPriceGross),
          taxRatePercent: f.taxRatePercent
        }))
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(
        result.quoteNumber
          ? `Árajánlat mentve: ${result.quoteNumber}`
          : 'Árajánlat mentve.'
      )
      router.push(`/ertekesitesek/arajanlatok/${result.id}`)
    })
  }

  if (!canWrite) {
    return (
      <p className="text-body text-ink-secondary">Nincs írási jogosultságod.</p>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Új árajánlat"
        description="Papír az ügyfélnek — készlet nem csökken."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="w-[12rem]">
              <FormField label="Raktár" htmlFor="sq-wh">
                <MenuSelect
                  id="sq-wh"
                  value={warehouseId}
                  onChange={setWarehouseId}
                  allowEmpty={false}
                  options={warehouses.map((w) => ({
                    value: w.id,
                    label: w.name,
                    hint: w.code
                  }))}
                />
              </FormField>
            </div>
            <div className="min-w-[14rem] flex-1">
              <FormField label="Ügyfél *" htmlFor="sq-customer">
                <div className="flex gap-1.5">
                  <div className="flex-1">
                    <MenuSelect
                      id="sq-customer"
                      value={customerId}
                      onChange={onCustomerChange}
                      allowEmpty
                      emptyLabel="Válassz ügyfelet…"
                      searchable={customers.length > 8}
                      options={customers.map((c) => ({
                        value: c.id,
                        label: c.name,
                        hint: c.mobile ?? c.email ?? undefined
                      }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setQuickCustomerOpen(true)}
                  >
                    <UserPlus className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </FormField>
            </div>
            <div className="w-[11rem]">
              <FormField label="Érvényes eddig" htmlFor="sq-valid">
                <Input
                  id="sq-valid"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </FormField>
            </div>
          </div>

          {customerId ? (
            <div className="rounded-md border border-border bg-surface p-3">
              <h3 className="mb-2 text-body font-semibold text-ink">
                Számlázási adatok
              </h3>
              <QuoteBillingFields
                value={billing}
                onChange={setBilling}
                disabled={pending}
                idPrefix="sq-bill"
              />
            </div>
          ) : null}

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Termék keresése…"
              className="pl-8"
            />
            {(searching || searchHits.length > 0) && searchQ.trim() ? (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface shadow-md">
                {searchHits.length === 0 ? (
                  <p className="p-3 text-hint text-ink-secondary">Keresés…</p>
                ) : (
                  searchHits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-body hover:bg-subtle"
                      onClick={() => addHit(hit)}
                    >
                      <span>
                        <span className="font-medium">{hit.name}</span>
                        <span className="ml-2 text-hint text-ink-secondary">
                          {hit.sku}
                        </span>
                      </span>
                      <span className="tabular-nums text-ink-secondary">
                        {formatMoneyFt(
                          Math.round(
                            hit.price_net * (1 + hit.tax_rate_percent / 100)
                          )
                        )}{' '}
                        Ft
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full border-collapse text-body">
              <thead>
                <tr className="border-b border-border bg-subtle text-left text-label text-ink-secondary">
                  <th className="px-2.5 py-2 font-medium">Tétel</th>
                  <th className="px-2.5 py-2 font-medium text-right">Qty</th>
                  <th className="px-2.5 py-2 font-medium text-right">
                    Bruttó egységár
                  </th>
                  <th className="px-2.5 py-2 font-medium text-right">Kedv%</th>
                  <th className="px-2.5 py-2 font-medium text-right">
                    Bruttó összeg
                  </th>
                  <th className="w-10 px-2.5 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && fees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-2.5 py-6 text-center text-ink-secondary"
                    >
                      Keress terméket, majd add a kosárhoz.
                    </td>
                  </tr>
                ) : null}
                {lines.map((l) => {
                  const before = Math.round(l.quantity * l.unitPriceGross)
                  const disc = Math.round(
                    (before * (l.discountPercentage || 0)) / 100
                  )
                  const g = Math.max(0, before - disc)
                  return (
                  <tr key={l.accessoryId} className="border-b border-border">
                    <td className="px-2.5 py-2">
                      <div className="font-medium text-ink">{l.name}</div>
                      <div className="text-hint text-ink-secondary">{l.sku}</div>
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="size-7 p-0"
                          aria-label="Mennyiség csökkentése"
                          onClick={() =>
                            setLines((prev) =>
                              prev
                                .map((x) =>
                                  x.accessoryId === l.accessoryId
                                    ? {
                                        ...x,
                                        quantity: Math.max(0.001, x.quantity - 1)
                                      }
                                    : x
                                )
                                .filter((x) => x.quantity > 0)
                            )
                          }
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Input
                          type="number"
                          className="h-7 w-14 text-center"
                          value={l.quantity}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            setLines((prev) =>
                              prev.map((x) =>
                                x.accessoryId === l.accessoryId
                                  ? {
                                      ...x,
                                      quantity: Number.isFinite(n)
                                        ? Math.max(0.001, n)
                                        : 1
                                    }
                                  : x
                              )
                            )
                          }}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="size-7 p-0"
                          aria-label="Mennyiség növelése"
                          onClick={() =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.accessoryId === l.accessoryId
                                  ? { ...x, quantity: x.quantity + 1 }
                                  : x
                              )
                            )
                          }
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums">
                      {formatMoneyFt(l.unitPriceGross)}
                    </td>
                    <td className="px-2.5 py-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="ml-auto h-7 w-14 text-center"
                        value={l.discountPercentage}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          setLines((prev) =>
                            prev.map((x) =>
                              x.accessoryId === l.accessoryId
                                ? {
                                    ...x,
                                    discountPercentage: Number.isFinite(n)
                                      ? Math.min(100, Math.max(0, n))
                                      : 0
                                  }
                                : x
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
                        className="size-7 p-0 text-danger-ink"
                        aria-label="Sor törlése"
                        onClick={() =>
                          setLines((prev) =>
                            prev.filter((x) => x.accessoryId !== l.accessoryId)
                          )
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                  )
                })}
                {fees.map((f) => (
                  <tr key={f.key} className="border-b border-border">
                    <td className="px-2.5 py-2">
                      <div className="font-medium text-ink">{f.name}</div>
                      <div className="text-hint text-ink-secondary">Díj</div>
                    </td>
                    <td className="px-2.5 py-2 text-right text-ink-secondary">
                      1
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums">
                      {formatMoneyFt(f.unitPriceGross)}
                    </td>
                    <td className="px-2.5 py-2 text-right text-ink-secondary">
                      —
                    </td>
                    <td className="px-2.5 py-2 text-right font-semibold tabular-nums">
                      {formatMoneyFt(f.unitPriceGross)}
                    </td>
                    <td className="px-2.5 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0 text-danger-ink"
                        aria-label="Sor törlése"
                        onClick={() =>
                          setFees((prev) => prev.filter((x) => x.key !== f.key))
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

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={feeTypes.length === 0}
              onClick={() => setFeeOpen(true)}
            >
              <Plus className="size-3.5" aria-hidden />
              Díj
            </Button>
            <div className="flex items-center gap-1.5">
              <span className="text-hint text-ink-secondary">
                Globál kedvezmény %
              </span>
              <Input
                type="number"
                min={0}
                max={100}
                className="h-8 w-16"
                value={globalDiscPct}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  setGlobalDiscPct(
                    Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
                  )
                }}
              />
            </div>
          </div>

          <FormField label="Megjegyzés" htmlFor="sq-note">
            <Input
              id="sq-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Feltételek, megjegyzés…"
            />
          </FormField>
        </div>

        <aside className="h-fit space-y-3 rounded-md border border-border bg-surface p-3 lg:sticky lg:top-3">
          <SaleTotalsBreakdown totals={totals} />
          <p className="text-hint text-ink-secondary">
            Nincs készletmozgás — csak papír.
          </p>
          <Button
            type="button"
            className="w-full"
            loading={pending}
            disabled={lines.length === 0 || !customerId}
            onClick={submit}
          >
            Ajánlat mentése
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={pending}
            onClick={() => router.push('/ertekesitesek/arajanlatok')}
          >
            Mégse
          </Button>
        </aside>
      </div>

      <SaleAddFeeDialog
        open={feeOpen}
        onOpenChange={setFeeOpen}
        feeTypes={feeTypes}
        onAdd={(fee) =>
          setFees((prev) => [
            ...prev,
            { key: `fee-${Date.now()}`, ...fee }
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
          setCustomerId(c.id)
          setBilling({
            billingName: c.name || '',
            billingCountry: 'Magyarország',
            billingCity: '',
            billingPostalCode: '',
            billingStreet: '',
            billingHouseNumber: '',
            billingTaxNumber: ''
          })
        }}
      />
    </div>
  )
}
