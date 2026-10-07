'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  Banknote,
  Smartphone,
  Tag
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'

import {
  PosConfirmDialog,
  type PosConfirmResult
} from '@/components/pos/pos-confirm-dialog'
import { PdaCustomerChip, PdaCustomerSheet } from '@/components/pos/pda/pda-customer-sheet'
import { PdaDock } from '@/components/pos/pda/pda-dock'
import { PdaHandoffSuccess } from '@/components/pos/pda/pda-handoff-success'
import { PdaProductSearch } from '@/components/pos/pda/pda-product-search'
import { PdaScroll, PdaShell } from '@/components/pos/pda/pda-shell'
import { PosShiftGate } from '@/components/pos/pos-shift-gate'
import { Button } from '@/components/ui/button'
import { usePdaScanner } from '@/hooks/use-pda-scanner'
import { usePdaViewport } from '@/hooks/use-pda-viewport'
import type { OptiCustomerOption } from '@/lib/customers/queries'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import { prepareBarcodeQuery } from '@/lib/pos/barcode'
import { createPosCartHandoffAction } from '@/lib/pos/handoff-actions'
import { loadPosQuickProductsAction } from '@/lib/pos/quick-items-actions'
import type { PosCartLine } from '@/lib/pos/session'
import { getOpenPosShiftAction } from '@/lib/pos/shift-actions'
import type { PosRegister } from '@/lib/pos/shifts'
import type { PosTerminalPublicConfig } from '@/lib/pos/settings-types'
import { type PosPayMode } from '@/lib/pos/tender'
import {
  isCashPaymentMethodName,
  isCardPaymentMethodName
} from '@/lib/sales/payment-kind'
import { createSaleAction } from '@/lib/sales/actions'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { SaleProductSearchItem } from '@/lib/sales/queries'
import { computeSaleTotals } from '@/lib/sales/totals'

type View = 'hub' | 'check' | 'sell' | 'handoff_ok'

type WarehousePick = { id: string; name: string; code?: string | null }

type Props = {
  warehouses: WarehousePick[]
  registers: PosRegister[]
  paymentMethods: PaymentMethodOption[]
  customers: OptiCustomerOption[]
  canWrite: boolean
  posConfig: PosTerminalPublicConfig
}

function catalogToLine(
  hit: SaleProductSearchItem,
  quantity = 1
): PosCartLine {
  const taxPct = Number(hit.tax_rate_percent ?? 0)
  const net = Number(hit.price_net ?? 0)
  const gross = Math.round(net * (1 + taxPct / 100))
  return {
    kind: 'product',
    accessoryId: hit.id,
    sheetMaterialId: null,
    linearMaterialId: null,
    name: hit.display_name?.trim() || hit.name,
    sku: hit.sku,
    unitShortform: hit.unit_shortform || 'db',
    quantity: Math.max(1, Math.round(quantity)),
    unitPriceGross: gross,
    taxPercent: taxPct,
    discountPercentage: 0,
    onHand: hit.on_hand,
    areaOrLengthFactor: null,
    stockUnit: null
  }
}

function lineKey(line: PosCartLine): string {
  return line.accessoryId ?? line.sku
}

export function PdaPosClient({
  warehouses,
  registers,
  paymentMethods,
  customers: initialCustomers,
  canWrite,
  posConfig
}: Props) {
  const { standalone } = usePdaViewport()
  const [view, setView] = useState<View>('hub')
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [registerId, setRegisterId] = useState(registers[0]?.id ?? '')
  const [openShiftId, setOpenShiftId] = useState<string | null>(null)
  const [lines, setLines] = useState<PosCartLine[]>([])
  const [quick, setQuick] = useState<SaleProductSearchItem[]>([])
  const [flash, setFlash] = useState<string | null>(null)
  const [checkProduct, setCheckProduct] = useState<SaleProductSearchItem | null>(
    null
  )
  const [checkMsg, setCheckMsg] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [payMode, setPayMode] = useState<PosPayMode>('cash')
  const [pending, startTransition] = useTransition()
  const [customers, setCustomers] = useState(initialCustomers)
  const [customerId, setCustomerId] = useState('')
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [handoffCode, setHandoffCode] = useState<string | null>(null)
  const [handoffPending, setHandoffPending] = useState(false)

  const cashMethod = paymentMethods.find((p) =>
    isCashPaymentMethodName(p.name)
  )
  const cardMethod = paymentMethods.find((p) =>
    isCardPaymentMethodName(p.name)
  )
  const register = registers.find((r) => r.id === registerId) ?? null
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null

  const totals = useMemo(
    () =>
      computeSaleTotals({
        lines: lines.map((l) => ({
          quantity: l.quantity,
          unitPriceGross: l.unitPriceGross,
          discountPercentage: l.discountPercentage,
          taxPercent: l.taxPercent
        })),
        fees: [],
        globalDiscountPercent: 0,
        applyCashRound: false
      }),
    [lines]
  )

  const scannerPaused =
    view === 'hub' ||
    view === 'handoff_ok' ||
    confirmOpen ||
    customerSheetOpen ||
    searchFocused

  useEffect(() => {
    if (!registerId) {
      setOpenShiftId(null)
      return
    }
    let cancelled = false
    void getOpenPosShiftAction(registerId).then((r) => {
      if (cancelled) return
      setOpenShiftId(r.ok ? (r.shift?.id ?? null) : null)
    })
    return () => {
      cancelled = true
    }
  }, [registerId])

  useEffect(() => {
    if (view !== 'sell' || !warehouseId) return
    void loadPosQuickProductsAction(warehouseId).then((r) => {
      if (r.ok) setQuick(r.rows)
    })
  }, [view, warehouseId])

  const lookupBarcode = useCallback(
    async (raw: string): Promise<SaleProductSearchItem | null> => {
      const { normalized } = prepareBarcodeQuery(raw)
      if (!normalized || !warehouseId) return null
      const res = await fetch(
        `/api/pos/barcode-lookup?q=${encodeURIComponent(normalized)}&warehouseId=${encodeURIComponent(warehouseId)}`,
        { credentials: 'same-origin' }
      )
      const data = (await res.json()) as {
        ok?: boolean
        product?: SaleProductSearchItem
        message?: string
        notFound?: boolean
      }
      if (!data.ok || !data.product) {
        setFlash(data.message ?? 'Nincs találat.')
        return null
      }
      return data.product
    },
    [warehouseId]
  )

  const addProduct = useCallback((hit: SaleProductSearchItem) => {
    if (hit.kind && hit.kind !== 'product') {
      setFlash('PDA: csak termék (db). Anyag a pulti POS-on.')
      return
    }
    if (!(hit.price_net > 0)) {
      setFlash('Nincs eladási ár.')
      return
    }
    setLines((prev) => {
      const key = hit.id
      const idx = prev.findIndex((l) => l.accessoryId === key)
      if (idx >= 0) {
        const next = [...prev]
        const row = next[idx]!
        next[idx] = { ...row, quantity: row.quantity + 1 }
        return next
      }
      return [...prev, catalogToLine(hit, 1)]
    })
    setFlash(null)
  }, [])

  const handleScan = useCallback(
    async (code: string) => {
      const product = await lookupBarcode(code)
      if (!product) {
        if (view === 'check') {
          setCheckProduct(null)
          setCheckMsg('Nincs ilyen termék.')
        }
        return
      }
      if (view === 'check') {
        setCheckProduct(product)
        setCheckMsg(null)
        setFlash(null)
        return
      }
      addProduct(product)
    },
    [lookupBarcode, view, addProduct]
  )

  const { sinkProps } = usePdaScanner({
    enabled: view === 'sell' || view === 'check',
    paused: scannerPaused,
    onScan: (code) => {
      void handleScan(code)
    }
  })

  function openPay(mode: PosPayMode) {
    if (!canWrite) {
      setFlash('Nincs írási jog.')
      return
    }
    if (!openShiftId) {
      setFlash('Nyiss műszakot.')
      return
    }
    if (lines.length === 0) {
      setFlash('Üres a kosár.')
      return
    }
    if (mode === 'cash' && (!posConfig.allowCash || !cashMethod)) {
      setFlash('Készpénz nincs beállítva.')
      return
    }
    if (mode === 'card' && (!posConfig.allowCard || !cardMethod)) {
      setFlash('Kártya nincs beállítva.')
      return
    }
    if (posConfig.requireCustomer && !customerId) {
      setFlash('Válassz ügyfelet.')
      setCustomerSheetOpen(true)
      return
    }
    setPayMode(mode)
    setConfirmOpen(true)
  }

  async function handleHandoff() {
    if (!canWrite) {
      setFlash('Nincs írási jog.')
      return
    }
    if (lines.length === 0) {
      setFlash('Üres a kosár — előbb tegyél be terméket.')
      return
    }
    setHandoffPending(true)
    setFlash(null)
    const res = await createPosCartHandoffAction({
      warehouseId,
      customerId: customerId || null,
      lines
    })
    setHandoffPending(false)
    if (!res.ok) {
      setFlash(res.message)
      return
    }
    setLines([])
    setHandoffCode(res.code)
    setView('handoff_ok')
  }

  function handleConfirm(confirm: PosConfirmResult) {
    startTransition(async () => {
      const result = await createSaleAction({
        warehouseId,
        customerId: customerId || null,
        channel: 'pos',
        note: confirm.noteSuffix,
        discountPercentage: 0,
        discountAmount: 0,
        posRegisterId: registerId,
        items: lines.map((l) => ({
          kind: 'product' as const,
          accessoryId: l.accessoryId!,
          sheetMaterialId: null,
          linearMaterialId: null,
          quantity: l.quantity,
          unitPriceGross: l.unitPriceGross,
          discountPercentage: l.discountPercentage || 0,
          discountAmount: 0
        })),
        fees: [],
        payments: confirm.payments,
        fulfillNow: confirm.fulfillNow || confirm.payments.length === 0
      })
      setConfirmOpen(false)
      if (!result.ok) {
        setFlash(result.message)
        return
      }
      setLines([])
      setFlash(
        `Kész · ${result.saleNumber ?? result.id} · ${formatMoneyFt(totals.totalGross)} Ft`
      )
      setView('hub')
    })
  }

  if (registers.length === 0 || warehouses.length === 0) {
    return (
      <PdaShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="text-center text-body text-ink-secondary">
            Kell legalább egy raktár és pénztár (pulti POS beállítás).
          </p>
          {!standalone ? (
            <Link
              href="/pos"
              className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface px-4 text-body font-medium text-ink"
            >
              Pulti POS
            </Link>
          ) : null}
        </div>
      </PdaShell>
    )
  }

  if (view === 'sell' && registerId && !openShiftId) {
    return (
      <PdaShell>
        <PdaTopbar title="Műszak" onBack={() => setView('hub')} />
        <PdaScroll>
          <PosShiftGate
            registerId={registerId}
            registerName={register?.name ?? 'Pénztár'}
            onOpened={(id) => setOpenShiftId(id)}
          />
        </PdaScroll>
      </PdaShell>
    )
  }

  return (
    <PdaShell className="relative">
      {/* Hidden wedge sink — always mounted in sell/check */}
      {view === 'sell' || view === 'check' ? (
        <input
          {...sinkProps}
          type="text"
          inputMode="none"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-hidden
          tabIndex={scannerPaused ? -1 : 0}
          className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
        />
      ) : null}

      {view === 'hub' ? (
        <>
          <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Smartphone className="size-5 text-ink" aria-hidden />
              <h1 className="text-[17px] font-semibold text-ink">PDA POS</h1>
            </div>
            {!standalone ? (
              <Link
                href="/pos"
                className="inline-flex h-10 items-center rounded-md px-3 text-body text-ink-secondary hover:bg-subtle hover:text-ink"
              >
                Pult
              </Link>
            ) : (
              <span className="text-hint text-ink-muted">Kezdőképernyő</span>
            )}
          </header>
          <PdaScroll className="flex flex-col gap-3">
            {flash ? (
              <p
                className="rounded-md border border-border bg-surface px-3 py-2 text-body text-ink"
                role="status"
              >
                {flash}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setFlash(null)
                setView('sell')
              }}
              className="flex min-h-[7.5rem] flex-col items-start justify-center gap-1 rounded-lg border border-border bg-ink px-5 py-4 text-left text-surface active:opacity-90"
            >
              <Banknote className="size-7" aria-hidden />
              <span className="text-[20px] font-semibold">Eladás</span>
              <span className="text-[13px] text-surface/75">
                Scan, keresés, készpénz / kártya
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFlash(null)
                setCheckProduct(null)
                setCheckMsg(null)
                setView('check')
              }}
              className="flex min-h-[7.5rem] flex-col items-start justify-center gap-1 rounded-lg border border-border bg-surface px-5 py-4 text-left active:bg-subtle"
            >
              <Tag className="size-7 text-ink" aria-hidden />
              <span className="text-[20px] font-semibold text-ink">
                Árellenőrzés
              </span>
              <span className="text-[13px] text-ink-secondary">
                Vonalkód / keresés → név, ár, készlet
              </span>
            </button>
            <div className="mt-auto space-y-2 pt-4">
              <label className="block space-y-1">
                <span className="text-hint text-ink-muted">Raktár</span>
                <select
                  className="h-12 w-full rounded-md border border-border bg-surface px-3 text-body"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-hint text-ink-muted">
                  Pénztár (shared műszak)
                </span>
                <select
                  className="h-12 w-full rounded-md border border-border bg-surface px-3 text-body"
                  value={registerId}
                  onChange={(e) => setRegisterId(e.target.value)}
                >
                  {registers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </PdaScroll>
        </>
      ) : null}

      {view === 'check' ? (
        <>
          <PdaTopbar title="Árellenőrzés" onBack={() => setView('hub')} />
          <div className="shrink-0 space-y-2 border-b border-border px-4 py-3">
            <p className="text-hint text-emerald-700">Szkenner aktív</p>
            <PdaProductSearch
              warehouseId={warehouseId}
              onPick={(p) => {
                setCheckProduct(p)
                setCheckMsg(null)
                setFlash(null)
              }}
              onBarcodeFallback={(code) => {
                void handleScan(code)
              }}
              onFocusChange={setSearchFocused}
            />
          </div>
          <PdaScroll>
            {flash && !checkProduct ? (
              <p className="mb-2 text-body text-danger-ink" role="alert">
                {flash}
              </p>
            ) : null}
            {checkMsg ? (
              <p className="text-body text-danger-ink" role="alert">
                {checkMsg}
              </p>
            ) : null}
            {checkProduct ? (
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-[18px] font-semibold text-ink">
                  {checkProduct.display_name?.trim() || checkProduct.name}
                </p>
                <p className="mt-1 text-hint text-ink-muted">
                  {checkProduct.sku}
                </p>
                <p className="mt-3 text-[32px] font-semibold tabular-nums tracking-tight text-ink">
                  {formatMoneyFt(
                    Math.round(
                      checkProduct.price_net *
                        (1 + checkProduct.tax_rate_percent / 100)
                    )
                  )}{' '}
                  <span className="text-[18px] font-medium text-ink-secondary">
                    Ft
                  </span>
                </p>
                <p className="mt-1 text-body text-ink-secondary">
                  Készlet:{' '}
                  <span className="font-semibold tabular-nums text-ink">
                    {checkProduct.on_hand}
                  </span>{' '}
                  {checkProduct.unit_shortform || 'db'}
                </p>
              </div>
            ) : (
              <p className="text-body text-ink-muted">
                Olvasd be a vonalkódot, vagy keress névre / SKU-ra.
              </p>
            )}
          </PdaScroll>
        </>
      ) : null}

      {view === 'sell' ? (
        <>
          <PdaTopbar
            title="Eladás"
            onBack={() => setView('hub')}
            right={
              <span className="text-hint tabular-nums text-ink-secondary">
                {formatMoneyFt(totals.totalGross)} Ft
              </span>
            }
          />
          <div className="shrink-0 space-y-2 border-b border-border px-4 py-2">
            <PdaCustomerChip
              customerId={customerId}
              customerName={selectedCustomer?.name ?? null}
              onOpen={() => setCustomerSheetOpen(true)}
            />
            <p className="text-hint text-emerald-700">Szkenner aktív</p>
            <PdaProductSearch
              warehouseId={warehouseId}
              onPick={addProduct}
              onBarcodeFallback={(code) => {
                void handleScan(code)
              }}
              onFocusChange={setSearchFocused}
            />
            {flash ? (
              <p
                className="rounded-md border border-border bg-surface px-3 py-2 text-body text-ink"
                role="status"
              >
                {flash}
              </p>
            ) : null}
          </div>
          <PdaScroll>
            {quick.length > 0 ? (
              <div className="mb-3 grid grid-cols-2 gap-2">
                {quick.slice(0, 12).map((p) => {
                  const gross = Math.round(
                    p.price_net * (1 + p.tax_rate_percent / 100)
                  )
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="min-h-[4.5rem] rounded-md border border-border bg-surface px-2.5 py-2 text-left active:bg-subtle"
                    >
                      <span className="line-clamp-2 text-[13px] font-medium text-ink">
                        {p.display_name?.trim() || p.name}
                      </span>
                      <span className="mt-1 block text-[12px] tabular-nums text-ink-muted">
                        {formatMoneyFt(gross)} Ft
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : null}
            <ul className="space-y-2">
              {lines.map((line) => (
                <li
                  key={lineKey(line)}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">
                      {line.name}
                    </p>
                    <p className="text-hint tabular-nums text-ink-muted">
                      {formatMoneyFt(line.unitPriceGross)} Ft /{' '}
                      {line.unitShortform}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="flex size-11 items-center justify-center rounded-md border border-border text-lg font-semibold active:bg-subtle"
                      onClick={() =>
                        setLines((prev) =>
                          prev
                            .map((l) =>
                              lineKey(l) === lineKey(line)
                                ? {
                                    ...l,
                                    quantity: Math.max(0, l.quantity - 1)
                                  }
                                : l
                            )
                            .filter((l) => l.quantity > 0)
                        )
                      }
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-[16px] font-semibold tabular-nums">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      className="flex size-11 items-center justify-center rounded-md border border-border text-lg font-semibold active:bg-subtle"
                      onClick={() =>
                        setLines((prev) =>
                          prev.map((l) =>
                            lineKey(l) === lineKey(line)
                              ? { ...l, quantity: l.quantity + 1 }
                              : l
                          )
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </PdaScroll>
          <PdaDock
            totalGross={totals.totalGross}
            pending={pending}
            empty={lines.length === 0}
            showHandoff
            handoffPending={handoffPending}
            onHandoff={() => {
              void handleHandoff()
            }}
            allowCash={Boolean(posConfig.allowCash && cashMethod)}
            allowCard={Boolean(posConfig.allowCard && cardMethod)}
            onCash={() => openPay('cash')}
            onCard={() => openPay('card')}
          />
        </>
      ) : null}

      {view === 'handoff_ok' && handoffCode ? (
        <PdaHandoffSuccess
          code={handoffCode}
          onNewCart={() => {
            setHandoffCode(null)
            setFlash(null)
            setView('sell')
          }}
          onHub={() => {
            setHandoffCode(null)
            setFlash(`Átadva · ${handoffCode}`)
            setView('hub')
          }}
        />
      ) : null}

      <PdaCustomerSheet
        open={customerSheetOpen}
        onClose={() => setCustomerSheetOpen(false)}
        customerId={customerId}
        customerSeed={customers}
        onChange={(id, customer) => {
          setCustomerId(id)
          if (customer) {
            setCustomers((prev) =>
              prev.some((c) => c.id === customer.id)
                ? prev
                : [customer, ...prev]
            )
          }
        }}
      />

      <PosConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!pending) setConfirmOpen(open)
        }}
        mode={payMode}
        lines={lines}
        fees={[]}
        globalDiscPct={0}
        cashMethodId={cashMethod?.id ?? null}
        cardMethodId={cardMethod?.id ?? null}
        cashMethodName={cashMethod?.name ?? 'Készpénz'}
        cardMethodName={cardMethod?.name ?? 'Kártya'}
        warehouseName={
          warehouses.find((w) => w.id === warehouseId)?.name ?? '—'
        }
        customerId={customerId}
        customerName={selectedCustomer?.name ?? null}
        customerSeed={customers}
        onCustomerChange={(id, customer) => {
          setCustomerId(id)
          if (customer) {
            setCustomers((prev) =>
              prev.some((c) => c.id === customer.id)
                ? prev
                : [customer, ...prev]
            )
          }
        }}
        invoice={false}
        billing={null}
        overstockCount={0}
        registerId={registerId}
        loading={pending}
        variant="pda"
        onConfirm={handleConfirm}
      />
    </PdaShell>
  )
}

function PdaTopbar({
  title,
  onBack,
  right
}: {
  title: string
  onBack: () => void
  right?: React.ReactNode
}) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-11 w-11 shrink-0 px-0"
        onClick={onBack}
        aria-label="Vissza"
      >
        <ArrowLeft className="size-5" />
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ink">
        {title}
      </h1>
      {right}
    </header>
  )
}
