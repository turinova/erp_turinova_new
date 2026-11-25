'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { ChevronDown, ChevronRight, PackageSearch, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { CustomerMenuSelect } from '@/components/customers/customer-menu-select'
import {
  CsoLineEditorRow,
  CsoLineListHeader,
  csoHasPrice,
  csoLineGross,
  type CsoDraftLine
} from '@/components/customer-orders/cso-lines'
import { FormActionBar } from '@/components/patterns/form-action-bar'
import { FormField } from '@/components/patterns/form-field'
import { PhoneInput } from '@/components/patterns/phone-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { grossFromNet } from '@/lib/accessories/parse'
import { fetchCsoProductSearch } from '@/lib/customer-orders/product-search-client'
import { formatPhoneNumber, HU_PHONE_EXAMPLE } from '@/lib/customers/parse'
import type { OptiCustomerOption } from '@/lib/customers/queries'
import { createManualOrderAction } from '@/lib/manual-orders/actions'
import { MO_DEPOSIT_METHOD_LABEL, type MoDepositMethod } from '@/lib/manual-orders/types'
import type { PurchaseProductSearchItem } from '@/lib/purchase-orders/queries'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { SupplierSelectOption } from '@/lib/suppliers/queries'
import type { UnitListItem } from '@/lib/units/queries'

type Props = {
  customers: OptiCustomerOption[]
  suppliers: SupplierSelectOption[]
  units: UnitListItem[]
  canWrite: boolean
}

function defaultUnit(units: UnitListItem[]) {
  return units.find((u) => u.shortform === 'db')?.shortform ?? units[0]?.shortform ?? 'db'
}

function newLine(units: UnitListItem[], partial?: Partial<CsoDraftLine>): CsoDraftLine {
  return {
    key: crypto.randomUUID(),
    name: '',
    sku: '',
    qty: 1,
    unitShortform: defaultUnit(units),
    unitPriceGross: null,
    accessoryId: null,
    supplierId: null,
    note: '',
    ...partial
  }
}

export function ManualOrderFormClient({ customers, suppliers, units, canWrite }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerMobile, setCustomerMobile] = useState('')
  const [showExtra, setShowExtra] = useState(false)
  const [note, setNote] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositMethod, setDepositMethod] = useState<MoDepositMethod>('keszpenz')
  const [lines, setLines] = useState<CsoDraftLine[]>([])
  const [focusLineKey, setFocusLineKey] = useState<string | null>(null)

  const [searchQ, setSearchQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchHits, setSearchHits] = useState<PurchaseProductSearchItem[]>([])
  const [searching, setSearching] = useState(false)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchSeq = useRef(0)

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.name })),
    [suppliers]
  )
  const unitOptions = useMemo(() => {
    const opts = units.map((u) => ({ value: u.shortform, label: u.shortform, hint: u.name }))
    const known = new Set(opts.map((o) => o.value))
    for (const l of lines) {
      if (l.unitShortform && !known.has(l.unitShortform)) {
        opts.push({ value: l.unitShortform, label: l.unitShortform, hint: 'Termék egység' })
        known.add(l.unitShortform)
      }
    }
    return opts
  }, [units, lines])

  const filled = useMemo(() => lines.filter((l) => l.name.trim()), [lines])
  const totalGross = filled.reduce((s, l) => s + csoLineGross(l.unitPriceGross, l.qty), 0)
  const missingSupplier = filled.filter((l) => !l.supplierId).length
  const missingPrice = filled.filter((l) => !csoHasPrice(l.unitPriceGross)).length
  const supplierCount = new Set(filled.map((l) => l.supplierId).filter(Boolean)).size
  const depositNum = (() => {
    const n = Number(depositAmount.replace(/\s/g, '').replace(',', '.'))
    return depositAmount.trim() && Number.isFinite(n) && n > 0 ? n : 0
  })()

  const blockers: string[] = []
  if (!customerName.trim()) blockers.push('nincs vevő')
  if (filled.length === 0) blockers.push('nincs tétel')
  if (missingSupplier) blockers.push(`${missingSupplier} tételnél nincs beszállító`)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    if (!canWrite) return
    const q = searchQ.trim()
    if (q.length < 2) {
      setSearchHits([])
      setSearching(false)
      return
    }
    const ac = new AbortController()
    const seq = ++searchSeq.current
    const t = setTimeout(async () => {
      setSearching(true)
      const res = await fetchCsoProductSearch(q, { signal: ac.signal })
      if (seq !== searchSeq.current || ac.signal.aborted) return
      setSearching(false)
      if (!res.ok) {
        if (res.message !== 'aborted') toast.error(res.message)
        return
      }
      setSearchHits(res.rows)
      setSearchOpen(true)
    }, 150)
    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [searchQ, canWrite])

  function lastSupplier() {
    return [...lines].reverse().find((l) => l.supplierId)?.supplierId ?? null
  }

  function addCatalog(p: PurchaseProductSearchItem) {
    setLines((prev) => {
      const dup = prev.findIndex((l) => l.accessoryId === p.id)
      if (dup >= 0) {
        const next = [...prev]
        next[dup] = { ...next[dup], qty: next[dup].qty + 1 }
        toast.message(`Már a listán van — mennyiség: ${next[dup].qty} ${next[dup].unitShortform}.`)
        return next
      }
      return [
        ...prev,
        newLine(units, {
          name: p.name,
          sku: p.sku || '',
          unitShortform: p.unit_shortform || defaultUnit(units),
          unitPriceGross: grossFromNet(Number(p.price_net) || 0, Number(p.tax_rate_percent) || 0),
          accessoryId: p.id,
          supplierId: p.primary_supplier_id ?? lastSupplier()
        })
      ]
    })
    resetSearch()
  }

  function addFree(name: string) {
    const row = newLine(units, { name: name.trim(), supplierId: lastSupplier() })
    setLines((prev) => [...prev, row])
    setFocusLineKey(row.key)
    resetSearch(false)
  }

  function resetSearch(refocus = true) {
    setSearchQ('')
    setSearchHits([])
    setSearchOpen(false)
    if (refocus) searchInputRef.current?.focus()
  }

  function applyCustomer(id: string, c: OptiCustomerOption | null) {
    setCustomerId(id)
    if (!id || !c) {
      setCustomerName('')
      setCustomerMobile('')
      return
    }
    setCustomerName(c.name)
    setCustomerMobile(formatPhoneNumber(c.mobile ?? ''))
  }

  function resetForm() {
    setCustomerId('')
    setCustomerName('')
    setCustomerMobile('')
    setNote('')
    setShowExtra(false)
    setDepositAmount('')
    setDepositMethod('keszpenz')
    setLines([])
    setFieldErrors({})
  }

  function save(alreadyOrdered: boolean) {
      if (!canWrite || pending) return
      startTransition(async () => {
        const res = await createManualOrderAction({
          customerId: customerId || null,
          customerName,
          customerMobile,
          note,
          depositAmount: depositNum || null,
          depositMethod,
          alreadyOrdered,
          items: filled.map((l) => ({
            name: l.name,
            qty: l.qty,
            unitShortform: l.unitShortform || 'db',
            sku: l.sku || null,
            unitPriceGross: l.unitPriceGross,
            accessoryId: l.accessoryId,
            supplierId: l.supplierId ?? '',
            note: l.note || null
          }))
        })
        if (!res.ok) {
          setFieldErrors(res.fieldErrors ?? {})
          toast.error(res.message)
          return
        }
        const id = res.id
        toast.success(`${res.orderNumber} mentve${alreadyOrdered ? ' — megrendelve' : ''}.`, {
          action: id
            ? { label: 'Megnyitás', onClick: () => router.push(`/kezi-rendelesek/${id}`) }
            : undefined
        })
        resetForm()
        router.refresh()
      })
  }

  const q = searchQ.trim()

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Link
          href="/kezi-rendelesek"
          className="inline-block text-body text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
        >
          ← Kézi rendelések
        </Link>
        <h1 className="text-h1 font-semibold text-ink">Új kézi rendelés</h1>
      </div>

      {!canWrite ? (
        <p className="rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink-secondary">
          Nincs írási jogod.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 space-y-3 lg:col-span-9">
          <section className="rounded-md border border-border bg-surface p-3.5">
            <h2 className="mb-2.5 text-h3 text-ink">Vevő</h2>
            <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
              <FormField
                label="Vevő keresése"
                htmlFor="mo-customer"
                hint={customerId ? undefined : 'Ha nincs a listában, add meg lent a nevét.'}
                className="sm:col-span-2"
              >
                <CustomerMenuSelect
                  id="mo-customer"
                  value={customerId}
                  seed={customers}
                  onChange={applyCustomer}
                  allowEmpty
                  emptyLabel="Új vevő"
                  placeholder="Név vagy telefonszám…"
                  disabled={!canWrite}
                />
              </FormField>
              {!customerId ? (
                <>
                  <FormField label="Név" htmlFor="mo-name" required error={fieldErrors.customerName}>
                    <Input
                      id="mo-name"
                      value={customerName}
                      disabled={!canWrite}
                      onChange={(e) => setCustomerName(e.target.value)}
                      autoComplete="name"
                    />
                  </FormField>
                  <FormField
                    label="Telefon"
                    htmlFor="mo-mobile"
                    optionalLabel
                    error={fieldErrors.customerMobile}
                    hint={fieldErrors.customerMobile ? undefined : `SMS-hez kell · pl. ${HU_PHONE_EXAMPLE}`}
                  >
                    <PhoneInput
                      id="mo-mobile"
                      value={customerMobile}
                      disabled={!canWrite}
                      onValueChange={setCustomerMobile}
                    />
                  </FormField>
                </>
              ) : (
                <p className="text-body text-ink-secondary sm:col-span-2">
                  <span className="font-medium text-ink">{customerName}</span>
                  {customerMobile ? ` · ${customerMobile}` : ' · nincs telefonszám (SMS nem küldhető)'}
                </p>
              )}
            </div>

            <button
              type="button"
              className="mt-2.5 inline-flex items-center gap-1 text-body text-ink-secondary hover:text-ink"
              onClick={() => setShowExtra((v) => !v)}
              aria-expanded={showExtra}
            >
              {showExtra ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
              Megjegyzés
            </button>
            {showExtra ? (
              <div className="mt-2.5">
                <FormField label="Megjegyzés" htmlFor="mo-note" optionalLabel>
                  <Textarea
                    id="mo-note"
                    value={note}
                    disabled={!canWrite}
                    onChange={(e) => setNote(e.target.value)}
                    className="min-h-[2.25rem]"
                  />
                </FormField>
              </div>
            ) : null}
          </section>
        </div>

        <div className="min-w-0 lg:col-span-12 lg:row-start-2">
          <section className="rounded-md border border-border bg-surface p-3.5">
            <div className="mb-2.5 flex items-baseline justify-between gap-2">
              <h2 className="text-h3 text-ink">Tételek</h2>
              <p className="text-hint text-ink-secondary">Minden ár bruttó. Beszállító minden tételnél kötelező.</p>
            </div>
            {fieldErrors.items ? (
              <p className="mb-2 text-body text-danger-ink" role="alert">{fieldErrors.items}</p>
            ) : null}

            {canWrite ? (
              <div ref={searchWrapRef} className="relative mb-2.5 max-w-2xl">
                <label className="sr-only" htmlFor="mo-search">Termék keresése vagy szabad tétel</label>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" aria-hidden />
                <Input
                  ref={searchInputRef}
                  id="mo-search"
                  value={searchQ}
                  onChange={(e) => {
                    setSearchQ(e.target.value)
                    setSearchOpen(true)
                  }}
                  onFocus={() => q.length >= 2 && setSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !q) return
                    e.preventDefault()
                    if (searchHits[0]) addCatalog(searchHits[0])
                    else if (!searching) addFree(q)
                  }}
                  placeholder="Termék neve, SKU vagy vonalkód — vagy írd be, amit kér"
                  className="pl-8"
                  autoComplete="off"
                />
                {searchOpen && q.length >= 2 ? (
                  <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-surface shadow-elev2" role="listbox">
                    {searching && searchHits.length === 0 ? (
                      <li className="px-2.5 py-2 text-body text-ink-secondary">Keresés…</li>
                    ) : null}
                    {searchHits.map((hit) => (
                      <li key={hit.id}>
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-3 px-2.5 py-2 text-left hover:bg-subtle"
                          onClick={() => addCatalog(hit)}
                        >
                          <span className="min-w-0">
                            <span className="block break-words text-[14px] font-semibold text-ink">{hit.name}</span>
                            <span className="block font-mono text-body text-ink-secondary">{hit.sku}</span>
                          </span>
                          <span className="shrink-0 pt-0.5 text-body font-semibold tabular-nums text-ink">
                            {formatMoneyFt(grossFromNet(Number(hit.price_net) || 0, Number(hit.tax_rate_percent) || 0))} Ft
                            <span className="font-normal text-ink-secondary"> / {hit.unit_shortform || 'db'}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                    <li className="border-t border-border">
                      <button
                        type="button"
                        className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-body text-ink hover:bg-subtle"
                        onClick={() => addFree(q)}
                      >
                        <Plus className="size-3.5" aria-hidden />
                        „{q}” hozzáadása szabad tételként
                      </button>
                    </li>
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="overflow-visible rounded-md border border-border bg-surface [container-type:inline-size]">
              {lines.length === 0 ? (
                <div className="flex items-center gap-3 px-4 py-6 text-body text-ink-secondary">
                  <PackageSearch className="size-5 shrink-0 text-ink-muted" aria-hidden />
                  <p>Még nincs tétel. Keress fent a katalógusban, vagy írd be, amit a vevő kér, és nyomj Entert.</p>
                </div>
              ) : (
                <>
                  <CsoLineListHeader />
                  <div className="divide-y divide-border">
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
                        supplierError={fieldErrors[`items.${idx}.supplierId`]}
                        requireSupplier
                        autoFocusName={focusLineKey === line.key}
                        onChange={(patch) =>
                          setLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, ...patch } : l)))
                        }
                        onRemove={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                        onEnterNext={idx === lines.length - 1 ? () => searchInputRef.current?.focus() : undefined}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        <aside className="lg:col-span-3 lg:col-start-10 lg:row-start-1">
          <div className="space-y-3">
            <section className="rounded-lg border border-border-strong bg-surface p-3 shadow-sm" aria-label="Összesítő">
              <h2 className="mb-2 text-h3 text-ink">Összesítő</h2>
              <dl className="space-y-1.5 text-body">
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-secondary">Vevő</dt>
                  <dd className="min-w-0 truncate text-right font-medium text-ink">{customerName.trim() || '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-secondary">Tételek</dt>
                  <dd className="tabular-nums text-ink">{filled.length}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-secondary">Beszállítók</dt>
                  <dd className="tabular-nums text-ink">{supplierCount}</dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-border pt-1.5">
                  <dt className="text-ink-secondary">Bruttó</dt>
                  <dd className="font-semibold tabular-nums text-ink">{formatMoneyFt(totalGross)} Ft</dd>
                </div>
              </dl>

              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                <FormField label="Előleg" htmlFor="mo-deposit" optionalLabel error={fieldErrors.depositAmount}>
                  <div className="flex gap-1.5">
                    <Input
                      id="mo-deposit"
                      inputMode="numeric"
                      value={depositAmount}
                      disabled={!canWrite}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0"
                      className="text-right tabular-nums"
                    />
                    <Select
                      aria-label="Előleg módja"
                      value={depositMethod}
                      disabled={!canWrite}
                      onChange={(e) => setDepositMethod(e.target.value as MoDepositMethod)}
                    >
                      {(Object.keys(MO_DEPOSIT_METHOD_LABEL) as MoDepositMethod[]).map((m) => (
                        <option key={m} value={m}>{MO_DEPOSIT_METHOD_LABEL[m]}</option>
                      ))}
                    </Select>
                  </div>
                </FormField>
                {depositNum > 0 ? (
                  <p className="flex justify-between text-body">
                    <span className="text-ink-secondary">Hátralék</span>
                    <span className="font-semibold tabular-nums text-ink">
                      {formatMoneyFt(Math.max(0, totalGross - depositNum))} Ft
                    </span>
                  </p>
                ) : null}
              </div>

              {missingSupplier || missingPrice ? (
                <ul className="mt-3 space-y-1 border-t border-border pt-3 text-body text-warning-ink">
                  {missingSupplier ? <li>⚠ {missingSupplier} tételnél nincs beszállító</li> : null}
                  {missingPrice ? <li>⚠ {missingPrice} tételnél nincs ár (menthető)</li> : null}
                </ul>
              ) : null}
            </section>
          </div>
        </aside>
      </div>

      {canWrite ? (
        <FormActionBar
          onSubmitShortcut={() => save(false)}
          summary={
            blockers.length > 0 ? (
              <span className="text-warning-ink">Hiányzik: {blockers.join(', ')}</span>
            ) : (
              <span>
                {filled.length} tétel ·{' '}
                <span className="font-semibold tabular-nums text-ink">{formatMoneyFt(totalGross)} Ft</span>
                {depositNum > 0 ? ` · előleg ${formatMoneyFt(depositNum)} Ft` : ''}
              </span>
            )
          }
        >
          <Button type="button" variant="secondary" disabled={pending} onClick={() => router.push('/kezi-rendelesek')}>
            Mégse
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => save(true)}>
            Mentés, már megrendeltem
          </Button>
          <Button type="button" loading={pending} onClick={() => save(false)}>
            Mentés
          </Button>
        </FormActionBar>
      ) : null}
    </div>
  )
}
