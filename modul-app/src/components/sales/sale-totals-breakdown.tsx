'use client'

import { formatMoneyFt } from '@/lib/sales/parse'
import type { SaleTotalsResult } from '@/lib/sales/totals'
import { cn } from '@/lib/utils'

type RowProps = {
  label: string
  value: string
  muted?: boolean
  strong?: boolean
  className?: string
}

function Row({ label, value, muted, strong, className }: RowProps) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 text-body',
        muted && 'text-ink-secondary',
        strong && 'font-semibold text-ink',
        className
      )}
    >
      <span className={cn(!strong && 'text-ink-secondary')}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

type Props = {
  totals: SaleTotalsResult
  /** Extra hint pl. készlethiány */
  footerHint?: string | null
  /** Fizetendő szín — pl. fizetve / fizetetlen */
  dueTone?: 'success' | 'warning' | 'danger'
  className?: string
}

/** Nyugta-szerű összesítő — create sticky + detail. */
export function SaleTotalsBreakdown({
  totals,
  footerHint,
  dueTone,
  className
}: Props) {
  const showFees = totals.feesGross > 0
  const showDisc = totals.globalDiscountAmount > 0
  const showRound = totals.cashRoundingAmount !== 0

  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="text-[12px] font-medium text-ink-secondary">Összesítés</p>

      <Row
        label="Tételek"
        value={`${formatMoneyFt(totals.itemsGross)} Ft`}
        muted
      />
      {showFees ? (
        <Row
          label="Díjak"
          value={`${formatMoneyFt(totals.feesGross)} Ft`}
          muted
        />
      ) : null}
      <Row
        label="Részösszeg"
        value={`${formatMoneyFt(totals.subtotalGross)} Ft`}
      />

      {showDisc ? (
        <div className="flex items-baseline justify-between gap-3 text-body font-medium text-warning-ink">
          <span>
            Kedvezmény
            {totals.globalDiscountPercent > 0
              ? ` ${totals.globalDiscountPercent}%`
              : ''}
          </span>
          <span className="tabular-nums">
            −{formatMoneyFt(totals.globalDiscountAmount)} Ft
          </span>
        </div>
      ) : null}

      <div className="my-1 border-t border-border" />

      <Row
        label="Nettó"
        value={`${formatMoneyFt(totals.totalNet)} Ft`}
      />
      <Row
        label="ÁFA"
        value={`${formatMoneyFt(totals.totalVat)} Ft`}
      />

      <div className="my-1 border-t border-border" />

      <div className="flex items-baseline justify-between gap-3 pt-0.5">
        <span className="text-[12px] font-medium text-ink-secondary">
          Fizetendő
        </span>
        <span
          className={cn(
            'text-[22px] font-semibold tabular-nums tracking-tight',
            dueTone === 'success' && 'text-success-ink',
            dueTone === 'warning' && 'text-warning-ink',
            dueTone === 'danger' && 'text-danger-ink',
            !dueTone && 'text-ink'
          )}
        >
          {formatMoneyFt(totals.due)} Ft
        </span>
      </div>

      {showRound ? (
        <Row
          label="Készpénz kerekítés"
          value={`${totals.cashRoundingAmount > 0 ? '+' : ''}${formatMoneyFt(totals.cashRoundingAmount)} Ft`}
          muted
        />
      ) : null}

      {footerHint ? (
        <p className="pt-1 text-hint text-warning-ink">{footerHint}</p>
      ) : null}
    </div>
  )
}
