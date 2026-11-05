'use client'

import { forwardRef, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Barcode, ChevronDown, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect, type MenuSelectOption } from '@/components/ui/menu-select'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

/** Egy rács minden tételnek: Termék | Menny.+egys. | Bruttó/egys. | Beszállító | Összeg | Törlés */
export const CSO_LINE_GRID =
  'lg:grid lg:grid-cols-[minmax(14rem,1fr)_7.5rem_8rem_12rem_7rem_2rem] lg:items-start lg:gap-x-3'

const QTY_MAX = 9999

export type CsoDraftLine = {
  key: string
  name: string
  sku: string
  qty: number
  unitShortform: string
  /** Bruttó egységár (Ft) — amit a vevőnek mondasz. */
  unitPriceGross: number | null
  accessoryId: string | null
  supplierId: string | null
  note: string
}

export function csoLineGross(
  unitPriceGross: number | null,
  qty: number
): number {
  if (unitPriceGross == null || !Number.isFinite(unitPriceGross)) return 0
  return Math.round(unitPriceGross * qty)
}

export function csoHasPrice(unitPriceGross: number | null): boolean {
  return unitPriceGross != null && unitPriceGross > 0
}

function formatQty(qty: number): string {
  return qty.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

export function CsoLineListHeader() {
  return (
    <div
      className={cn(
        'hidden border-b border-border px-3 py-2 text-label text-ink-secondary',
        CSO_LINE_GRID
      )}
    >
      <span>Termék</span>
      <span>Mennyiség</span>
      <span className="text-right">Bruttó / egys.</span>
      <span>Beszállító</span>
      <span className="text-right">Összeg</span>
      <span className="sr-only">Művelet</span>
    </div>
  )
}

/** Lista utolsó sora: új szabad tétel. */
export function CsoAddFreeLineRow({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex w-full items-center gap-1.5 border-t border-border px-3 py-2 text-left text-body text-ink-secondary transition-colors duration-fast hover:bg-subtle hover:text-ink"
    >
      <Plus className="size-3.5" aria-hidden />
      Szabad tétel
      <span className="ml-1 text-ink-muted">— ha nincs a katalógusban</span>
    </button>
  )
}

type EditorRowProps = {
  index: number
  line: CsoDraftLine
  canWrite: boolean
  supplierOptions: MenuSelectOption[]
  supplierSearchable: boolean
  unitOptions: MenuSelectOption[]
  nameError?: string
  /** Új szabad tétel: fókusz a névmezőn. */
  autoFocusName?: boolean
  onChange: (patch: Partial<CsoDraftLine>) => void
  onRemove: () => void
  /** Enter az utolsó mezőn → új szabad tétel. */
  onEnterNext?: () => void
}

export function CsoLineEditorRow({
  index,
  line,
  canWrite,
  supplierOptions,
  supplierSearchable,
  unitOptions,
  nameError,
  autoFocusName,
  onChange,
  onRemove,
  onEnterNext
}: EditorRowProps) {
  const n = index + 1
  const isCatalog = Boolean(line.accessoryId)
  const hasName = line.name.trim().length > 0
  const missingPrice = (isCatalog || hasName) && !csoHasPrice(line.unitPriceGross)
  const missingSupplier = isCatalog && !line.supplierId
  const hasGap = missingPrice || missingSupplier
  const total = csoLineGross(line.unitPriceGross, line.qty)

  const nameRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)
  const [showSku, setShowSku] = useState(() => line.sku.trim().length > 0)

  useEffect(() => {
    if (!autoFocusName || !canWrite) return
    nameRef.current?.focus()
  }, [autoFocusName, canWrite])

  function focusSelect(el: HTMLInputElement | null) {
    el?.focus()
    el?.select()
  }

  return (
    <div
      className={cn(
        'relative flex flex-wrap items-start gap-2 px-3 py-2',
        CSO_LINE_GRID
      )}
    >
      {hasGap ? (
        <span
          className="absolute inset-y-0 left-0 w-[3px] bg-warning"
          aria-hidden
        />
      ) : null}

      {/* Termék */}
      <div className="order-1 min-w-0 basis-[calc(100%-2.5rem)] lg:order-none lg:basis-auto">
        {isCatalog ? (
          <div className="pt-1">
            <p className="whitespace-normal break-words text-[14px] font-semibold leading-snug text-ink">
              {line.name}
            </p>
            <p className="mt-0.5 break-all text-body text-ink-secondary">
              <span className="font-mono">{line.sku || 'nincs SKU'}</span>
              <span aria-hidden> · </span>
              Katalógus
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="relative">
              <Input
                ref={nameRef}
                id={`cso-name-${line.key}`}
                value={line.name}
                disabled={!canWrite}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="Mit kér a vevő?"
                className={cn('font-semibold', !showSku && canWrite && 'pr-8')}
                aria-label={`Tétel ${n} neve`}
                aria-invalid={Boolean(nameError)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  focusSelect(qtyRef.current)
                }}
              />
              {!showSku && canWrite ? (
                <button
                  type="button"
                  tabIndex={-1}
                  title="SKU megadása"
                  aria-label={`Tétel ${n} SKU megadása`}
                  className="absolute right-1 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-ink-muted hover:bg-subtle hover:text-ink"
                  onClick={() => setShowSku(true)}
                >
                  <Barcode className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
            {showSku ? (
              <Input
                id={`cso-sku-${line.key}`}
                value={line.sku}
                disabled={!canWrite}
                onChange={(e) => onChange({ sku: e.target.value })}
                placeholder="SKU"
                aria-label={`Tétel ${n} SKU`}
                className="h-7 max-w-[12rem] font-mono text-body"
                autoFocus={!line.sku}
              />
            ) : null}
          </div>
        )}
        {nameError ? (
          <p className="mt-0.5 text-body text-danger-ink">{nameError}</p>
        ) : null}
      </div>

      {/* Mennyiség + egység */}
      <div className="order-3 lg:order-none">
        <QtyUnitField
          ref={qtyRef}
          line={line}
          n={n}
          canWrite={canWrite}
          unitEditable={!isCatalog && unitOptions.length > 0}
          unitOptions={unitOptions}
          onChange={onChange}
          onEnter={() => focusSelect(priceRef.current)}
        />
      </div>

      {/* Bruttó / egység */}
      <div className="order-4 w-[8rem] lg:order-none lg:w-auto">
        <PriceInput
          ref={priceRef}
          line={line}
          n={n}
          canWrite={canWrite}
          missingPrice={missingPrice}
          onChange={onChange}
          onEnter={onEnterNext}
        />
      </div>

      {/* Beszállító */}
      <div className="order-6 w-full min-w-0 lg:order-none lg:w-auto">
        <MenuSelect
          id={`cso-supplier-${line.key}`}
          value={line.supplierId ?? ''}
          onChange={(v) => onChange({ supplierId: v || null })}
          allowEmpty
          emptyLabel="Nincs beszállító"
          placeholder={isCatalog ? 'Válassz…' : '—'}
          searchable={supplierSearchable}
          options={supplierOptions}
          disabled={!canWrite}
          submitOnEnter={onEnterNext}
          triggerClassName={cn(
            missingSupplier && 'border-warning text-warning-ink'
          )}
        />
      </div>

      {/* Összeg */}
      <div className="order-5 ml-auto pt-1.5 text-right lg:order-none lg:ml-0">
        <LineTotal missingPrice={missingPrice} total={total} />
      </div>

      {/* Törlés */}
      <div className="order-2 flex justify-end lg:order-none">
        {canWrite ? (
          <Button
            type="button"
            variant="ghost"
            size="md"
            className="w-8 px-0 text-ink-muted hover:text-ink"
            aria-label={`Tétel ${n} törlése`}
            onClick={onRemove}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function parseQtyDraft(raw: string): number | null {
  const v = Number(raw.trim().replace(',', '.'))
  if (!Number.isFinite(v) || v <= 0) return null
  return Math.min(QTY_MAX, v)
}

/** Összenőtt mennyiség + egység: [ 1250 | db ▾ ] */
const QtyUnitField = forwardRef<
  HTMLInputElement,
  {
    line: CsoDraftLine
    n: number
    canWrite: boolean
    unitEditable: boolean
    unitOptions: MenuSelectOption[]
    onChange: (patch: Partial<CsoDraftLine>) => void
    onEnter: () => void
  }
>(function QtyUnitField(
  { line, n, canWrite, unitEditable, unitOptions, onChange, onEnter },
  ref
) {
  const [draft, setDraft] = useState(() => formatQtyInput(line.qty))

  useEffect(() => {
    setDraft((prev) =>
      parseQtyDraft(prev) === line.qty ? prev : formatQtyInput(line.qty)
    )
  }, [line.qty])

  function commit() {
    const v = parseQtyDraft(draft)
    if (v == null) {
      setDraft(formatQtyInput(line.qty))
      return
    }
    setDraft(formatQtyInput(v))
    if (v !== line.qty) onChange({ qty: v })
  }

  return (
    <div
      className={cn(
        'flex h-8 w-[7.5rem] items-stretch overflow-hidden rounded-md border border-border bg-surface transition-colors duration-fast',
        'hover:border-border-strong focus-within:border-border-strong focus-within:ring-1 focus-within:ring-primary/25',
        !canWrite && 'bg-subtle'
      )}
    >
      <input
        ref={ref}
        id={`cso-qty-${line.key}`}
        type="text"
        inputMode="decimal"
        maxLength={5}
        value={draft}
        disabled={!canWrite}
        aria-label={`Tétel ${n} mennyiség`}
        className="w-[3.25rem] min-w-0 bg-transparent px-2 text-right text-body tabular-nums text-ink outline-none disabled:cursor-not-allowed disabled:text-ink-disabled"
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,]/g, '')
          setDraft(raw)
          const v = parseQtyDraft(raw)
          if (v != null) onChange({ qty: v })
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const step = e.key === 'ArrowUp' ? 1 : -1
            const next = Math.min(QTY_MAX, Math.max(1, line.qty + step))
            setDraft(formatQtyInput(next))
            onChange({ qty: next })
            return
          }
          if (e.key !== 'Enter') return
          e.preventDefault()
          commit()
          onEnter()
        }}
      />
      <div className="relative flex-1 border-l border-border">
        {unitEditable ? (
          <>
            <select
              id={`cso-unit-${line.key}`}
              value={line.unitShortform}
              disabled={!canWrite}
              aria-label={`Tétel ${n} mennyiségi egység`}
              onChange={(e) => onChange({ unitShortform: e.target.value })}
              className="h-full w-full cursor-pointer appearance-none bg-transparent pl-2 pr-6 text-body text-ink outline-none disabled:cursor-not-allowed disabled:text-ink-disabled"
            >
              {unitOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-1.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
          </>
        ) : (
          <span className="flex h-full items-center bg-subtle px-2 text-body text-ink-secondary">
            {line.unitShortform || 'db'}
          </span>
        )}
      </div>
    </div>
  )
})

function formatQtyInput(qty: number): string {
  return String(qty).replace('.', ',')
}

const PriceInput = forwardRef<
  HTMLInputElement,
  {
    line: CsoDraftLine
    n: number
    canWrite: boolean
    missingPrice: boolean
    onChange: (patch: Partial<CsoDraftLine>) => void
    onEnter?: () => void
  }
>(function PriceInput(
  { line, n, canWrite, missingPrice, onChange, onEnter },
  ref
) {
  return (
    <div className="relative w-full">
      <Input
        ref={ref}
        id={`cso-price-${line.key}`}
        type="number"
        min={0}
        step={1}
        value={line.unitPriceGross == null ? '' : line.unitPriceGross}
        disabled={!canWrite}
        onChange={(e) => {
          const raw = e.target.value.trim()
          if (raw === '') {
            onChange({ unitPriceGross: null })
            return
          }
          const v = Number(raw.replace(',', '.'))
          onChange({
            unitPriceGross: Number.isFinite(v) && v >= 0 ? Math.round(v) : null
          })
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || !onEnter) return
          e.preventDefault()
          onEnter()
        }}
        placeholder="Bruttó ár"
        className={cn(
          'pr-7 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          missingPrice && 'border-warning'
        )}
        aria-label={`Tétel ${n} bruttó egységár (Ft / ${line.unitShortform || 'db'})`}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-body text-ink-secondary">
        Ft
      </span>
    </div>
  )
})

function LineTotal({
  missingPrice,
  total
}: {
  missingPrice: boolean
  total: number
}) {
  if (missingPrice) {
    return <span className="text-body font-semibold text-warning-ink">Ár kell</span>
  }
  return (
    <span className="whitespace-nowrap text-[14px] font-semibold tabular-nums text-ink">
      {formatMoneyFt(total)}{' '}
      <span className="text-body font-normal text-ink-secondary">Ft</span>
    </span>
  )
}

export type CsoSummaryState = 'open' | 'handed_over' | 'cancelled'

type SummaryProps = {
  itemCount: number
  qtyByUnit: Array<{ unit: string; qty: number }>
  totalGross: number
  deposit: number | null
  missingPriceCount: number
  missingSupplierCount?: number
  /** Szerkeszthető előleg (új rendelés). */
  depositField?: {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    error?: string
  }
  state?: CsoSummaryState
}

/** Tételtáblázat lábléce: részösszeg, előleg, átvételkor fizetendő. */
export function CsoSummaryFooter({
  itemCount,
  qtyByUnit,
  totalGross,
  deposit,
  missingPriceCount,
  missingSupplierCount = 0,
  depositField,
  state = 'open'
}: SummaryProps) {
  const hasDeposit = deposit != null && deposit > 0
  const due = Math.max(0, totalGross - (hasDeposit ? (deposit ?? 0) : 0))
  const showBreakdown = hasDeposit || Boolean(depositField)
  const provisional = missingPriceCount > 0 && state === 'open'
  const coveredByDeposit = hasDeposit && due === 0 && totalGross > 0
  const qtyText = qtyByUnit
    .map((q) => `${formatQty(q.qty)} ${q.unit}`)
    .join(' + ')

  const heroLabel =
    state === 'handed_over'
      ? 'Elszámolva átadáskor'
      : state === 'cancelled'
        ? 'Lemondva'
        : 'Átvételkor fizet'

  return (
    <div
      className="border-t border-border bg-surface px-3 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <p className="text-body text-ink-secondary">
            <span className="font-semibold tabular-nums text-ink">
              {itemCount}
            </span>{' '}
            tétel
            {qtyText ? <span> · {qtyText}</span> : null}
          </p>
          {provisional ? (
            <p className="flex items-center gap-1.5 text-body font-medium text-warning-ink">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              {missingPriceCount} tételnél hiányzik az ár
            </p>
          ) : null}
          {missingSupplierCount > 0 && state === 'open' ? (
            <p className="flex items-center gap-1.5 text-body font-medium text-warning-ink">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              {missingSupplierCount} tételnél nincs beszállító
            </p>
          ) : null}
        </div>

        <dl className="grid w-full shrink-0 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 sm:w-[20rem]">
          {showBreakdown ? (
            <>
              <dt className="text-body text-ink-secondary">
                Részösszeg <span className="text-ink-muted">(bruttó)</span>
              </dt>
              <dd className="whitespace-nowrap text-right text-body tabular-nums text-ink">
                {formatMoneyFt(totalGross)} Ft
              </dd>
              <dt className="text-body text-ink-secondary">
                <label htmlFor={depositField ? 'cso-deposit-footer' : undefined}>
                  Előleg
                </label>
              </dt>
              <dd className="text-right">
                {depositField ? (
                  <div className="relative ml-auto w-[8rem]">
                    <Input
                      id="cso-deposit-footer"
                      value={depositField.value}
                      disabled={depositField.disabled}
                      onChange={(e) => depositField.onChange(e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                      className="pr-7 text-right tabular-nums"
                      aria-invalid={Boolean(depositField.error)}
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-body text-ink-secondary">
                      Ft
                    </span>
                  </div>
                ) : (
                  <span className="whitespace-nowrap text-body tabular-nums text-ink">
                    −{formatMoneyFt(deposit ?? 0)} Ft
                  </span>
                )}
              </dd>
              {depositField?.error ? (
                <p className="col-span-2 text-right text-body text-danger-ink">
                  {depositField.error}
                </p>
              ) : null}
              <div className="col-span-2 border-t border-border" aria-hidden />
            </>
          ) : null}

          <dt className="text-body font-semibold text-ink">
            {heroLabel}
            {provisional ? (
              <span className="block text-hint font-normal text-warning-ink">
                nem végleges
              </span>
            ) : coveredByDeposit && state === 'open' ? (
              <span className="block text-hint font-normal text-ink-secondary">
                Az előleg fedezi
              </span>
            ) : !showBreakdown ? (
              <span className="block text-hint font-normal text-ink-muted">
                bruttó
              </span>
            ) : null}
          </dt>
          <dd
            className={cn(
              'whitespace-nowrap text-right font-bold leading-none tracking-tight tabular-nums',
              state === 'open' && !coveredByDeposit
                ? 'text-[26px] text-success-ink'
                : 'text-[20px] text-ink-secondary',
              state === 'cancelled' && 'line-through'
            )}
          >
            {formatMoneyFt(due)}{' '}
            <span className="text-body font-normal text-ink-secondary">Ft</span>
          </dd>
        </dl>
      </div>
    </div>
  )
}

export function csoQtyByUnit(
  lines: Array<{ qty: number; unitShortform: string }>
): Array<{ unit: string; qty: number }> {
  const map = new Map<string, number>()
  for (const l of lines) {
    const u = l.unitShortform || 'db'
    map.set(u, (map.get(u) ?? 0) + l.qty)
  }
  return [...map.entries()].map(([unit, qty]) => ({ unit, qty }))
}
