'use client'

import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react'
import {
  ChevronDown,
  LogOut,
  Minus,
  Percent,
  Plus,
  Search,
  Trash2,
  User,
  UserPlus,
  X
} from 'lucide-react'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/patterns/status-badge'
import { PosConfirmDialog } from '@/components/pos/pos-confirm-dialog'
import { SaleAddFeeDialog } from '@/components/sales/sale-add-fee-dialog'
import { SaleQuickCustomerDialog } from '@/components/sales/sale-quick-customer-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import type { OptiCustomerOption } from '@/lib/customers/queries'
import type { FeeTypeListItem } from '@/lib/fee-types/queries'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import { looksLikeBarcode, prepareBarcodeQuery } from '@/lib/pos/barcode'
import { lookupPosProductByBarcode } from '@/lib/pos/actions'
import {
  clearPosSession,
  loadPosSession,
  savePosSession,
  type PosCartLine,
  type PosFeeLine
} from '@/lib/pos/session'
import {
  createSaleAction,
  searchSaleProductsAction
} from '@/lib/sales/actions'
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

type Props = {
  warehouses: WarehouseOption[]
  customers: OptiCustomerOption[]
  paymentMethods: PaymentMethodOption[]
  feeTypes: FeeTypeListItem[]
  canWrite: boolean
}

function isCardPaymentMethodName(name: string) {
  const n = name.toLowerCase()
  return (
    n.includes('kártya') ||
    n.includes('kartya') ||
    n.includes('card') ||
    n.includes('bankkártya') ||
    n.includes('bankkartya')
  )
}

function formatOnHand(n: number) {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

function productToLine(hit: SaleProductSearchItem): PosCartLine {
  const taxPct = Number(hit.tax_rate_percent ?? 0)
  const net = Number(hit.price_net ?? 0)
  const gross = Math.round(net * (1 + taxPct / 100))
  return {
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
}

export function PosClient({
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

  const [hydrated, setHydrated] = useState(false)
  const [warehouseId, setWarehouseId] = useState(defaultWh)
  const [customers, setCustomers] = useState(initialCustomers)
  const [customerId, setCustomerId] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false)
  const [feeDialogOpen, setFeeDialogOpen] = useState(false)
  const [lines, setLines] = useState<PosCartLine[]>([])
  const [fees, setFees] = useState<PosFeeLine[]>([])
  const [globalDiscPct, setGlobalDiscPct] = useState(0)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [discOpen, setDiscOpen] = useState(false)

  const [searchQ, setSearchQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchHits, setSearchHits] = useState<SaleProductSearchItem[]>([])
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0)

  const [editingField, setEditingField] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingPayId, setPendingPayId] = useState('')

  const barcodeRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const customerWrapRef = useRef<HTMLDivElement>(null)
  const scanLock = useRef(false)
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cashMethod = paymentMethods.find((p) =>
    isCashPaymentMethodName(p.name)
  )
  const cardMethod = paymentMethods.find((p) =>
    isCardPaymentMethodName(p.name)
  )

  const pendingPayName =
    paymentMethods.find((p) => p.id === pendingPayId)?.name ?? ''
  const applyCashRound = isCashPaymentMethodName(pendingPayName)

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

  const selectedCustomer = customers.find((c) => c.id === customerId)
  const overstock = lines.filter(
    (l) => l.onHand != null && l.quantity > l.onHand + 0.0001
  )

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

  // Hydrate session
  useEffect(() => {
    const saved = loadPosSession()
    if (saved) {
      if (
        saved.warehouseId &&
        warehouses.some((w) => w.id === saved.warehouseId)
      ) {
        setWarehouseId(saved.warehouseId)
      }
      if (saved.customerId) setCustomerId(saved.customerId)
      setLines(saved.lines)
      setFees(saved.fees)
      setGlobalDiscPct(saved.globalDiscPct)
    }
    setHydrated(true)
  }, [warehouses])

  useEffect(() => {
    if (!hydrated) return
    savePosSession({
      warehouseId,
      customerId,
      lines,
      fees,
      globalDiscPct
    })
  }, [hydrated, warehouseId, customerId, lines, fees, globalDiscPct])

  const focusBarcode = useCallback(() => {
    if (editingField) return
    barcodeRef.current?.focus()
  }, [editingField])

  useEffect(() => {
    focusBarcode()
  }, [focusBarcode, lines.length, fees.length])

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === 'visible') focusBarcode()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [focusBarcode])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setSearchOpen(false)
      }
      if (!customerWrapRef.current?.contains(e.target as Node)) {
        setCustomerOpen(false)
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
      void searchSaleProductsAction(q, warehouseId, false).then((res) => {
        setSearching(false)
        if (res.ok) {
          setSearchHits(res.rows)
          setSearchOpen(true)
          setSelectedSearchIndex(0)
        } else setSearchHits([])
      })
    }, 180)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [searchQ, warehouseId])

  function addOrBump(hit: SaleProductSearchItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.accessoryId === hit.id)
      if (existing) {
        return prev.map((l) =>
          l.accessoryId === hit.id
            ? { ...l, quantity: l.quantity + 1, onHand: hit.on_hand }
            : l
        )
      }
      if (hit.on_hand <= 0) {
        toast.message('Nincs készleten — az eladás így is rögzíthető.')
      }
      return [...prev, productToLine(hit)]
    })
    setHighlightId(hit.id)
    setTimeout(() => setHighlightId(null), 600)
  }

  async function runBarcodeScan(raw: string) {
    if (!warehouseId || scanLock.current) return
    const { normalized, raw: trimmed } = prepareBarcodeQuery(raw)
    if (!normalized && !trimmed) return

    scanLock.current = true
    try {
      const res = await lookupPosProductByBarcode(
        normalized || trimmed,
        warehouseId
      )
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      addOrBump(res.product)
    } finally {
      scanLock.current = false
      focusBarcode()
    }
  }

  function onBarcodeChange(value: string) {
    if (editingField) return
    if (scanTimer.current) clearTimeout(scanTimer.current)
    scanTimer.current = setTimeout(() => {
      const t = value.trim()
      if (t.length >= 4) {
        void runBarcodeScan(t)
        if (barcodeRef.current) barcodeRef.current.value = ''
      }
    }, 100)
  }

  function openPay(methodId: string) {
    if (!canWrite) return
    if (lines.length === 0) {
      toast.error('Adj hozzá legalább egy terméket.')
      return
    }
    if (!methodId) {
      toast.error('Válassz fizetési módot.')
      return
    }
    setPendingPayId(methodId)
    setConfirmOpen(true)
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await createSaleAction({
        warehouseId,
        customerId: customerId || null,
        channel: 'pos',
        note: null,
        discountPercentage: globalDiscPct || 0,
        discountAmount: 0,
        items: lines.map((l) => ({
          accessoryId: l.accessoryId,
          quantity: l.quantity,
          unitPriceGross: l.unitPriceGross,
          discountPercentage: l.discountPercentage || 0,
          discountAmount: 0
        })),
        fees: fees.map((f) => ({
          feeTypeId: f.feeTypeId,
          name: f.name,
          quantity: 1,
          unitPriceGross: Math.round(f.unitPriceGross),
          taxRatePercent: f.taxRatePercent
        })),
        payments: [{ paymentMethodId: pendingPayId, amount: totals.due }]
      })

      if (!result.ok) {
        toast.error(result.message)
        setConfirmOpen(false)
        return
      }

      toast.success(
        result.saleNumber
          ? `Eladás kész: ${result.saleNumber}`
          : 'Eladás rögzítve.'
      )
      setLines([])
      setFees([])
      setGlobalDiscPct(0)
      setCustomerId('')
      setExpandedIds(new Set())
      setDiscOpen(false)
      clearPosSession()
      setConfirmOpen(false)
      setPendingPayId('')
      focusBarcode()
      router.refresh()
    })
  }

  if (!canWrite) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-body text-ink-secondary">Nincs írási jogosultságod.</p>
      </div>
    )
  }

  if (warehouses.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-body text-warning-ink">
          Nincs aktív raktár. Előbb hozz létre egyet.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-app">
      {/* Hidden barcode trap */}
      <input
        ref={barcodeRef}
        type="text"
        aria-label="Vonalkód olvasó"
        className="pointer-events-none fixed left-[-9999px] h-px w-px opacity-0"
        autoComplete="off"
        disabled={editingField}
        onChange={(e) => onBarcodeChange(e.target.value)}
        onKeyDown={(e) => {
          if (editingField) {
            e.preventDefault()
            return
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            if (scanTimer.current) clearTimeout(scanTimer.current)
            const v = (e.target as HTMLInputElement).value.trim()
            if (v) {
              void runBarcodeScan(v)
              ;(e.target as HTMLInputElement).value = ''
            }
          }
        }}
        onBlur={() => {
          setTimeout(() => {
            const el = document.activeElement
            const tag = el?.tagName
            if (
              tag === 'INPUT' ||
              tag === 'TEXTAREA' ||
              tag === 'BUTTON' ||
              el?.closest('[role="listbox"]') ||
              el?.closest('[role="dialog"]')
            ) {
              return
            }
            focusBarcode()
          }, 120)
        }}
      />

      {/* Top bar */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="text-[13px] font-semibold text-ink">POS</span>

        {warehouses.length === 1 ? (
          <span className="rounded-md border border-border bg-subtle px-2 py-1 text-body text-ink">
            {warehouses[0]!.name}
          </span>
        ) : (
          <div className="w-[12rem]">
            <MenuSelect
              id="pos-wh"
              value={warehouseId}
              onChange={setWarehouseId}
              allowEmpty={false}
              options={warehouseOptions}
            />
          </div>
        )}

        <div ref={customerWrapRef} className="relative">
          {selectedCustomer ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-body">
              <User className="size-3.5 text-ink-muted" aria-hidden />
              {selectedCustomer.name}
              <button
                type="button"
                aria-label="Ügyfél eltávolítása"
                className="rounded p-0.5 hover:bg-subtle"
                onClick={() => setCustomerId('')}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCustomerOpen((o) => !o)}
            >
              <User className="size-3.5" aria-hidden />
              Ügyfél
            </Button>
          )}
          {customerOpen && !selectedCustomer ? (
            <div className="absolute left-0 z-30 mt-1 w-[18rem] rounded-md border border-border bg-surface p-2 shadow-md">
              <MenuSelect
                id="pos-customer"
                value=""
                onChange={(v) => {
                  setCustomerId(v)
                  setCustomerOpen(false)
                  focusBarcode()
                }}
                allowEmpty={false}
                searchable={customers.length > 8}
                options={customerOptions}
                placeholder="Ügyfél keresése…"
              />
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setQuickCustomerOpen(true)}
        >
          <UserPlus className="size-3.5" aria-hidden />
          Új ügyfél
        </Button>

        <div className="ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push('/ertekesitesek')}
          >
            <LogOut className="size-3.5" aria-hidden />
            Kilépés
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-2">
        {/* Search panel */}
        <section className="flex min-h-0 flex-col border-b border-border p-3 lg:border-b-0 lg:border-r">
          <div ref={searchWrapRef} className="relative shrink-0">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              ref={searchRef}
              id="pos-search"
              value={searchQ}
              placeholder="Vonalkód / SKU / név…"
              className="pl-8"
              autoComplete="off"
              onFocus={() => setEditingField(true)}
              onBlur={() => {
                setEditingField(false)
                setTimeout(focusBarcode, 100)
              }}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setSelectedSearchIndex((i) =>
                    Math.min(i + 1, Math.max(0, searchHits.length - 1))
                  )
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setSelectedSearchIndex((i) => Math.max(0, i - 1))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  const hit =
                    searchHits[selectedSearchIndex] ?? searchHits[0]
                  if (hit) {
                    addOrBump(hit)
                    setSearchQ('')
                    setSearchHits([])
                    setSearchOpen(false)
                    setEditingField(false)
                    focusBarcode()
                  } else if (looksLikeBarcode(searchQ)) {
                    void runBarcodeScan(searchQ)
                    setSearchQ('')
                    setEditingField(false)
                    focusBarcode()
                  }
                }
              }}
            />
          </div>

          <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-md border border-border">
            {searching && searchHits.length === 0 ? (
              <p className="p-4 text-hint text-ink-secondary">Keresés…</p>
            ) : searchHits.length === 0 ? (
              <p className="p-4 text-hint text-ink-secondary">
                {searchQ.trim()
                  ? 'Nincs találat'
                  : 'Scannelj vagy gépelj a keresőbe.'}
              </p>
            ) : (
              <table className="w-full border-collapse text-body">
                <thead>
                  <tr className="sticky top-0 border-b border-border bg-subtle text-left text-label text-ink-secondary">
                    <th className="px-2.5 py-2 font-medium">Termék</th>
                    <th className="px-2.5 py-2 font-medium text-right">
                      Készlet
                    </th>
                    <th className="px-2.5 py-2 font-medium text-right">Ár</th>
                  </tr>
                </thead>
                <tbody>
                  {searchHits.map((hit, index) => {
                    const gross = Math.round(
                      hit.price_net * (1 + hit.tax_rate_percent / 100)
                    )
                    const zero = hit.on_hand <= 0
                    return (
                      <tr
                        key={hit.id}
                        className={cn(
                          'cursor-pointer border-b border-border last:border-0 hover:bg-subtle',
                          index === selectedSearchIndex && 'bg-subtle'
                        )}
                        onClick={() => {
                          addOrBump(hit)
                          setSearchQ('')
                          setSearchHits([])
                          setSearchOpen(false)
                          setEditingField(false)
                          focusBarcode()
                        }}
                      >
                        <td className="px-2.5 py-2">
                          <div className="font-medium text-ink">{hit.name}</div>
                          <div className="text-hint text-ink-secondary">
                            {hit.sku}
                          </div>
                        </td>
                        <td
                          className={cn(
                            'px-2.5 py-2 text-right tabular-nums',
                            zero ? 'text-warning-ink' : 'text-ink-secondary'
                          )}
                        >
                          {formatOnHand(hit.on_hand)} {hit.unit_shortform}
                        </td>
                        <td className="px-2.5 py-2 text-right font-semibold tabular-nums">
                          {formatMoneyFt(gross)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          {/* keep searchOpen used */}
          {searchOpen ? null : null}
        </section>

        {/* Cart + pay */}
        <aside className="flex min-h-0 flex-col bg-subtle/30">
          <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
            {lines.length === 0 && fees.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-surface p-6 text-center text-body text-ink-secondary">
                A kosár üres. Scannelj terméket.
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border border-border bg-surface">
                <table className="w-full border-collapse text-body">
                  <thead>
                    <tr className="border-b border-border bg-subtle text-left text-label text-ink-secondary">
                      <th className="px-2.5 py-2 font-medium">Termék</th>
                      <th className="w-[8.5rem] px-1 py-2 text-center font-medium">
                        Qty
                      </th>
                      <th className="w-[6.5rem] px-2 py-2 text-right font-medium">
                        Bruttó
                      </th>
                      <th className="w-10 px-1 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const over =
                        line.onHand != null &&
                        line.quantity > line.onHand + 0.0001
                      const zeroStock =
                        line.onHand != null && line.onHand <= 0
                      const before = Math.round(
                        line.quantity * line.unitPriceGross
                      )
                      const disc = Math.round(
                        (before * (line.discountPercentage || 0)) / 100
                      )
                      const g = Math.max(0, before - disc)
                      const expanded = expandedIds.has(line.accessoryId)
                      return (
                        <tr
                          key={line.accessoryId}
                          className={cn(
                            'border-b border-border last:border-0',
                            over || zeroStock
                              ? 'bg-warning-soft/80'
                              : undefined,
                            highlightId === line.accessoryId &&
                              'bg-success-soft ring-2 ring-inset ring-success'
                          )}
                        >
                          <td className="px-2.5 py-2 align-middle">
                            <button
                              type="button"
                              className="w-full text-left"
                              onClick={() =>
                                setExpandedIds((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(line.accessoryId)) {
                                    next.delete(line.accessoryId)
                                  } else {
                                    next.add(line.accessoryId)
                                  }
                                  return next
                                })
                              }
                            >
                              <div className="flex items-center gap-1 font-semibold text-ink">
                                <ChevronDown
                                  className={cn(
                                    'size-3.5 shrink-0 text-ink-muted transition-transform',
                                    expanded && 'rotate-180'
                                  )}
                                  aria-hidden
                                />
                                <span className="min-w-0 truncate">
                                  {line.name}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1 pl-4">
                                <span className="text-hint text-ink-secondary">
                                  {line.sku}
                                </span>
                                {zeroStock ? (
                                  <StatusBadge tone="danger">
                                    Nincs raktáron
                                  </StatusBadge>
                                ) : over ? (
                                  <StatusBadge tone="warning">
                                    Készlethiány
                                  </StatusBadge>
                                ) : line.onHand != null ? (
                                  <span className="text-hint text-ink-muted">
                                    {formatOnHand(line.onHand)}{' '}
                                    {line.unitShortform}
                                  </span>
                                ) : null}
                                {line.discountPercentage > 0 ? (
                                  <StatusBadge tone="neutral">
                                    −{line.discountPercentage}%
                                  </StatusBadge>
                                ) : null}
                              </div>
                            </button>
                            {expanded ? (
                              <div className="mt-2 flex flex-wrap gap-2 pl-4">
                                <label className="flex flex-col gap-0.5">
                                  <span className="text-hint text-ink-secondary">
                                    Bruttó ár
                                  </span>
                                  <Input
                                    type="number"
                                    min={0}
                                    className="h-10 w-28 tabular-nums"
                                    value={line.unitPriceGross}
                                    onFocus={() => setEditingField(true)}
                                    onBlur={() => {
                                      setEditingField(false)
                                      setTimeout(focusBarcode, 100)
                                    }}
                                    onChange={(e) => {
                                      const n = Number(e.target.value)
                                      setLines((prev) =>
                                        prev.map((l) =>
                                          l.accessoryId === line.accessoryId
                                            ? {
                                                ...l,
                                                unitPriceGross:
                                                  Number.isFinite(n) ? n : 0
                                              }
                                            : l
                                        )
                                      )
                                    }}
                                  />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="text-hint text-ink-secondary">
                                    Kedv. %
                                  </span>
                                  <div className="flex items-center gap-0.5">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      className="size-10 shrink-0 p-0"
                                      aria-label="Kedvezmény csökkentése"
                                      disabled={line.discountPercentage <= 0}
                                      onClick={() =>
                                        setLines((prev) =>
                                          prev.map((l) =>
                                            l.accessoryId === line.accessoryId
                                              ? {
                                                  ...l,
                                                  discountPercentage: Math.max(
                                                    0,
                                                    l.discountPercentage - 1
                                                  )
                                                }
                                              : l
                                          )
                                        )
                                      }
                                    >
                                      <Minus className="size-4" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      className="h-10 w-14 text-center tabular-nums"
                                      value={line.discountPercentage}
                                      onFocus={() => setEditingField(true)}
                                      onBlur={() => {
                                        setEditingField(false)
                                        setTimeout(focusBarcode, 100)
                                      }}
                                      onChange={(e) => {
                                        const n = Number(e.target.value)
                                        setLines((prev) =>
                                          prev.map((l) =>
                                            l.accessoryId === line.accessoryId
                                              ? {
                                                  ...l,
                                                  discountPercentage:
                                                    Number.isFinite(n)
                                                      ? Math.min(
                                                          100,
                                                          Math.max(0, n)
                                                        )
                                                      : 0
                                                }
                                              : l
                                          )
                                        )
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      className="size-10 shrink-0 p-0"
                                      aria-label="Kedvezmény növelése"
                                      disabled={line.discountPercentage >= 100}
                                      onClick={() =>
                                        setLines((prev) =>
                                          prev.map((l) =>
                                            l.accessoryId === line.accessoryId
                                              ? {
                                                  ...l,
                                                  discountPercentage: Math.min(
                                                    100,
                                                    l.discountPercentage + 1
                                                  )
                                                }
                                              : l
                                          )
                                        )
                                      }
                                    >
                                      <Plus className="size-4" />
                                    </Button>
                                  </div>
                                </label>
                              </div>
                            ) : null}
                          </td>
                          <td className="px-1 py-2 align-middle">
                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                type="button"
                                variant="secondary"
                                className="size-10 shrink-0 p-0"
                                aria-label="Csökkentés"
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
                                <Minus className="size-4" />
                              </Button>
                              <Input
                                type="number"
                                min={1}
                                className="h-10 w-12 text-center tabular-nums"
                                value={line.quantity}
                                onFocus={() => setEditingField(true)}
                                onBlur={() => {
                                  setEditingField(false)
                                  setTimeout(focusBarcode, 100)
                                }}
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
                                className="size-10 shrink-0 p-0"
                                aria-label="Növelés"
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
                                <Plus className="size-4" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right align-middle tabular-nums text-ink">
                            {line.discountPercentage > 0 ? (
                              <div className="flex flex-col items-end leading-tight">
                                <span className="text-[12px] text-ink-muted line-through decoration-ink-muted">
                                  {formatMoneyFt(before)} Ft
                                </span>
                                <span className="text-[15px] font-semibold text-warning-ink">
                                  {formatMoneyFt(g)} Ft
                                </span>
                              </div>
                            ) : (
                              <span className="text-[15px] font-semibold">
                                {formatMoneyFt(g)} Ft
                              </span>
                            )}
                          </td>
                          <td className="px-1 py-2 align-middle">
                            <Button
                              type="button"
                              variant="ghost"
                              className="size-10 p-0 text-danger-ink hover:bg-danger-soft"
                              aria-label="Törlés"
                              onClick={() =>
                                setLines((prev) =>
                                  prev.filter(
                                    (l) => l.accessoryId !== line.accessoryId
                                  )
                                )
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                    {fees.map((fee) => (
                      <tr
                        key={fee.key}
                        className="border-b border-border bg-subtle/50 last:border-0"
                      >
                        <td className="px-2.5 py-2 align-middle">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-ink">
                              {fee.name}
                            </span>
                            <StatusBadge tone="neutral">Díj</StatusBadge>
                          </div>
                        </td>
                        <td className="px-1 py-2 text-center align-middle text-ink-muted">
                          —
                        </td>
                        <td className="px-2 py-2 text-right align-middle">
                          <Input
                            type="number"
                            min={0}
                            className="ml-auto h-10 w-[5.5rem] text-right tabular-nums"
                            value={fee.unitPriceGross}
                            aria-label="Díj bruttó"
                            onFocus={() => setEditingField(true)}
                            onBlur={() => {
                              setEditingField(false)
                              setTimeout(focusBarcode, 100)
                            }}
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
                        <td className="px-1 py-2 align-middle">
                          <Button
                            type="button"
                            variant="ghost"
                            className="size-10 p-0 text-danger-ink hover:bg-danger-soft"
                            aria-label="Díj törlése"
                            onClick={() =>
                              setFees((prev) =>
                                prev.filter((f) => f.key !== fee.key)
                              )
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 space-y-3 border-t border-border bg-surface p-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-ink-secondary">
                  Nettó
                </p>
                <p className="text-[17px] font-semibold tabular-nums text-ink">
                  {formatMoneyFt(totals.totalNet)} Ft
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-medium text-ink-secondary">
                  Bruttó
                </p>
                {totals.globalDiscountAmount > 0 ? (
                  <div className="flex flex-col items-end leading-tight">
                    <span className="text-[13px] text-ink-muted line-through decoration-ink-muted tabular-nums">
                      {formatMoneyFt(totals.subtotalGross)} Ft
                    </span>
                    <span className="text-[28px] font-semibold tabular-nums tracking-tight text-ink">
                      {formatMoneyFt(totals.due)} Ft
                    </span>
                  </div>
                ) : (
                  <p className="text-[28px] font-semibold leading-none tabular-nums tracking-tight text-ink">
                    {formatMoneyFt(totals.due)} Ft
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {totals.globalDiscountAmount > 0 ? (
                <StatusBadge tone="warning">
                  Kedv. −{totals.globalDiscountPercent}% · −
                  {formatMoneyFt(totals.globalDiscountAmount)} Ft
                </StatusBadge>
              ) : null}
              {totals.cashRoundingAmount !== 0 ? (
                <StatusBadge tone="neutral">
                  Kerekítés{' '}
                  {totals.cashRoundingAmount > 0 ? '+' : ''}
                  {formatMoneyFt(totals.cashRoundingAmount)} Ft
                </StatusBadge>
              ) : null}
              {overstock.length > 0 ? (
                <StatusBadge tone="warning">
                  {overstock.length} készlethiányos
                </StatusBadge>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-11 min-w-[5.5rem]"
                disabled={feeTypes.length === 0}
                onClick={() => setFeeDialogOpen(true)}
              >
                <Plus className="size-4" aria-hidden />
                Díj
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-11 min-w-[5.5rem]"
                onClick={() => setDiscOpen((o) => !o)}
              >
                <Percent className="size-4" aria-hidden />
                Kedv.
              </Button>
              {discOpen || globalDiscPct > 0 ? (
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="secondary"
                    className="size-11 shrink-0 p-0"
                    aria-label="Globál kedvezmény csökkentése"
                    disabled={globalDiscPct <= 0}
                    onClick={() =>
                      setGlobalDiscPct((n) => Math.max(0, n - 1))
                    }
                  >
                    <Minus className="size-4" />
                  </Button>
                  <Input
                    id="pos-disc"
                    type="number"
                    min={0}
                    max={100}
                    className="h-11 w-14 text-center tabular-nums"
                    value={globalDiscPct}
                    aria-label="Globál kedvezmény %"
                    onFocus={() => setEditingField(true)}
                    onBlur={() => {
                      setEditingField(false)
                      setTimeout(focusBarcode, 100)
                    }}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      setGlobalDiscPct(
                        Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
                      )
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="size-11 shrink-0 p-0"
                    aria-label="Globál kedvezmény növelése"
                    disabled={globalDiscPct >= 100}
                    onClick={() =>
                      setGlobalDiscPct((n) => Math.min(100, n + 1))
                    }
                  >
                    <Plus className="size-4" />
                  </Button>
                  <span className="text-hint text-ink-secondary">%</span>
                </div>
              ) : null}
            </div>

            {paymentMethods.length === 0 ? (
              <p className="text-hint text-warning-ink">
                Nincs aktív fizetési mód — Törzsadatok.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {cashMethod ? (
                  <Button
                    type="button"
                    className="h-14 text-[15px] font-semibold"
                    disabled={lines.length === 0 || pending}
                    onClick={() => openPay(cashMethod.id)}
                  >
                    Készpénz
                  </Button>
                ) : null}
                {cardMethod ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-14 border-2 border-border-strong text-[15px] font-semibold"
                    disabled={lines.length === 0 || pending}
                    onClick={() => openPay(cardMethod.id)}
                  >
                    Kártya
                  </Button>
                ) : null}
                {!cashMethod && !cardMethod && paymentMethods[0] ? (
                  <Button
                    type="button"
                    className="col-span-2 h-14 text-[15px] font-semibold"
                    disabled={lines.length === 0 || pending}
                    onClick={() => openPay(paymentMethods[0]!.id)}
                  >
                    Fizetés
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </aside>
      </div>

      <SaleAddFeeDialog
        open={feeDialogOpen}
        onOpenChange={(o) => {
          setFeeDialogOpen(o)
          if (!o) setTimeout(focusBarcode, 100)
        }}
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
        onOpenChange={(o) => {
          setQuickCustomerOpen(o)
          if (!o) setTimeout(focusBarcode, 100)
        }}
        onCreated={(c) => {
          setCustomers((prev) => {
            if (prev.some((x) => x.id === c.id)) return prev
            return [
              {
                id: c.id,
                name: c.name,
                mobile: c.mobile,
                email: null,
                billing_name: null,
                billing_country: 'Magyarország',
                billing_city: null,
                billing_postal_code: null,
                billing_street: null,
                billing_house_number: null,
                billing_tax_number: null
              },
              ...prev
            ]
          })
          setCustomerId(c.id)
        }}
      />

      <PosConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!pending) {
            setConfirmOpen(open)
            if (!open) setTimeout(focusBarcode, 100)
          }
        }}
        lines={lines}
        fees={fees}
        totals={totals}
        paymentMethodName={pendingPayName}
        isCash={applyCashRound}
        warehouseName={
          warehouses.find((w) => w.id === warehouseId)?.name ?? '—'
        }
        customerName={selectedCustomer?.name ?? null}
        overstockCount={overstock.length}
        loading={pending}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
