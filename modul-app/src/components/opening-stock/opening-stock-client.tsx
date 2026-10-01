'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { BarcodeWedgeTrap } from '@/components/search/barcode-wedge-trap'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import {
  commitOpeningStockAction,
  lookupOpeningStockBarcodeAction,
  searchOpeningStockAction
} from '@/lib/opening-stock/actions'
import type {
  OpeningStockLineKind,
  OpeningStockSearchItem
} from '@/lib/opening-stock/parse'
import { looksLikeBarcode, prepareBarcodeQuery } from '@/lib/pos/barcode'
import { cn } from '@/lib/utils'

type WarehouseOption = {
  id: string
  name: string
  code: string
  is_default: boolean
}

type Line = {
  key: string
  kind: OpeningStockLineKind
  id: string
  name: string
  sku: string
  unitShortform: string
  quantity: number
  onHand: number
}

type Props = {
  warehouses: WarehouseOption[]
  canWrite: boolean
  includeMaterials: boolean
}

function lineKey(kind: OpeningStockLineKind, id: string) {
  return `${kind}:${id}`
}

function formatQty(n: number) {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

function kindLabel(kind: OpeningStockLineKind) {
  if (kind === 'sheet_material') return 'Tábla'
  if (kind === 'linear_material') return 'Szál'
  return 'Termék'
}

export function OpeningStockClient({
  warehouses,
  canWrite,
  includeMaterials
}: Props) {
  const [pending, startTransition] = useTransition()
  const defaultWh =
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? ''
  const [warehouseId, setWarehouseId] = useState(defaultWh)
  const [lines, setLines] = useState<Line[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchHits, setSearchHits] = useState<OpeningStockSearchItem[]>([])
  const [pendingItem, setPendingItem] = useState<OpeningStockSearchItem | null>(
    null
  )
  const [qtyRaw, setQtyRaw] = useState('1')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  /** Kereső fókuszban = gépelés; különben no-focus wedge. */
  const [searchFocused, setSearchFocused] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const qtyInputRef = useRef<HTMLInputElement>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((w) => ({
        value: w.id,
        label: w.code ? `${w.name} (${w.code})` : w.name
      })),
    [warehouses]
  )

  const showWarehouseSelect = warehouses.length > 1
  const qtyPanelOpen = Boolean(pendingItem)
  const wedgeEnabled =
    canWrite && !qtyPanelOpen && !confirmOpen && !searchFocused

  useEffect(() => {
    if (!pendingItem) return
    const id = window.setTimeout(() => {
      qtyInputRef.current?.focus()
      qtyInputRef.current?.select()
    }, 50)
    return () => window.clearTimeout(id)
  }, [pendingItem])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const q = searchQ.trim()
    if (!q || !warehouseId || pendingItem) {
      setSearchHits([])
      setSearching(false)
      return
    }
    // Exact barcode: ne typeahead-elj scannelés közben — Enter / wedge intézi.
    if (looksLikeBarcode(q) && q.length >= 8) {
      setSearchHits([])
      setSearching(false)
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(() => {
      void (async () => {
        const res = await searchOpeningStockAction(q, warehouseId)
        if (!res.ok) {
          setSearchHits([])
          setSearching(false)
          return
        }
        setSearchHits(res.rows)
        setSearchOpen(true)
        setSearching(false)
      })()
    }, 220)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [searchQ, warehouseId, pendingItem])

  function selectHit(hit: OpeningStockSearchItem) {
    setPendingItem(hit)
    setQtyRaw('1')
    setSearchQ('')
    setSearchOpen(false)
    setSearchHits([])
    setSearchFocused(false)
    searchInputRef.current?.blur()
  }

  function addPending() {
    if (!pendingItem) return
    const qty = Number(String(qtyRaw).replace(',', '.'))
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Adj meg pozitív mennyiséget.')
      qtyInputRef.current?.focus()
      return
    }
    const key = lineKey(pendingItem.kind, pendingItem.id)
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: qty, onHand: pendingItem.onHand } : l
        )
      }
      return [
        {
          key,
          kind: pendingItem.kind,
          id: pendingItem.id,
          name: pendingItem.name,
          sku: pendingItem.sku,
          unitShortform: pendingItem.unitShortform,
          quantity: qty,
          onHand: pendingItem.onHand
        },
        ...prev
      ]
    })
    if (pendingItem.onHand > 0.0001) {
      toast.message(
        `Készleten volt ${formatQty(pendingItem.onHand)} ${pendingItem.unitShortform} — a nyitó hozzáadódik.`
      )
    } else {
      toast.success(`${pendingItem.name} hozzáadva`)
    }
    setPendingItem(null)
    setQtyRaw('1')
    setSearchFocused(false)
  }

  function setLineQty(key: string, quantity: number) {
    setLines((prev) =>
      prev.map((l) =>
        l.key === key ? { ...l, quantity: Math.max(0, quantity) } : l
      )
    )
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  async function handleBarcode(normalized: string) {
    if (!warehouseId || pendingItem || !canWrite) return
    const res = await lookupOpeningStockBarcodeAction(normalized, warehouseId)
    if (res.ok) {
      selectHit(res.item)
      return
    }
    if (res.notFound) {
      setSearchQ(normalized)
      setSearchFocused(true)
      searchInputRef.current?.focus()
      toast.message('Nincs pontos vonalkód-találat — keresés…')
      return
    }
    toast.error(res.message)
  }

  function openConfirm() {
    if (!canWrite) {
      toast.error('Csak megtekintési jogod van.')
      return
    }
    if (!warehouseId) {
      toast.error('Válaszd ki a raktárat.')
      return
    }
    if (lines.length === 0) {
      toast.error('Adj hozzá legalább egy tételt.')
      return
    }
    for (const line of lines) {
      if (!(line.quantity > 0)) {
        toast.error(`Adj meg pozitív mennyiséget: ${line.name}`)
        return
      }
    }
    setFormError(null)
    setConfirmOpen(true)
  }

  function commit() {
    startTransition(async () => {
      const res = await commitOpeningStockAction({
        warehouseId,
        items: lines.map((l) => ({
          kind: l.kind,
          id: l.id,
          quantity: l.quantity
        }))
      })
      if (!res.ok) {
        setFormError(res.message)
        toast.error(res.message)
        return
      }
      setConfirmOpen(false)
      setLines([])
      setSearchFocused(false)
      toast.success(`${res.lineCount} tétel nyitó készlet rögzítve`)
    })
  }

  const onHand = pendingItem?.onHand ?? 0
  const hasStock = onHand > 0.0001

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-lg flex-col overflow-hidden bg-app',
        'h-[calc(100dvh-var(--topbar-height))]'
      )}
    >
      <BarcodeWedgeTrap
        enabled={wedgeEnabled}
        onScan={(normalized) => void handleBarcode(normalized)}
      />

      {/* Compact chrome — always visible */}
      <header className="shrink-0 space-y-2 border-b border-border px-4 pb-2.5 pt-3 md:px-6">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-[15px] font-semibold tracking-tight text-ink">
            Nyitó készlet
          </h1>
          {!qtyPanelOpen ? (
            <p className="text-hint tabular-nums text-ink-muted">
              {lines.length} tétel
            </p>
          ) : null}
        </div>

        {showWarehouseSelect ? (
          <MenuSelect
            id="nyito-wh"
            value={warehouseId}
            options={warehouseOptions}
            allowEmpty={false}
            disabled={!canWrite || pending || qtyPanelOpen}
            onChange={setWarehouseId}
            placeholder="Raktár"
          />
        ) : null}

        {!qtyPanelOpen ? (
          <div ref={searchWrapRef} className="relative">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <Input
                ref={searchInputRef}
                id="nyito-search"
                className="h-11 pl-9 text-[16px]"
                placeholder={
                  includeMaterials
                    ? 'Termék, tábla vagy szál…'
                    : 'Termék név, SKU, vonalkód…'
                }
                value={searchQ}
                disabled={!canWrite || !warehouseId}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Keresés / vonalkód"
                onChange={(e) => {
                  setSearchQ(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => {
                  setSearchFocused(true)
                  if (searchHits.length > 0) setSearchOpen(true)
                }}
                onBlur={() => {
                  window.setTimeout(() => {
                    const el = document.activeElement
                    if (searchWrapRef.current?.contains(el)) return
                    setSearchFocused(false)
                  }, 120)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const hit = searchHits[0]
                    if (hit) {
                      selectHit(hit)
                      return
                    }
                    const { normalized, raw } = prepareBarcodeQuery(searchQ)
                    const code = normalized || raw
                    if (!looksLikeBarcode(code)) return
                    void handleBarcode(code).then(() => {
                      setSearchQ('')
                      setSearchHits([])
                      setSearchOpen(false)
                    })
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setSearchQ('')
                    setSearchHits([])
                    setSearchOpen(false)
                    setSearchFocused(false)
                    searchInputRef.current?.blur()
                  }
                }}
              />
            </div>
            {searchOpen &&
            (searching || searchHits.length > 0 || searchQ.trim()) &&
            !(looksLikeBarcode(searchQ.trim()) && searchQ.trim().length >= 8) ? (
              <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-surface shadow-md">
                {searching ? (
                  <li className="px-3 py-2.5 text-hint text-ink-secondary">
                    Keresés…
                  </li>
                ) : searchHits.length === 0 ? (
                  <li className="px-3 py-2.5 text-hint text-ink-secondary">
                    Nincs találat.
                  </li>
                ) : (
                  searchHits.map((hit) => (
                    <li key={lineKey(hit.kind, hit.id)}>
                      <button
                        type="button"
                        className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-subtle"
                        onClick={() => selectHit(hit)}
                      >
                        <span className="text-[15px] font-medium text-ink">
                          {hit.name}
                        </span>
                        <span className="text-hint text-ink-secondary">
                          {kindLabel(hit.kind)} · {hit.sku} · készleten{' '}
                          {formatQty(hit.onHand)} {hit.unitShortform}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* Middle pane — mutex: qty OR list */}
      {qtyPanelOpen && pendingItem ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-2.5 md:px-6">
          {/* Top-aligned RF stack: identity first (image → name → SKU) */}
          <div className="flex min-h-0 flex-1 flex-col items-stretch justify-start gap-2.5 overflow-y-auto">
            {pendingItem.imageUrl ? (
              <div className="mx-auto size-44 shrink-0 overflow-hidden rounded-md border border-border bg-subtle sm:size-48">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingItem.imageUrl}
                  alt=""
                  className="size-full object-contain"
                />
              </div>
            ) : null}

            <div className="w-full text-center">
              <p className="line-clamp-2 text-[22px] font-semibold leading-snug text-ink">
                {pendingItem.name}
              </p>
              <p className="mt-1 text-[18px] font-semibold tabular-nums tracking-tight text-ink">
                {pendingItem.sku}
              </p>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                {kindLabel(pendingItem.kind)}
              </p>
            </div>

            <div
              className={cn(
                'w-full rounded-md border px-3 py-3 text-center',
                hasStock
                  ? 'border-warning/40 bg-warning-soft'
                  : 'border-border bg-subtle'
              )}
              role="status"
            >
              <p
                className={cn(
                  'text-[12px] font-medium',
                  hasStock
                    ? 'text-warning-ink opacity-90'
                    : 'text-ink-secondary'
                )}
              >
                Készleten most
              </p>
              <p
                className={cn(
                  'mt-1 text-[36px] font-semibold leading-none tracking-tight tabular-nums sm:text-[40px]',
                  hasStock ? 'text-warning-ink' : 'text-ink'
                )}
              >
                {formatQty(onHand)}
                <span className="ml-1.5 text-[18px] font-semibold">
                  {pendingItem.unitShortform}
                </span>
              </p>
              {!hasStock ? (
                <p className="mt-1.5 text-[13px] text-ink-muted">Nincs raktáron</p>
              ) : (
                <p className="mt-1.5 text-[13px] text-warning-ink">
                  A most beírt mennyiség ehhez adódik hozzá.
                </p>
              )}
            </div>

            <div className="w-full">
              <label
                htmlFor="nyito-qty"
                className="mb-1.5 block text-[13px] font-medium text-ink-secondary"
              >
                Mennyiség hozzáadása ({pendingItem.unitShortform})
              </label>
              <Input
                ref={qtyInputRef}
                id="nyito-qty"
                type="number"
                inputMode="decimal"
                min={0.001}
                step="any"
                className="h-14 text-[20px] font-semibold tabular-nums"
                value={qtyRaw}
                onChange={(e) => setQtyRaw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addPending()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setPendingItem(null)
                  }
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 md:px-6">
          {lines.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-subtle px-3 py-6 text-center text-body text-ink-secondary">
              Scannelj bárhol (PDA), vagy keress — a készlet nagyban megjelenik.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
              {lines.map((line) => (
                <li
                  key={line.key}
                  className="flex items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">
                      {line.name}
                    </p>
                    <p className="text-hint text-ink-muted">
                      {kindLabel(line.kind)} · {line.sku} · volt{' '}
                      {formatQty(line.onHand)} {line.unitShortform}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0.001}
                      step="any"
                      className="h-10 w-20 text-right text-[15px] font-semibold tabular-nums"
                      value={line.quantity}
                      disabled={!canWrite || pending}
                      onChange={(e) =>
                        setLineQty(line.key, Number(e.target.value) || 0)
                      }
                    />
                    <span className="w-10 shrink-0 text-hint text-ink-secondary">
                      {line.unitShortform}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 shrink-0"
                      aria-label="Törlés"
                      disabled={!canWrite || pending}
                      onClick={() => removeLine(line.key)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {formError ? (
            <p className="mt-2 text-body text-danger-ink" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      )}

      {/* Flex footer — not fixed overlay */}
      <footer
        className={cn(
          'shrink-0 border-t border-border bg-surface px-4 pt-2.5 md:px-6',
          'pb-[max(env(safe-area-inset-bottom),10px)]'
        )}
      >
        {qtyPanelOpen ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-12 flex-1 text-[15px]"
              onClick={() => setPendingItem(null)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 text-[15px]"
              onClick={addPending}
            >
              Hozzáadás
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-hint tabular-nums text-ink-secondary">
              {lines.length} tétel
            </p>
            <Button
              type="button"
              className="h-11 min-w-[10rem]"
              disabled={!canWrite || pending || lines.length === 0}
              onClick={openConfirm}
            >
              Készlet rögzítése
            </Button>
          </div>
        )}
      </footer>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Nyitó készlet rögzítése?"
        description={`${lines.length} tétel kerül a raktárra korrekcióként. Ez nem vonható vissza.`}
        confirmLabel="Készlet rögzítése"
        cancelLabel="Mégse"
        variant="primary"
        loading={pending}
        onConfirm={commit}
      />
    </div>
  )
}
