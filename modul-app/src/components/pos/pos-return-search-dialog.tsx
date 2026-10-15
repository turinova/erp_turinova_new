'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { ChevronDown, Search } from 'lucide-react'

import { SaleReturnDialog } from '@/components/sales/sale-return-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { looksLikeBarcode } from '@/lib/pos/barcode'
import { fetchPosBarcodeLookupCached } from '@/lib/pos/pos-barcode-client'
import { searchPosProductsClient } from '@/lib/pos/search-client'
import {
  getSaleForReturnAction,
  searchSalesForReturnAction,
  searchSalesForReturnByProductAction,
  type SaleReturnSearchHit
} from '@/lib/sales/actions'
import { formatMoneyFt } from '@/lib/sales/parse'
import type {
  SaleDetail,
  SaleProductSearchItem,
  SaleReturnByProductHit
} from '@/lib/sales/queries'
import type { ReturnDateWindow } from '@/lib/sales/return-search'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 200

const DATE_CHIPS: { id: ReturnDateWindow; label: string }[] = [
  { id: 'today', label: 'Ma' },
  { id: 'yesterday', label: 'Tegnap' },
  { id: '7d', label: '7 nap' },
  { id: '30d', label: '30 nap' }
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouseId: string
  paymentMethods: PaymentMethodOption[]
}

function formatQty(n: number) {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

function formatSaleWhen(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round(
    (startToday.getTime() - startThat.getTime()) / 86_400_000
  )
  const time = d.toLocaleTimeString('hu-HU', {
    hour: '2-digit',
    minute: '2-digit'
  })
  if (diffDays === 0) return `Ma ${time}`
  if (diffDays === 1) return `Tegnap ${time}`
  return (
    d.toLocaleDateString('hu-HU', {
      month: 'short',
      day: 'numeric'
    }) +
    ' ' +
    time
  )
}

export function PosReturnSearchDialog({
  open,
  onOpenChange,
  warehouseId,
  paymentMethods
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [productHits, setProductHits] = useState<SaleProductSearchItem[]>([])
  const [productPending, setProductPending] = useState(false)
  const [productError, setProductError] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] =
    useState<SaleProductSearchItem | null>(null)
  const [dateWindow, setDateWindow] = useState<ReturnDateWindow>('7d')
  const [saleHits, setSaleHits] = useState<SaleReturnByProductHit[]>([])
  const [saleError, setSaleError] = useState<string | null>(null)
  const [salePending, startSaleTransition] = useTransition()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [advQ, setAdvQ] = useState('')
  const [advHits, setAdvHits] = useState<SaleReturnSearchHit[]>([])
  const [advPending, startAdvTransition] = useTransition()
  const [advError, setAdvError] = useState<string | null>(null)
  const [detail, setDetail] = useState<SaleDetail | null>(null)
  const [preferItemId, setPreferItemId] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [loadDetailPending, startLoadDetail] = useTransition()
  const productReq = useRef(0)
  const productTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dateWindowPrev = useRef<ReturnDateWindow>('7d')

  const resetAll = useCallback(() => {
    setQ('')
    setProductHits([])
    setProductError(null)
    setSelectedProduct(null)
    setDateWindow('7d')
    dateWindowPrev.current = '7d'
    setSaleHits([])
    setSaleError(null)
    setAdvancedOpen(false)
    setAdvQ('')
    setAdvHits([])
    setAdvError(null)
    setDetail(null)
    setPreferItemId(null)
    setWizardOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    resetAll()
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, resetAll])

  const openWizard = useCallback(
    (saleId: string, itemId: string | null, errTarget: 'sale' | 'adv') => {
      startLoadDetail(async () => {
        const result = await getSaleForReturnAction(saleId)
        if (!result.ok) {
          if (errTarget === 'adv') setAdvError(result.message)
          else setSaleError(result.message)
          return
        }
        setDetail(result.detail)
        setPreferItemId(itemId)
        setWizardOpen(true)
      })
    },
    []
  )

  const loadSalesForProduct = useCallback(
    (
      product: SaleProductSearchItem,
      window: ReturnDateWindow,
      autoOpenSingle: boolean
    ) => {
      if (product.kind !== 'product') {
        setSaleError('Anyag visszáruhoz használd a haladó keresőt.')
        setSaleHits([])
        return
      }
      startSaleTransition(async () => {
        const result = await searchSalesForReturnByProductAction(
          product.id,
          warehouseId,
          window
        )
        if (!result.ok) {
          setSaleError(result.message)
          setSaleHits([])
          return
        }
        setSaleError(null)
        setSaleHits(result.rows)
        if (autoOpenSingle && result.rows.length === 1) {
          const hit = result.rows[0]!
          openWizard(hit.saleId, hit.itemId, 'sale')
        }
      })
    },
    [warehouseId, openWizard]
  )

  const pickProduct = useCallback(
    (product: SaleProductSearchItem) => {
      if (product.kind !== 'product') {
        setProductError(
          'Csak termék (nem tábla/szál) visszáruzható ezen az úton.'
        )
        return
      }
      setSelectedProduct(product)
      setProductHits([])
      setQ(product.display_name?.trim() || product.name)
      setProductError(null)
      loadSalesForProduct(product, dateWindow, true)
    },
    [dateWindow, loadSalesForProduct]
  )

  const runProductSearch = useCallback(
    async (term: string) => {
      const t = term.trim()
      const minLen = /^\d+$/.test(t) ? 4 : 2
      if (t.length < minLen || !warehouseId) {
        setProductHits([])
        setProductPending(false)
        return
      }
      if (looksLikeBarcode(t)) {
        setProductHits([])
        setProductPending(false)
        return
      }
      const id = ++productReq.current
      setProductPending(true)
      setProductError(null)
      const res = await searchPosProductsClient(t, warehouseId, {
        kind: 'product',
        includeMaterials: false,
        limit: 12,
        stockFirst: false
      })
      if (id !== productReq.current) return
      setProductPending(false)
      if (!res.ok) {
        setProductError(res.message)
        setProductHits([])
        return
      }
      setProductHits(res.rows)
    },
    [warehouseId]
  )

  useEffect(() => {
    if (!open || selectedProduct) return
    if (productTimer.current) clearTimeout(productTimer.current)
    productTimer.current = setTimeout(() => {
      void runProductSearch(q)
    }, DEBOUNCE_MS)
    return () => {
      if (productTimer.current) clearTimeout(productTimer.current)
    }
  }, [q, open, selectedProduct, runProductSearch])

  useEffect(() => {
    if (!open || !selectedProduct) return
    if (dateWindowPrev.current === dateWindow) return
    dateWindowPrev.current = dateWindow
    loadSalesForProduct(selectedProduct, dateWindow, true)
  }, [dateWindow, open, selectedProduct, loadSalesForProduct])

  useEffect(() => {
    if (!open || !advancedOpen) return
    const safe = advQ.trim()
    if (safe.length < 1) {
      setAdvHits([])
      return
    }
    const handle = window.setTimeout(() => {
      startAdvTransition(async () => {
        const result = await searchSalesForReturnAction(safe)
        if (!result.ok) {
          setAdvError(result.message)
          setAdvHits([])
          return
        }
        setAdvError(null)
        setAdvHits(result.rows)
      })
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [advQ, open, advancedOpen])

  async function onProductEnter() {
    const t = q.trim()
    if (!t || !warehouseId) return
    if (looksLikeBarcode(t) || productHits.length === 0) {
      setProductPending(true)
      setProductError(null)
      const res = await fetchPosBarcodeLookupCached(t, warehouseId)
      setProductPending(false)
      if (!res.ok) {
        setProductError(res.message)
        return
      }
      pickProduct(res.product)
      return
    }
    if (productHits[0]) pickProduct(productHits[0])
  }

  const showProductStep = !selectedProduct
  const windowLabel =
    DATE_CHIPS.find((c) => c.id === dateWindow)?.label ?? '7 nap'

  return (
    <>
      <Dialog
        open={open && !wizardOpen}
        onOpenChange={(next) => {
          if (loadDetailPending) return
          onOpenChange(next)
        }}
      >
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-10">
            <DialogTitle>Visszáru</DialogTitle>
            <p className="mt-1 text-hint text-ink-secondary">
              Olvasd be vagy keresd a visszahozott terméket — nem kell az eladás
              száma.
            </p>
          </DialogHeader>

          <div className="shrink-0 space-y-2 border-b border-border px-4 py-3">
            <label className="sr-only" htmlFor="pos-return-product-q">
              Visszahozott termék
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <Input
                ref={inputRef}
                id="pos-return-product-q"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  if (selectedProduct) {
                    setSelectedProduct(null)
                    setSaleHits([])
                    setSaleError(null)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void onProductEnter()
                  }
                }}
                placeholder="Vonalkód vagy termék neve…"
                className="pl-8"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {DATE_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-hint font-medium transition-colors',
                    dateWindow === chip.id
                      ? 'border-ink bg-ink text-surface'
                      : 'border-border bg-surface text-ink-secondary hover:bg-subtle'
                  )}
                  onClick={() => setDateWindow(chip.id)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {productError ? (
              <p className="px-4 py-3 text-body text-danger-ink" role="alert">
                {productError}
              </p>
            ) : null}
            {saleError ? (
              <p className="px-4 py-3 text-body text-danger-ink" role="alert">
                {saleError}
              </p>
            ) : null}

            {showProductStep ? (
              <>
                {!q.trim() ? (
                  <p className="px-4 py-6 text-body text-ink-secondary">
                    A vevő mit hozott vissza? Olvasd be a vonalkódot, vagy írd be
                    a nevét.
                  </p>
                ) : null}
                {q.trim() &&
                productHits.length === 0 &&
                !productPending &&
                !looksLikeBarcode(q.trim()) ? (
                  <p className="px-4 py-6 text-body text-ink-secondary">
                    Nincs ilyen termék.
                  </p>
                ) : null}
                <ul className="divide-y divide-border">
                  {productHits.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-subtle"
                        onClick={() => pickProduct(row)}
                      >
                        <span className="min-w-0">
                          <span className="font-medium text-ink">
                            {row.display_name?.trim() || row.name}
                          </span>
                          {row.sku ? (
                            <span className="mt-0.5 block text-hint text-ink-secondary">
                              {row.sku}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-hint tabular-nums text-ink-secondary">
                          {formatMoneyFt(
                            row.price_gross ??
                              Math.round(
                                row.price_net * (1 + row.tax_rate_percent / 100)
                              )
                          )}{' '}
                          Ft
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {productPending ? (
                  <p className="px-4 py-3 text-hint text-ink-muted">Keresés…</p>
                ) : null}
              </>
            ) : (
              <>
                <div className="border-b border-border bg-subtle/40 px-4 py-2">
                  <p className="text-body font-medium text-ink">
                    {selectedProduct?.display_name?.trim() ||
                      selectedProduct?.name}
                  </p>
                  <p className="text-hint text-ink-secondary">
                    Eladások · {windowLabel}
                    {salePending || loadDetailPending ? ' · betöltés…' : ''}
                  </p>
                </div>
                {!salePending &&
                saleHits.length === 0 &&
                !saleError &&
                selectedProduct ? (
                  <p className="px-4 py-6 text-body text-ink-secondary">
                    Nem találtam visszaadható eladást ebben az időszakban.
                    Próbáld a hosszabb dátumot, vagy a haladó keresőt.
                  </p>
                ) : null}
                <ul className="divide-y divide-border">
                  {saleHits.map((row) => (
                    <li key={`${row.saleId}-${row.itemId}`}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-subtle disabled:opacity-50"
                        disabled={loadDetailPending}
                        onClick={() =>
                          openWizard(row.saleId, row.itemId, 'sale')
                        }
                      >
                        <span className="min-w-0">
                          <span className="font-semibold text-ink">
                            {formatSaleWhen(row.fulfilledAt)}
                          </span>
                          <span className="mt-0.5 block text-hint text-ink-secondary">
                            {row.customerName?.trim() || 'Vendég'}
                            {' · '}
                            visszaadható {formatQty(row.quantityReturnable)} /{' '}
                            {formatQty(row.quantitySold)} db
                            {' · '}
                            {formatMoneyFt(row.unitPriceGross)} Ft/db
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-ink">
                          {formatMoneyFt(row.saleTotalGross)} Ft
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="border-t border-border">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-hint font-medium text-ink-secondary hover:bg-subtle"
                onClick={() => setAdvancedOpen((o) => !o)}
                aria-expanded={advancedOpen}
              >
                Haladó: eladás szám / ügyfél
                <ChevronDown
                  className={cn(
                    'size-3.5 transition-transform',
                    advancedOpen && 'rotate-180'
                  )}
                  aria-hidden
                />
              </button>
              {advancedOpen ? (
                <div className="border-t border-border px-4 pb-3 pt-2">
                  <Input
                    value={advQ}
                    onChange={(e) => setAdvQ(e.target.value)}
                    placeholder="E-2026-001 / ügyfél…"
                    className="mb-2"
                  />
                  {advError ? (
                    <p className="mb-2 text-hint text-danger-ink" role="alert">
                      {advError}
                    </p>
                  ) : null}
                  {!advQ.trim() ? (
                    <p className="text-hint text-ink-muted">
                      Csak ha megvan az eladás száma vagy az ügyfél neve.
                    </p>
                  ) : null}
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {advHits.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-subtle"
                          disabled={loadDetailPending}
                          onClick={() => openWizard(row.id, null, 'adv')}
                        >
                          <span>
                            <span className="font-semibold text-ink">
                              {row.sale_number}
                            </span>
                            <span className="mt-0.5 block text-hint text-ink-secondary">
                              {row.customer_name ?? 'Vendég'}
                              {' · '}
                              {formatSaleWhen(row.fulfilled_at)}
                            </span>
                          </span>
                          <span className="font-semibold tabular-nums text-ink">
                            {formatMoneyFt(row.total_gross)} Ft
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {advPending ? (
                    <p className="mt-2 text-hint text-ink-muted">Keresés…</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Mégse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detail ? (
        <SaleReturnDialog
          open={wizardOpen}
          onOpenChange={(next) => {
            setWizardOpen(next)
            if (!next) {
              setDetail(null)
              setPreferItemId(null)
            }
          }}
          detail={detail}
          paymentMethods={paymentMethods}
          preferItemId={preferItemId}
          onSuccess={() => {
            onOpenChange(false)
            resetAll()
          }}
        />
      ) : null}
    </>
  )
}
