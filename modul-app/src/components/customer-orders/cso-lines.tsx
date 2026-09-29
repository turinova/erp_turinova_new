'use client'

import { Minus, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect, type MenuSelectOption } from '@/components/ui/menu-select'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

/** Desktop rács: # | Termék | Beszállító | Mennyiség | Bruttó/egys. | Sor bruttó | Törlés */
export const CSO_LINE_GRID =
  'lg:grid lg:grid-cols-[1.5rem_minmax(0,1fr)_10.5rem_11.5rem_8rem_7.5rem_2rem] lg:items-start lg:gap-x-3'

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
      <span className="text-right">#</span>
      <span>Termék</span>
      <span>Beszállító</span>
      <span>Mennyiség</span>
      <span className="text-right">Bruttó / egys.</span>
      <span className="text-right">Sor bruttó</span>
      <span className="sr-only">Művelet</span>
    </div>
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
  onChange: (patch: Partial<CsoDraftLine>) => void
  onRemove: () => void
}

export function CsoLineEditorRow({
  index,
  line,
  canWrite,
  supplierOptions,
  supplierSearchable,
  unitOptions,
  nameError,
  onChange,
  onRemove
}: EditorRowProps) {
  const isCatalog = Boolean(line.accessoryId)
  const hasName = line.name.trim().length > 0
  const missingPrice = hasName && !csoHasPrice(line.unitPriceGross)
  const missingSupplier = isCatalog && !line.supplierId
  const hasGap = missingPrice || missingSupplier
  const total = csoLineGross(line.unitPriceGross, line.qty)
  const n = index + 1

  return (
    <div
      className={cn(
        'relative space-y-2 border-b border-border px-3 py-2.5 last:border-b-0 lg:space-y-0',
        CSO_LINE_GRID
      )}
    >
      {hasGap ? (
        <span
          className="absolute inset-y-0 left-0 w-[3px] bg-warning"
          aria-hidden
        />
      ) : null}

      <span className="hidden pt-1.5 text-right text-body tabular-nums text-ink-secondary lg:block">
        {n}
      </span>

      {/* Termék: név + SKU (tördelve, sosem levágva) */}
      <div className="flex min-w-0 items-start justify-between gap-2 lg:block">
        <div className="min-w-0 flex-1">
          {isCatalog ? (
            <div className="pt-1">
              <p className="whitespace-normal break-words text-[14px] font-semibold leading-snug text-ink">
                {line.name}
              </p>
              <p className="mt-0.5 whitespace-normal break-all text-body text-ink-secondary">
                <span className="font-mono">{line.sku || 'nincs SKU'}</span>
                <span aria-hidden> · </span>
                Katalógus
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <Input
                id={`cso-name-${line.key}`}
                value={line.name}
                disabled={!canWrite}
                onChange={(e) => onChange({ name: e.target.value })}
                aria-label={`Tétel ${n} neve`}
                placeholder="Termék neve"
                className="font-semibold"
                aria-invalid={Boolean(nameError)}
              />
              <div className="flex items-center gap-1.5">
                <Input
                  id={`cso-sku-${line.key}`}
                  value={line.sku}
                  disabled={!canWrite}
                  onChange={(e) => onChange({ sku: e.target.value })}
                  aria-label={`Tétel ${n} SKU (opcionális)`}
                  placeholder="SKU (ha van)"
                  className="h-7 max-w-[11rem] font-mono text-body"
                />
                <span className="text-body text-ink-secondary">
                  Szabad tétel
                </span>
              </div>
            </div>
          )}
          {nameError ? (
            <p className="mt-0.5 text-body text-danger-ink">{nameError}</p>
          ) : null}
        </div>

        {/* Mobil: sor összeg a név mellett */}
        <div className="shrink-0 pt-1 text-right lg:hidden">
          <LineTotal missingPrice={missingPrice} total={total} />
        </div>
      </div>

      {/* Beszállító */}
      <div className="min-w-0">
        <span className="mb-0.5 block text-label text-ink-secondary lg:sr-only">
          Beszállító
        </span>
        <MenuSelect
          id={`cso-supplier-${line.key}`}
          value={line.supplierId ?? ''}
          onChange={(v) => onChange({ supplierId: v || null })}
          allowEmpty
          emptyLabel="Nincs beszállító"
          placeholder={isCatalog ? 'Válassz beszállítót' : 'Válassz…'}
          searchable={supplierSearchable}
          options={supplierOptions}
          disabled={!canWrite}
          wrap
          triggerClassName={cn(
            missingSupplier && 'border-warning text-warning-ink'
          )}
        />
      </div>

      {/* Mennyiség + egység */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:block">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="w-8 px-0"
            aria-label={`Tétel ${n} mennyiség csökkentése`}
            disabled={!canWrite || line.qty <= 1}
            onClick={() => onChange({ qty: Math.max(1, line.qty - 1) })}
          >
            <Minus className="size-3.5" aria-hidden />
          </Button>
          <Input
            type="number"
            min={1}
            step="any"
            value={line.qty}
            disabled={!canWrite}
            className="w-12 px-1 text-center tabular-nums"
            onChange={(e) => {
              const v = Number(e.target.value)
              onChange({ qty: Number.isFinite(v) && v > 0 ? v : 1 })
            }}
            aria-label={`Tétel ${n} mennyiség`}
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="w-8 px-0"
            aria-label={`Tétel ${n} mennyiség növelése`}
            disabled={!canWrite}
            onClick={() => onChange({ qty: line.qty + 1 })}
          >
            <Plus className="size-3.5" aria-hidden />
          </Button>
          {isCatalog || unitOptions.length === 0 ? (
            <span className="pl-1 text-body text-ink-secondary">
              {line.unitShortform || 'db'}
            </span>
          ) : (
            <MenuSelect
              id={`cso-unit-${line.key}`}
              value={line.unitShortform}
              onChange={(v) => v && onChange({ unitShortform: v })}
              allowEmpty={false}
              options={unitOptions}
              disabled={!canWrite}
              className="w-[4.5rem]"
            />
          )}
        </div>

        {/* Mobil: ár a mennyiség mellett */}
        <div className="lg:hidden">
          <PriceInput
            line={line}
            n={n}
            canWrite={canWrite}
            missingPrice={missingPrice}
            onChange={onChange}
          />
        </div>
      </div>

      <div className="hidden lg:block">
        <PriceInput
          line={line}
          n={n}
          canWrite={canWrite}
          missingPrice={missingPrice}
          onChange={onChange}
        />
      </div>

      <div className="hidden pt-1 text-right lg:block">
        <LineTotal missingPrice={missingPrice} total={total} />
      </div>

      {canWrite ? (
        <div className="hidden lg:flex lg:justify-end">
          <Button
            type="button"
            variant="ghost"
            size="md"
            className="w-8 px-0"
            aria-label={`Tétel ${n} törlése`}
            onClick={onRemove}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}

      {canWrite ? (
        <div className="flex justify-end lg:hidden">
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="size-3.5" aria-hidden />
            Tétel törlése
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function PriceInput({
  line,
  n,
  canWrite,
  missingPrice,
  onChange
}: {
  line: CsoDraftLine
  n: number
  canWrite: boolean
  missingPrice: boolean
  onChange: (patch: Partial<CsoDraftLine>) => void
}) {
  return (
    <div className="relative w-[8rem]">
      <Input
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
        placeholder="Bruttó ár"
        className={cn(
          'pr-7 text-right tabular-nums',
          missingPrice && 'border-warning'
        )}
        aria-label={`Tétel ${n} bruttó egységár (Ft / ${line.unitShortform || 'db'})`}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-body text-ink-secondary">
        Ft
      </span>
    </div>
  )
}

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
    <span className="whitespace-nowrap text-[15px] font-semibold tabular-nums text-ink">
      {formatMoneyFt(total)}{' '}
      <span className="text-body font-normal text-ink-secondary">Ft</span>
    </span>
  )
}

type TotalsProps = {
  itemCount: number
  qtyByUnit: Array<{ unit: string; qty: number }>
  totalGross: number
  deposit: number | null
  missingPriceCount: number
  missingSupplierCount?: number
  /** Összeg a szerkesztő rács „Sor bruttó” oszlopa alá (törlés oszlop kihagyva). */
  alignWithEditor?: boolean
}

/** Lista-láb: összeg a „Sor bruttó” oszlop alá igazítva. */
export function CsoTotalsFooter({
  itemCount,
  qtyByUnit,
  totalGross,
  deposit,
  missingPriceCount,
  missingSupplierCount = 0,
  alignWithEditor = false
}: TotalsProps) {
  const hasDeposit = deposit != null && deposit > 0
  const due = hasDeposit ? Math.max(0, totalGross - (deposit ?? 0)) : null
  const qtyText = qtyByUnit
    .map((q) => `${formatQty(q.qty)} ${q.unit}`)
    .join(' + ')

  return (
    <div
      className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-t border-border-strong bg-subtle px-3 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-body text-ink">
          <span className="font-semibold tabular-nums">{itemCount}</span> tétel
          {qtyText ? (
            <span className="text-ink-secondary"> · {qtyText}</span>
          ) : null}
        </p>
        <p className="text-body text-ink-secondary">
          Az árak bruttók (ÁFA-val).
        </p>
        {missingPriceCount > 0 ? (
          <p className="text-body font-semibold text-warning-ink">
            {missingPriceCount} tételnél hiányzik az ár.
          </p>
        ) : null}
        {missingSupplierCount > 0 ? (
          <p className="text-body font-semibold text-warning-ink">
            {missingSupplierCount} tételnél nincs beszállító.
          </p>
        ) : null}
      </div>

      <dl
        className={cn(
          'ml-auto grid grid-cols-[auto_auto] items-baseline gap-x-4 gap-y-1 text-right',
          alignWithEditor && 'lg:mr-[2.75rem]'
        )}
      >
        <dt className="text-body text-ink-secondary">Összesen (bruttó)</dt>
        <dd className="whitespace-nowrap text-[20px] font-semibold tabular-nums leading-tight text-ink">
          {formatMoneyFt(totalGross)}{' '}
          <span className="text-body font-normal text-ink-secondary">Ft</span>
        </dd>
        {hasDeposit ? (
          <>
            <dt className="text-body text-ink-secondary">Előleg</dt>
            <dd className="whitespace-nowrap text-body tabular-nums text-ink">
              −{formatMoneyFt(deposit ?? 0)} Ft
            </dd>
            <dt className="text-body font-semibold text-ink">
              Átvételkor fizet
            </dt>
            <dd className="whitespace-nowrap text-[15px] font-semibold tabular-nums text-ink">
              {formatMoneyFt(due ?? 0)} Ft
            </dd>
          </>
        ) : null}
      </dl>
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
