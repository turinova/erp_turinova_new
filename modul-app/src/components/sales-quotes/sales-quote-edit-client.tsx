'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { SaleAddFeeDialog } from '@/components/sales/sale-add-fee-dialog'
import { SaleTotalsBreakdown } from '@/components/sales/sale-totals-breakdown'
import {
  QuoteBillingFields,
  type QuoteBillingState
} from '@/components/sales-quotes/quote-billing-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { FeeTypeListItem } from '@/lib/fee-types/queries'
import { searchSaleProductsAction } from '@/lib/sales/actions'
import { isMaterialSaleKind } from '@/lib/sales/material-qty'
import { formatMoneyFt } from '@/lib/sales/parse'
import { computeSaleTotals } from '@/lib/sales/totals'
import {
  replaceSalesQuoteDraftLinesAction,
  updateSalesQuoteDraftAction
} from '@/lib/sales-quotes/actions'
import type {
  SalesQuoteDetail,
  SalesQuoteItemRow
} from '@/lib/sales-quotes/queries'
import type { SaleProductSearchItem } from '@/lib/sales/queries'

type Line = {
  key: string
  kind: 'product' | 'sheet_material' | 'linear_material'
  accessoryId: string | null
  sheetMaterialId: string | null
  linearMaterialId: string | null
  name: string
  sku: string
  unitShortform: string
  quantity: number
  unitPriceGross: number
  taxPercent: number
  discountPercentage: number
}

type FeeLine = {
  key: string
  feeTypeId: string | null
  name: string
  unitPriceGross: number
  taxRatePercent: number
}

type Props = {
  detail: SalesQuoteDetail
  feeTypes: FeeTypeListItem[]
  canWrite: boolean
  hasLapszabaszat?: boolean
}

function lineKey(it: {
  kind: string
  accessoryId: string | null
  sheetMaterialId: string | null
  linearMaterialId: string | null
}) {
  if (it.kind === 'sheet_material') return `sm:${it.sheetMaterialId}`
  if (it.kind === 'linear_material') return `lm:${it.linearMaterialId}`
  return `p:${it.accessoryId}`
}

function itemToLine(it: SalesQuoteItemRow): Line | null {
  if (it.item_kind === 'fee') return null
  const kind = it.item_kind
  return {
    key: lineKey({
      kind,
      accessoryId: it.accessory_id,
      sheetMaterialId: it.sheet_material_id,
      linearMaterialId: it.linear_material_id
    }),
    kind,
    accessoryId: it.accessory_id,
    sheetMaterialId: it.sheet_material_id,
    linearMaterialId: it.linear_material_id,
    name: it.name_snapshot,
    sku: it.sku_snapshot ?? '',
    unitShortform: it.unit_shortform,
    quantity: it.quantity,
    unitPriceGross: it.unit_price_gross,
    taxPercent: it.tax_rate_percent,
    discountPercentage: it.discount_percentage
  }
}

function catalogToLine(hit: SaleProductSearchItem): Line {
  const kind = hit.kind ?? 'product'
  const taxPct = Number(hit.tax_rate_percent ?? 0)
  const net = Number(hit.price_net ?? 0)
  const accessoryId = kind === 'product' ? hit.id : null
  const sheetMaterialId = kind === 'sheet_material' ? hit.id : null
  const linearMaterialId = kind === 'linear_material' ? hit.id : null
  return {
    key: lineKey({ kind, accessoryId, sheetMaterialId, linearMaterialId }),
    kind,
    accessoryId,
    sheetMaterialId,
    linearMaterialId,
    name: hit.name,
    sku: hit.sku,
    unitShortform: hit.unit_shortform,
    quantity: isMaterialSaleKind(kind) ? 1 : 1,
    unitPriceGross: Math.round(net * (1 + taxPct / 100)),
    taxPercent: taxPct,
    discountPercentage: 0
  }
}

export function SalesQuoteEditClient({
  detail,
  feeTypes,
  canWrite,
  hasLapszabaszat = false
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [lines, setLines] = useState<Line[]>(() =>
    detail.items
      .map(itemToLine)
      .filter((x): x is Line => Boolean(x))
  )
  const [fees, setFees] = useState<FeeLine[]>(() =>
    detail.items
      .filter((i) => i.item_kind === 'fee')
      .map((f, idx) => ({
        key: `fee-${f.id ?? idx}`,
        feeTypeId: f.fee_type_id,
        name: f.name_snapshot,
        unitPriceGross: f.unit_price_gross,
        taxRatePercent: f.tax_rate_percent
      }))
  )
  const [globalDiscPct, setGlobalDiscPct] = useState(
    detail.discount_percentage
  )
  const [note, setNote] = useState(detail.note ?? '')
  const [validUntil, setValidUntil] = useState(
    detail.valid_until?.slice(0, 10) ?? ''
  )
  const [billing, setBilling] = useState<QuoteBillingState>({
    billingName: detail.billing_name ?? '',
    billingCountry: detail.billing_country || 'Magyarország',
    billingCity: detail.billing_city ?? '',
    billingPostalCode: detail.billing_postal_code ?? '',
    billingStreet: detail.billing_street ?? '',
    billingHouseNumber: detail.billing_house_number ?? '',
    billingTaxNumber: detail.billing_tax_number ?? ''
  })
  const [searchQ, setSearchQ] = useState('')
  const [searchHits, setSearchHits] = useState<SaleProductSearchItem[]>([])
  const [searching, setSearching] = useState(false)
  const [feeOpen, setFeeOpen] = useState(false)

  const warehouseId = detail.warehouse_id
  const detailHref = `/ertekesitesek/arajanlatok/${detail.id}`

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
      void searchSaleProductsAction(q, warehouseId, {
        includeMaterials: hasLapszabaszat
      }).then((res) => {
        setSearching(false)
        setSearchHits(res.ok ? res.rows : [])
      })
    }, 180)
    return () => clearTimeout(t)
  }, [searchQ, warehouseId, hasLapszabaszat])

  function addHit(hit: SaleProductSearchItem) {
    const next = catalogToLine(hit)
    setLines((prev) => {
      const existing = prev.find((l) => l.key === next.key)
      if (existing) {
        return prev.map((l) =>
          l.key === next.key ? { ...l, quantity: l.quantity + 1 } : l
        )
      }
      return [...prev, next]
    })
    setSearchQ('')
    setSearchHits([])
  }

  function submit() {
    if (!canWrite) return
    if (lines.length === 0) {
      toast.error('Adj hozzá legalább egy terméket.')
      return
    }
    startTransition(async () => {
      const header = await updateSalesQuoteDraftAction({
        quoteId: detail.id,
        note: note || null,
        validUntil: validUntil || null,
        billing: {
          billingName: billing.billingName || null,
          billingCountry: billing.billingCountry || 'Magyarország',
          billingCity: billing.billingCity || null,
          billingPostalCode: billing.billingPostalCode || null,
          billingStreet: billing.billingStreet || null,
          billingHouseNumber: billing.billingHouseNumber || null,
          billingTaxNumber: billing.billingTaxNumber || null
        }
      })
      if (!header.ok) {
        toast.error(header.message)
        return
      }

      const linesResult = await replaceSalesQuoteDraftLinesAction({
        quoteId: detail.id,
        discountPercentage: globalDiscPct || 0,
        items: lines.map((l) => {
          if (l.kind === 'sheet_material') {
            return {
              kind: 'sheet_material' as const,
              accessoryId: null,
              sheetMaterialId: l.sheetMaterialId!,
              linearMaterialId: null,
              quantity: l.quantity,
              unitPriceGross: l.unitPriceGross,
              discountPercentage: l.discountPercentage || 0
            }
          }
          if (l.kind === 'linear_material') {
            return {
              kind: 'linear_material' as const,
              accessoryId: null,
              sheetMaterialId: null,
              linearMaterialId: l.linearMaterialId!,
              quantity: l.quantity,
              unitPriceGross: l.unitPriceGross,
              discountPercentage: l.discountPercentage || 0
            }
          }
          return {
            kind: 'product' as const,
            accessoryId: l.accessoryId!,
            sheetMaterialId: null,
            linearMaterialId: null,
            quantity: l.quantity,
            unitPriceGross: l.unitPriceGross,
            discountPercentage: l.discountPercentage || 0
          }
        }),
        fees: fees.map((f) => ({
          feeTypeId: f.feeTypeId,
          name: f.name,
          quantity: 1,
          unitPriceGross: Math.round(f.unitPriceGross),
          taxRatePercent: f.taxRatePercent
        }))
      })
      if (!linesResult.ok) {
        toast.error(linesResult.message)
        return
      }
      toast.success('Ajánlat mentve.')
      router.push(detailHref)
      router.refresh()
    })
  }

  if (!canWrite || detail.status !== 'draft') {
    return (
      <div className="space-y-3">
        <p className="text-body text-ink-secondary">
          Csak piszkozat szerkeszthető. Kiküldöttnél készíts Másolatot.
        </p>
        <Link
          href={detailHref}
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-body text-ink hover:bg-subtle"
        >
          Vissza az ajánlathoz
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Szerkesztés · ${detail.quote_number}`}
        description={`${detail.customer_name ?? 'Ügyfél'} · ${detail.warehouse_name}`}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-3">
          <FormSection title="Fejléc" columns={2}>
            <FormField label="Érvényes eddig" htmlFor="sqe-valid" optionalLabel>
              <Input
                id="sqe-valid"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </FormField>
            <div className="text-body text-ink-secondary">
              Ügyfél és raktár zárolva — változáshoz Másolat.
            </div>
          </FormSection>

          <FormSection title="Számlázási adatok" columns={2}>
            <div className="col-span-full">
              <QuoteBillingFields
                value={billing}
                onChange={setBilling}
                disabled={pending}
                idPrefix="sqe-bill"
              />
            </div>
          </FormSection>

          <FormSection title="Tételek" columns={4}>
            <div className="col-span-full space-y-2.5">
              <div className="relative max-w-xl">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
                  aria-hidden
                />
                <Input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Termék keresése…"
                  className="pl-8"
                  autoComplete="off"
                />
                {(searching || searchHits.length > 0) && searchQ.trim() ? (
                  <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface shadow-md">
                    {searchHits.map((hit) => (
                      <li key={`${hit.kind}-${hit.id}`}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-subtle"
                          onClick={() => addHit(hit)}
                        >
                          <span className="min-w-0">
                            <span className="block text-body font-medium text-ink">
                              {hit.name}
                            </span>
                            <span className="text-hint text-ink-secondary">
                              {hit.sku}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-hint">
                            {formatMoneyFt(
                              Math.round(
                                hit.price_net *
                                  (1 + hit.tax_rate_percent / 100)
                              )
                            )}{' '}
                            Ft
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

              {lines.length === 0 && fees.length === 0 ? (
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
                          Mennyiség
                        </th>
                        <th className="px-2.5 py-2 font-medium text-right">
                          Bruttó / eg.
                        </th>
                        <th className="px-2.5 py-2 font-medium text-right">
                          Kedv. %
                        </th>
                        <th className="px-2.5 py-2 font-medium text-right">
                          Összeg
                        </th>
                        <th className="w-[1%] px-2.5 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => {
                        const before = Math.round(
                          l.quantity * l.unitPriceGross
                        )
                        const disc = Math.round(
                          (before * (l.discountPercentage || 0)) / 100
                        )
                        const g = Math.max(0, before - disc)
                        return (
                          <tr
                            key={l.key}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-2.5 py-2">
                              <div className="font-medium text-ink">
                                {l.name}
                              </div>
                              <div className="text-hint text-ink-secondary">
                                {l.sku}
                              </div>
                            </td>
                            <td className="px-2.5 py-2 text-right">
                              <Input
                                type="number"
                                min={0.001}
                                step="any"
                                className="ml-auto h-8 w-20 text-right"
                                value={l.quantity}
                                onChange={(e) => {
                                  const n = Number(e.target.value)
                                  setLines((prev) =>
                                    prev.map((x) =>
                                      x.key === l.key
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
                            </td>
                            <td className="px-2.5 py-2 text-right tabular-nums">
                              <Input
                                type="number"
                                min={0}
                                className="ml-auto h-8 w-24 text-right"
                                value={l.unitPriceGross}
                                onChange={(e) => {
                                  const n = Number(e.target.value)
                                  setLines((prev) =>
                                    prev.map((x) =>
                                      x.key === l.key
                                        ? {
                                            ...x,
                                            unitPriceGross: Number.isFinite(n)
                                              ? Math.max(0, Math.round(n))
                                              : 0
                                          }
                                        : x
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
                                className="ml-auto h-8 w-16 text-right"
                                value={l.discountPercentage}
                                onChange={(e) => {
                                  const n = Number(e.target.value)
                                  setLines((prev) =>
                                    prev.map((x) =>
                                      x.key === l.key
                                        ? {
                                            ...x,
                                            discountPercentage: Number.isFinite(
                                              n
                                            )
                                              ? Math.min(100, Math.max(0, n))
                                              : 0
                                          }
                                        : x
                                    )
                                  )
                                }}
                              />
                            </td>
                            <td className="px-2.5 py-2 text-right font-medium tabular-nums">
                              {formatMoneyFt(g)}
                            </td>
                            <td className="px-2.5 py-2 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="size-8 p-0 text-danger-ink"
                                aria-label="Sor törlése"
                                onClick={() =>
                                  setLines((prev) =>
                                    prev.filter((x) => x.key !== l.key)
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
                        <tr
                          key={f.key}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-2.5 py-2">
                            <div className="font-medium text-ink">{f.name}</div>
                            <div className="text-hint text-ink-secondary">
                              Díj
                            </div>
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
                          <td className="px-2.5 py-2 text-right font-medium tabular-nums">
                            {formatMoneyFt(f.unitPriceGross)}
                          </td>
                          <td className="px-2.5 py-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 text-danger-ink"
                              onClick={() =>
                                setFees((prev) =>
                                  prev.filter((x) => x.key !== f.key)
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

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={feeTypes.length === 0}
                  onClick={() => setFeeOpen(true)}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Díj hozzáadása
                </Button>
                <FormField
                  label="Globál kedvezmény %"
                  htmlFor="sqe-disc"
                  optionalLabel
                  className="w-auto"
                >
                  <Input
                    id="sqe-disc"
                    type="number"
                    min={0}
                    max={100}
                    className="h-8 w-16"
                    value={globalDiscPct}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      setGlobalDiscPct(
                        Number.isFinite(n)
                          ? Math.min(100, Math.max(0, n))
                          : 0
                      )
                    }}
                  />
                </FormField>
              </div>
            </div>
          </FormSection>

          <FormSection title="Megjegyzés" columns={2}>
            <FormField
              label="Megjegyzés"
              htmlFor="sqe-note"
              optionalLabel
              className="sm:col-span-2"
            >
              <Textarea
                id="sqe-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                className="min-h-[4rem]"
              />
            </FormField>
          </FormSection>
        </div>

        <aside className="h-fit space-y-3 rounded-md border border-border bg-surface p-3.5 lg:sticky lg:top-3">
          <h2 className="text-h3 text-ink">Összesítő</h2>
          <SaleTotalsBreakdown totals={totals} />
          <Button
            type="button"
            className="w-full"
            loading={pending}
            disabled={lines.length === 0}
            onClick={submit}
          >
            Mentés
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={pending}
            onClick={() => router.push(detailHref)}
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
            {
              key: `fee-${Date.now()}`,
              feeTypeId: fee.feeTypeId,
              name: fee.name,
              unitPriceGross: fee.unitPriceGross,
              taxRatePercent: fee.taxRatePercent
            }
          ])
        }
      />
    </div>
  )
}
