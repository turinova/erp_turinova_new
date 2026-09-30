'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { PackageSearch, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { CustomerMenuSelect } from '@/components/customers/customer-menu-select'
import {
  CsoLineEditorRow,
  CsoLineListHeader,
  CsoTotalsFooter,
  csoHasPrice,
  csoLineGross,
  csoQtyByUnit,
  type CsoDraftLine
} from '@/components/customer-orders/cso-lines'
import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { grossFromNet } from '@/lib/accessories/parse'
import { createCustomerSpecialOrderAction } from '@/lib/customer-orders/actions'
import type { OptiCustomerOption } from '@/lib/customers/queries'
import { searchPurchaseProductsAction } from '@/lib/purchase-orders/actions'
import type { PurchaseProductSearchItem } from '@/lib/purchase-orders/queries'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { SupplierSelectOption } from '@/lib/suppliers/queries'
import type { UnitListItem } from '@/lib/units/queries'

type Props = {
  customers: OptiCustomerOption[]
  suppliers: SupplierSelectOption[]
  units: UnitListItem[]
  canWrite: boolean
  /** POS / deep-link: előretöltött tétel (pl. nincs készleten). */
  initialLines?: CsoDraftLine[]
}

function defaultUnitShortform(units: UnitListItem[]) {
  return (
    units.find((u) => u.shortform === 'db')?.shortform ??
    units[0]?.shortform ??
    'db'
  )
}

function unitGrossFromProduct(p: PurchaseProductSearchItem): number {
  return grossFromNet(Number(p.price_net) || 0, Number(p.tax_rate_percent) || 0)
}

function newLine(
  units: UnitListItem[],
  partial?: Partial<CsoDraftLine>
): CsoDraftLine {
  return {
    key: crypto.randomUUID(),
    name: '',
    sku: '',
    qty: 1,
    unitShortform: defaultUnitShortform(units),
    unitPriceGross: null,
    accessoryId: null,
    supplierId: null,
    note: '',
    ...partial
  }
}

export function CustomerOrderFormClient({
  customers,
  suppliers,
  units,
  canWrite,
  initialLines
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerMobile, setCustomerMobile] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [promisedDate, setPromisedDate] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<CsoDraftLine[]>(() =>
    initialLines?.length ? initialLines : []
  )

  const [searchQ, setSearchQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchHits, setSearchHits] = useState<PurchaseProductSearchItem[]>([])
  const [searching, setSearching] = useState(false)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const supplierOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        value: s.id,
        label: s.name
      })),
    [suppliers]
  )

  const unitOptions = useMemo(() => {
    const opts = units.map((u) => ({
      value: u.shortform,
      label: u.shortform,
      hint: u.name
    }))
    const known = new Set(opts.map((o) => o.value))
    for (const line of lines) {
      if (line.unitShortform && !known.has(line.unitShortform)) {
        opts.push({
          value: line.unitShortform,
          label: line.unitShortform,
          hint: 'Termék egység'
        })
        known.add(line.unitShortform)
      }
    }
    return opts
  }, [units, lines])

  const filledLines = useMemo(
    () => lines.filter((l) => l.name.trim().length > 0),
    [lines]
  )

  const totalGross = useMemo(
    () =>
      filledLines.reduce(
        (sum, l) => sum + csoLineGross(l.unitPriceGross, l.qty),
        0
      ),
    [filledLines]
  )

  const missingPriceCount = filledLines.filter(
    (l) => !csoHasPrice(l.unitPriceGross)
  ).length
  const missingSupplierCount = filledLines.filter(
    (l) => l.accessoryId && !l.supplierId
  ).length

  const depositNum = useMemo(() => {
    if (depositAmount.trim() === '') return null
    const n = Number(depositAmount.replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : null
  }, [depositAmount])

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
    if (!canWrite) return
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
  }, [searchQ, canWrite])

  function applyCustomer(id: string, c: OptiCustomerOption | null) {
    setCustomerId(id)
    if (!id || !c) return
    setCustomerName(c.name)
    setCustomerMobile(c.mobile ?? '')
  }

  function addCatalogProduct(p: PurchaseProductSearchItem) {
    const existing = lines.find((l) => l.accessoryId === p.id)
    if (existing) {
      toast.message(
        `Már a listán van — mennyiség: ${existing.qty + 1} ${existing.unitShortform}.`
      )
    }
    setLines((prev) => {
      const dupIdx = prev.findIndex((l) => l.accessoryId === p.id)
      if (dupIdx >= 0) {
        const next = [...prev]
        next[dupIdx] = { ...next[dupIdx], qty: next[dupIdx].qty + 1 }
        return next
      }
      const emptyIdx = prev.findIndex((l) => !l.name.trim() && !l.accessoryId)
      const row = newLine(units, {
        name: p.name,
        sku: p.sku || '',
        qty: 1,
        unitShortform: p.unit_shortform || defaultUnitShortform(units),
        unitPriceGross: unitGrossFromProduct(p),
        accessoryId: p.id,
        supplierId: p.primary_supplier_id
      })
      if (emptyIdx >= 0) {
        const next = [...prev]
        next[emptyIdx] = { ...row, key: prev[emptyIdx].key }
        return next
      }
      return [...prev, row]
    })
    setSearchQ('')
    setSearchHits([])
    setSearchOpen(false)
    searchInputRef.current?.focus()
  }

  function addBlankLine() {
    setLines((prev) => [...prev, newLine(units)])
  }

  function updateLine(key: string, patch: Partial<CsoDraftLine>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    )
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  function handleSave() {
    if (!canWrite) return
    startTransition(async () => {
      const result = await createCustomerSpecialOrderAction({
        customerId: customerId || null,
        customerName,
        customerMobile,
        depositAmount: depositNum,
        promisedDate: promisedDate || null,
        note: note || null,
        items: lines.map((l) => ({
          name: l.name,
          qty: l.qty,
          unitShortform: l.unitShortform || 'db',
          sku: l.sku || null,
          unitPriceGross: l.unitPriceGross,
          accessoryId: l.accessoryId,
          supplierId: l.supplierId,
          note: l.note || null
        }))
      })

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      setFieldErrors({})
      toast.success('Ügyfélrendelés mentve.')
      router.push(`/ugyfelrendelesek/${result.id}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Új ügyfélrendelés"
        description="Mit rendel, mennyit, bruttó ár — ezt kérdezi a vevő."
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/ugyfelrendelesek')}
            >
              Vissza a listához
            </Button>
            {canWrite ? (
              <Button type="button" loading={pending} onClick={handleSave}>
                Mentés
              </Button>
            ) : null}
          </div>
        }
      />

      {!canWrite ? (
        <p className="rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink-secondary">
          Nincs írási jogod.
        </p>
      ) : null}

      <FormSection title="Ügyfél" columns={4}>
        <FormField
          label="Meglévő ügyfél"
          htmlFor="cso-customer"
          optionalLabel
          className="sm:col-span-2"
        >
          <CustomerMenuSelect
            id="cso-customer"
            value={customerId}
            seed={customers}
            onChange={applyCustomer}
            allowEmpty
            emptyLabel="Új / szabad szöveg"
            disabled={!canWrite}
          />
        </FormField>
        <FormField
          label="Név"
          htmlFor="cso-name"
          required
          error={fieldErrors.customerName}
          className="sm:col-span-2"
        >
          <Input
            id="cso-name"
            value={customerName}
            disabled={!canWrite}
            onChange={(e) => setCustomerName(e.target.value)}
            autoComplete="name"
          />
        </FormField>
        <FormField
          label="Telefon"
          htmlFor="cso-mobile"
          required
          error={fieldErrors.customerMobile}
          className="sm:col-span-2"
        >
          <Input
            id="cso-mobile"
            value={customerMobile}
            disabled={!canWrite}
            onChange={(e) => setCustomerMobile(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
          />
        </FormField>
        <FormField
          label="Előleg (Ft)"
          htmlFor="cso-deposit"
          optionalLabel
          error={fieldErrors.depositAmount}
        >
          <Input
            id="cso-deposit"
            value={depositAmount}
            disabled={!canWrite}
            onChange={(e) => setDepositAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
        </FormField>
        <FormField
          label="Ígért nap"
          htmlFor="cso-promised"
          optionalLabel
          error={fieldErrors.promisedDate}
        >
          <Input
            id="cso-promised"
            type="date"
            value={promisedDate}
            disabled={!canWrite}
            onChange={(e) => setPromisedDate(e.target.value)}
          />
        </FormField>
        <FormField
          label="Megjegyzés"
          htmlFor="cso-note"
          optionalLabel
          error={fieldErrors.note}
          className="sm:col-span-4"
        >
          <Textarea
            id="cso-note"
            value={note}
            disabled={!canWrite}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[3.5rem]"
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Tételek"
        description="Keress a katalógusban, vagy adj hozzá szabad tételt. Minden ár bruttó."
        columns={4}
      >
        <div className="col-span-full space-y-2.5">
          {fieldErrors.items ? (
            <p className="text-body text-danger-ink" role="alert">
              {fieldErrors.items}
            </p>
          ) : null}

          {canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <div
                ref={searchWrapRef}
                className="relative min-w-[16rem] max-w-xl flex-1"
              >
                <label className="sr-only" htmlFor="cso-product-search">
                  Termék keresése
                </label>
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
                  aria-hidden
                />
                <Input
                  ref={searchInputRef}
                  id="cso-product-search"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onFocus={() => {
                    if (searchHits.length > 0) setSearchOpen(true)
                  }}
                  placeholder="Termék keresése (név, SKU)…"
                  className="pl-8"
                  autoComplete="off"
                />
                {searchOpen && (searchHits.length > 0 || searching) ? (
                  <ul
                    className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-surface shadow-elev2"
                    role="listbox"
                  >
                    {searching && searchHits.length === 0 ? (
                      <li className="px-2.5 py-2 text-body text-ink-secondary">
                        Keresés…
                      </li>
                    ) : null}
                    {searchHits.map((hit) => {
                      const gross = unitGrossFromProduct(hit)
                      const onList = lines.some((l) => l.accessoryId === hit.id)
                      return (
                        <li key={hit.id}>
                          <button
                            type="button"
                            className="flex w-full items-start justify-between gap-3 px-2.5 py-2 text-left hover:bg-subtle"
                            onClick={() => addCatalogProduct(hit)}
                          >
                            <span className="min-w-0">
                              <span className="block whitespace-normal break-words text-[14px] font-semibold leading-snug text-ink">
                                {hit.name}
                              </span>
                              <span className="block whitespace-normal break-all text-body text-ink-secondary">
                                <span className="font-mono">{hit.sku}</span>
                                {onList ? ' · már a listán (+1)' : null}
                              </span>
                            </span>
                            <span className="shrink-0 whitespace-nowrap pt-0.5 text-body font-semibold tabular-nums text-ink">
                              {formatMoneyFt(gross)} Ft
                              <span className="font-normal text-ink-secondary">
                                {' '}
                                / {hit.unit_shortform || 'db'}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
              <Button type="button" variant="secondary" onClick={addBlankLine}>
                <Plus className="size-3.5" aria-hidden />
                Szabad tétel hozzáadása
              </Button>
            </div>
          ) : null}

          <div className="overflow-visible rounded-md border border-border bg-surface">
            {lines.length === 0 ? (
              <div className="flex items-center gap-3 px-4 py-6 text-body text-ink-secondary">
                <PackageSearch
                  className="size-5 shrink-0 text-ink-muted"
                  aria-hidden
                />
                <p>
                  Még nincs tétel. Keress terméket fent, vagy adj hozzá szabad
                  tételt, ha nincs a katalógusban.
                </p>
              </div>
            ) : (
              <>
                <CsoLineListHeader />
                {lines.map((line, idx) => (
                  <CsoLineEditorRow
                    key={line.key}
                    index={idx}
                    line={line}
                    canWrite={canWrite}
                    supplierOptions={supplierOptions}
                    supplierSearchable={suppliers.length > 8}
                    unitOptions={unitOptions}
                    nameError={fieldErrors[`items.${idx}.name`]}
                    onChange={(patch) => updateLine(line.key, patch)}
                    onRemove={() => removeLine(line.key)}
                  />
                ))}
              </>
            )}

            <CsoTotalsFooter
              itemCount={filledLines.length}
              qtyByUnit={csoQtyByUnit(filledLines)}
              totalGross={totalGross}
              deposit={depositNum}
              missingPriceCount={missingPriceCount}
              missingSupplierCount={missingSupplierCount}
              alignWithEditor={lines.length > 0}
            />
          </div>
        </div>
      </FormSection>
    </div>
  )
}
