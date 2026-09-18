'use client'

import { useEffect, useRef } from 'react'

import { StatusBadge } from '@/components/patterns/status-badge'
import type { DocumentBillingState } from '@/components/sales/document-billing-fields'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { PosCartLine, PosFeeLine } from '@/lib/pos/session'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { SaleTotalsResult } from '@/lib/sales/totals'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  lines: PosCartLine[]
  fees: PosFeeLine[]
  totals: SaleTotalsResult
  paymentMethodName: string
  isCash: boolean
  warehouseName: string
  customerName: string | null
  /** Számla (billing kitöltve) vs csak nyugta */
  invoice: boolean
  billing: DocumentBillingState | null
  overstockCount: number
  loading?: boolean
  onConfirm: () => void
}

function lineAmounts(line: PosCartLine) {
  const before = Math.round(line.quantity * line.unitPriceGross)
  const disc = Math.round((before * (line.discountPercentage || 0)) / 100)
  return { before, final: Math.max(0, before - disc) }
}

export function PosConfirmDialog({
  open,
  onOpenChange,
  lines,
  fees,
  totals,
  paymentMethodName,
  isCash,
  warehouseName,
  customerName,
  invoice,
  billing,
  overstockCount,
  loading = false,
  onConfirm
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (loading) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        className={cn(
          'flex max-h-[85vh] max-w-xl flex-col gap-0 overflow-hidden p-0'
        )}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-10">
          <DialogTitle>Eladás megerősítése</DialogTitle>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge
              tone={invoice ? 'info' : 'neutral'}
              variant={invoice ? 'solid' : 'outline'}
            >
              {invoice ? 'Számla' : 'Nyugta'}
            </StatusBadge>
            <StatusBadge
              tone={isCash ? 'success' : 'info'}
              variant="solid"
            >
              {paymentMethodName || 'Fizetés'}
            </StatusBadge>
            <StatusBadge
              tone={customerName ? 'info' : 'neutral'}
              variant={customerName ? 'soft' : 'outline'}
            >
              {customerName ?? 'Vendég'}
            </StatusBadge>
            <StatusBadge tone="neutral" variant="outline">
              {warehouseName}
            </StatusBadge>
            {overstockCount > 0 ? (
              <StatusBadge tone="warning" variant="solid">
                {overstockCount} készlethiányos
              </StatusBadge>
            ) : null}
          </div>
          <p className="mt-2 text-hint text-ink-secondary">
            A készlet azonnal csökken. Ellenőrizd a tételeket és az összeget.
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {invoice && billing ? (
            <div className="mb-3 rounded-md border border-border bg-subtle/40 px-3 py-2.5">
              <p className="mb-1 text-[12px] font-medium text-ink-secondary">
                Számlázási adatok
              </p>
              <div className="space-y-0.5 text-body leading-relaxed text-ink">
                {billing.billingName ? (
                  <p className="font-semibold">{billing.billingName}</p>
                ) : null}
                <p className="text-ink-secondary">
                  {[billing.billingPostalCode, billing.billingCity]
                    .filter(Boolean)
                    .join(' ')}
                </p>
                <p className="text-ink-secondary">
                  {[billing.billingStreet, billing.billingHouseNumber]
                    .filter(Boolean)
                    .join(' ')}
                </p>
                {billing.billingCountry ? (
                  <p className="text-ink-secondary">{billing.billingCountry}</p>
                ) : null}
                {billing.billingTaxNumber ? (
                  <p className="tabular-nums text-ink-secondary">
                    Adószám: {billing.billingTaxNumber}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mb-3 text-hint text-ink-muted">
              Csak nyugta — nincs számlázási adat.
            </p>
          )}

          <table className="w-full border-collapse text-body">
            <thead>
              <tr className="border-b border-border text-left text-label text-ink-secondary">
                <th className="pb-2 pr-2 font-medium">Tétel</th>
                <th className="w-14 pb-2 text-center font-medium">Qty</th>
                <th className="w-[6.5rem] pb-2 text-right font-medium">
                  Bruttó összeg
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const { before, final } = lineAmounts(line)
                const hasDisc = line.discountPercentage > 0
                const over =
                  line.onHand != null &&
                  line.quantity > line.onHand + 0.0001
                return (
                  <tr
                    key={line.accessoryId}
                    className={cn(
                      'border-b border-border last:border-0',
                      over && 'bg-warning-soft/60'
                    )}
                  >
                    <td className="py-2 pr-2 align-top">
                      <div className="font-semibold text-ink">{line.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <span className="text-hint text-ink-secondary">
                          {line.sku}
                        </span>
                        {hasDisc ? (
                          <StatusBadge tone="warning" variant="soft">
                            −{line.discountPercentage}%
                          </StatusBadge>
                        ) : null}
                        {over ? (
                          <StatusBadge tone="warning" variant="solid">
                            Készlethiány
                          </StatusBadge>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2 text-center tabular-nums text-ink">
                      {line.quantity} {line.unitShortform}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {hasDisc ? (
                        <div className="flex flex-col items-end leading-tight">
                          <span className="text-[12px] text-ink-muted line-through">
                            {formatMoneyFt(before)} Ft
                          </span>
                          <span className="font-semibold text-warning-ink">
                            {formatMoneyFt(final)} Ft
                          </span>
                        </div>
                      ) : (
                        <span className="font-semibold text-ink">
                          {formatMoneyFt(final)} Ft
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {fees.map((fee) => (
                <tr
                  key={fee.key}
                  className="border-b border-border bg-subtle/40 last:border-0"
                >
                  <td className="py-2 pr-2 align-top">
                    <div className="font-semibold text-ink">{fee.name}</div>
                    <div className="mt-0.5">
                      <StatusBadge tone="neutral" variant="outline">
                        Díj
                      </StatusBadge>
                    </div>
                  </td>
                  <td className="py-2 text-center text-ink-muted">—</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-ink">
                    {formatMoneyFt(Math.round(fee.unitPriceGross))} Ft
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 space-y-1.5 border-t border-border bg-subtle/50 px-4 py-3">
          <SummaryRow
            label="Bruttó részösszeg"
            value={`${formatMoneyFt(totals.subtotalGross)} Ft`}
          />
          {totals.globalDiscountAmount > 0 ? (
            <SummaryRow
              label={`Kedvezmény ${totals.globalDiscountPercent}% (bruttóból)`}
              value={`−${formatMoneyFt(totals.globalDiscountAmount)} Ft`}
              tone="warning"
            />
          ) : null}
          <SummaryRow
            label="Nettó összesen"
            value={`${formatMoneyFt(totals.totalNet)} Ft`}
          />
          <SummaryRow
            label="ÁFA összesen"
            value={`${formatMoneyFt(totals.totalVat)} Ft`}
          />
          {isCash && totals.cashRoundingAmount !== 0 ? (
            <SummaryRow
              label="Készpénz kerekítés"
              value={`${totals.cashRoundingAmount > 0 ? '+' : ''}${formatMoneyFt(totals.cashRoundingAmount)} Ft`}
            />
          ) : null}
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <span className="text-[13px] font-medium text-ink-secondary">
              Fizetendő (bruttó)
            </span>
            <span className="text-[26px] font-semibold tabular-nums tracking-tight text-ink">
              {formatMoneyFt(totals.due)} Ft
            </span>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:justify-end">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            className="h-11"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          <Button
            type="button"
            className="h-11 min-w-[10rem]"
            loading={loading}
            onClick={onConfirm}
          >
            Eladás rögzítése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SummaryRow({
  label,
  value,
  tone
}: {
  label: string
  value: string
  tone?: 'warning'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-body">
      <span
        className={cn(
          tone === 'warning' ? 'text-warning-ink' : 'text-ink-secondary'
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'tabular-nums font-medium',
          tone === 'warning' ? 'text-warning-ink' : 'text-ink'
        )}
      >
        {value}
      </span>
    </div>
  )
}
