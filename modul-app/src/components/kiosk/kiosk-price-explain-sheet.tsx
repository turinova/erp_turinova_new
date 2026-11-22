'use client'

import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { LEFTOVER_COPY, type FullBoardReason } from '@/lib/kiosk/leftover'
import { formatHuf } from '@/lib/kiosk/mock-data'
import type { KioskPriceMaterialExplain } from '@/lib/kiosk/price'
import { cn } from '@/lib/utils'

function formatM2(n: number): string {
  return n.toFixed(n >= 10 ? 1 : 2).replace('.', ',')
}

function formatQty(qty: number, unit: string): string {
  if (unit === 'm²') return `${formatM2(qty)} m²`
  if (unit === 'm') return `${formatM2(qty)} m`
  if (Number.isInteger(qty)) return `${qty} ${unit}`
  return `${qty.toFixed(1).replace('.', ',')} ${unit}`
}

function ExplainTable({
  title,
  rows,
  footerLabel,
  footerAmount
}: {
  title: string
  rows: Array<{
    label: ReactNode
    qty: string
    unitPrice: string
    amount: number
  }>
  footerLabel: string
  footerAmount: number
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <p className="border-b border-border bg-subtle px-2.5 py-1.5 text-[12px] font-semibold text-ink">
        {title}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary">
                Tétel
              </th>
              <th className="px-2.5 py-1.5 text-right text-[11px] font-medium text-ink-secondary">
                Menny.
              </th>
              <th className="px-2.5 py-1.5 text-right text-[11px] font-medium text-ink-secondary">
                Egységár
              </th>
              <th className="px-2.5 py-1.5 text-right text-[11px] font-medium text-ink-secondary">
                Összeg
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border last:border-0"
              >
                <td className="px-2.5 py-1.5 align-top text-[13px] text-ink">
                  {row.label}
                </td>
                <td className="px-2.5 py-1.5 align-top text-right text-[13px] tabular-nums text-ink">
                  {row.qty}
                </td>
                <td className="px-2.5 py-1.5 align-top text-right text-[13px] tabular-nums text-ink">
                  {row.unitPrice}
                </td>
                <td className="px-2.5 py-1.5 align-top text-right text-[13px] tabular-nums text-ink">
                  {formatHuf(row.amount)}
                </td>
              </tr>
            ))}
            <tr className="bg-subtle">
              <td
                colSpan={3}
                className="px-2.5 py-1.5 text-[13px] font-semibold text-ink"
              >
                {footerLabel}
              </td>
              <td className="px-2.5 py-1.5 text-right text-[13px] font-semibold tabular-nums text-ink">
                {formatHuf(footerAmount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function boardLabel(
  boardId: number,
  method: 'panel_area' | 'full_board',
  areaM2: number,
  chargedAreaM2: number,
  wasteMulti: number,
  reason: FullBoardReason
): ReactNode {
  if (method === 'full_board') {
    return (
      <div>
        <span className="font-medium">Tábla {boardId}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-ink-secondary">
          {reason === 'always'
            ? LEFTOVER_COPY.explainAlways
            : LEFTOVER_COPY.explainUsage}
        </span>
      </div>
    )
  }
  return (
    <div>
      <span className="font-medium">Tábla {boardId}</span>
      <span className="mt-0.5 block text-[11px] leading-snug text-ink-secondary">
        Darabjaid {formatM2(areaM2)} m², a vágás miatt{' '}
        {formatM2(chargedAreaM2)} m² lapot használunk fel (×
        {wasteMulti.toFixed(2).replace('.', ',')})
      </span>
    </div>
  )
}

export function KioskPriceExplainSheet({
  open,
  onOpenChange,
  material,
  thicknessMm
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  material: KioskPriceMaterialExplain | null
  thicknessMm?: number | null
}) {
  if (!material) return null

  const subtitle = [
    material.materialName,
    thicknessMm != null ? `${thicknessMm} mm` : null
  ]
    .filter(Boolean)
    .join(', ')

  const showLap =
    material.materialGross > 0 || material.boards.length > 0
  const showEdge = material.edgeGross > 0 && material.edges.length > 0
  const showCutting =
    Boolean(material.cutting) && material.cuttingGross > 0
  const showServices =
    material.servicesGross > 0 && material.services.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[min(80vh,640px)] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-3 overflow-hidden p-4 sm:p-5'
        )}
      >
        <DialogHeader className="shrink-0 gap-0.5">
          <DialogTitle className="text-[18px] font-semibold leading-tight">
            Hogyan jött ki ez az ár?
          </DialogTitle>
          <DialogDescription className="text-[13px] text-ink-secondary">
            {subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
          {showLap ? (
            <ExplainTable
              title="Lap"
              rows={material.boards.map((b) => ({
                label: boardLabel(
                  b.boardId,
                  b.pricingMethod,
                  b.areaM2,
                  b.chargedAreaM2,
                  material.wasteMulti,
                  material.fullBoardReason
                ),
                qty: `${formatM2(b.chargedAreaM2)} m²`,
                unitPrice:
                  b.pricePerSqmGross > 0
                    ? `${formatHuf(b.pricePerSqmGross)}/m²`
                    : '—',
                amount: b.gross
              }))}
              footerLabel="Lap összesen"
              footerAmount={material.materialGross}
            />
          ) : null}

          {showEdge ? (
            <ExplainTable
              title="Élzárás"
              rows={material.edges.map((e) => ({
                label: <span className="font-medium">{e.name}</span>,
                qty: formatQty(e.lengthM, 'm'),
                unitPrice:
                  e.pricePerMGross > 0
                    ? `${formatHuf(e.pricePerMGross)}/m`
                    : '—',
                amount: e.gross
              }))}
              footerLabel="Élzárás összesen"
              footerAmount={material.edgeGross}
            />
          ) : null}

          {showCutting && material.cutting ? (
            <ExplainTable
              title="Vágás"
              rows={[
                {
                  label: <span className="font-medium">Vágási díj</span>,
                  qty: formatQty(material.cutting.lengthM, 'm'),
                  unitPrice:
                    material.cutting.feePerMGross > 0
                      ? `${formatHuf(material.cutting.feePerMGross)}/m`
                      : '—',
                  amount: material.cutting.gross
                }
              ]}
              footerLabel="Vágás összesen"
              footerAmount={material.cuttingGross}
            />
          ) : null}

          {showServices ? (
            <ExplainTable
              title="Megmunkálás"
              rows={material.services.map((s) => ({
                label: <span className="font-medium">{s.label}</span>,
                qty: formatQty(s.qty, s.unit),
                unitPrice:
                  s.unitPriceGross > 0
                    ? `${formatHuf(s.unitPriceGross)}/${s.unit === 'm²' ? 'm²' : 'db'}`
                    : '—',
                amount: s.gross
              }))}
              footerLabel="Megmunkálás összesen"
              footerAmount={material.servicesGross}
            />
          ) : null}
        </div>

        <div className="flex shrink-0 items-baseline justify-between gap-3 border-t border-border pt-3">
          <span className="text-[15px] font-semibold text-ink">
            Összesen (bruttó)
          </span>
          <span className="text-[16px] font-semibold tabular-nums text-ink">
            {formatHuf(material.totalGross)}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
