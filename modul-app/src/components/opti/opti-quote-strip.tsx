'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { StatusBadge } from '@/components/patterns/status-badge'
import {
  formatQuotePrice,
  PRICING_MODE_LABELS,
  type MaterialPricing,
  type QuoteResult
} from '@/lib/opti/quote-calculations'
import { cn } from '@/lib/utils'

export function OptiQuoteStrip({ quote }: { quote: QuoteResult }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(
    () => new Set()
  )

  function toggleMaterial(id: string) {
    setExpandedMaterials((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border border-l-[3px] border-l-success bg-surface">
      <header className="border-b-2 border-success/40 bg-success-soft/60 px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-h3 text-ink">2. Árajánlat</h2>
            <p className="text-hint text-ink-secondary">
              Mennyibe kerül — lapanyag, élzáró és vágás. Ez a számla, nem a
              rajz.
            </p>
            <p className="text-hint text-ink-muted">
              Árazás: {PRICING_MODE_LABELS[quote.pricing_mode]}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <SumChip
              label="Nettó"
              value={formatQuotePrice(quote.grand_total_net, quote.currency)}
              tone="neutral"
            />
            <span className="text-body text-ink-muted" aria-hidden>
              +
            </span>
            <SumChip
              label="ÁFA"
              value={formatQuotePrice(quote.grand_total_vat, quote.currency)}
              tone="warning"
            />
            <span className="text-body text-ink-muted" aria-hidden>
              =
            </span>
            <SumChip
              label="Bruttó / végösszeg"
              value={formatQuotePrice(
                quote.grand_total_gross,
                quote.currency
              )}
              tone="success"
              emphasize
            />
          </div>
        </div>
      </header>

      <button
        type="button"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-subtle/80"
      >
        <span className="text-body font-medium text-ink">
          {detailsOpen
            ? 'Részletek elrejtése'
            : 'Részletek megjelenítése anyagonként'}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-ink-secondary transition-transform',
            detailsOpen && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      {detailsOpen ? (
        <div>
          {quote.materials.map((material, index) => {
            const isOpen = expandedMaterials.has(material.material_id)
            const isLast = index === quote.materials.length - 1
            return (
              <MaterialQuoteBlock
                key={material.material_id}
                material={material}
                isOpen={isOpen}
                isLast={isLast}
                onToggle={() => toggleMaterial(material.material_id)}
              />
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

function SumChip({
  label,
  value,
  tone,
  emphasize
}: {
  label: string
  value: string
  tone: 'neutral' | 'warning' | 'success'
  emphasize?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-md px-3 py-2',
        tone === 'neutral' && 'bg-subtle text-ink',
        tone === 'warning' && 'bg-warning-soft text-warning-ink',
        tone === 'success' &&
          (emphasize
            ? 'bg-success text-white'
            : 'bg-success-soft text-success-ink')
      )}
    >
      <p
        className={cn(
          'text-label font-semibold leading-none',
          emphasize ? 'text-white/90' : 'opacity-90'
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-1 tabular-nums text-body font-bold leading-tight tracking-tight',
          emphasize && 'text-[15px]'
        )}
      >
        {value}
      </p>
    </div>
  )
}

function MaterialQuoteBlock({
  material,
  isOpen,
  isLast,
  onToggle
}: {
  material: MaterialPricing
  isOpen: boolean
  isLast: boolean
  onToggle: () => void
}) {
  const panelId = `quote-${material.material_id}`

  return (
    <div className={cn('bg-surface', !isLast && 'border-b border-border')}>
      <button
        type="button"
        id={`${panelId}-header`}
        aria-expanded={isOpen}
        aria-controls={`${panelId}-content`}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-subtle/60"
      >
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-ink-secondary transition-transform',
            isOpen && 'rotate-180'
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">
          {material.material_name}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={material.on_stock ? 'success' : 'warning'}>
            {material.on_stock ? 'Raktári' : 'Nem raktári'}
          </StatusBadge>
          <span className="rounded-md bg-success-soft px-2 py-0.5 text-hint font-semibold tabular-nums text-success-ink">
            {formatQuotePrice(material.total_gross, material.currency)}
          </span>
        </span>
      </button>

      {isOpen ? (
        <div
          id={`${panelId}-content`}
          role="region"
          aria-labelledby={`${panelId}-header`}
          className="space-y-3 border-t border-border bg-white p-3"
        >
          <QuoteTable
            title="Lapanyag"
            headers={['Tábla', 'Kihasználtság', 'Nettó', 'ÁFA', 'Bruttó']}
            rows={material.boards.map((board) => [
              <div key="board">
                <span>Tábla {board.board_id}</span>
                {board.pricing_method === 'panel_area' ? (
                  <span className="mt-0.5 block text-hint text-ink-secondary">
                    {board.area_m2.toFixed(2)} m² ×{' '}
                    {material.waste_multi.toFixed(2)} ={' '}
                    {board.charged_area_m2.toFixed(2)} m² (panel ×
                    hulladékszorzó)
                  </span>
                ) : (
                  <span className="mt-0.5 block text-hint text-warning-ink">
                    {board.charged_area_m2.toFixed(3)} m² (teljes tábla árazva)
                  </span>
                )}
              </div>,
              `${board.usage_percentage.toFixed(1)}%`,
              formatQuotePrice(board.net_price, material.currency),
              formatQuotePrice(board.vat_amount, material.currency),
              formatQuotePrice(board.gross_price, material.currency)
            ])}
            footer={[
              'Lapanyag összesen',
              '',
              formatQuotePrice(material.total_material_net, material.currency),
              formatQuotePrice(material.total_material_vat, material.currency),
              formatQuotePrice(material.total_material_gross, material.currency)
            ]}
          />

          {material.edge_materials.length > 0 ? (
            <QuoteTable
              title="Élzáró"
              headers={['Anyag', 'Hossz', 'Ft/m', 'Nettó', 'ÁFA', 'Bruttó']}
              rows={material.edge_materials.map((edge) => [
                <div key="edge">
                  <span>{edge.edge_material_name}</span>
                  <span className="mt-0.5 block text-hint text-ink-secondary">
                    {edge.length_m.toFixed(2)} m + ráhagyás →{' '}
                    {edge.length_with_overhang_m.toFixed(2)} m
                  </span>
                </div>,
                `${edge.length_with_overhang_m.toFixed(2)} m`,
                formatQuotePrice(edge.price_per_m, edge.currency),
                formatQuotePrice(edge.net_price, edge.currency),
                formatQuotePrice(edge.vat_amount, edge.currency),
                formatQuotePrice(edge.gross_price, edge.currency)
              ])}
              footer={[
                'Élzáró összesen',
                '',
                '',
                formatQuotePrice(material.total_edge_net, material.currency),
                formatQuotePrice(material.total_edge_vat, material.currency),
                formatQuotePrice(material.total_edge_gross, material.currency)
              ]}
            />
          ) : null}

          {material.cutting_cost &&
          material.cutting_cost.total_cutting_length_m > 0 ? (
            <QuoteTable
              title="Vágás"
              headers={['Tétel', 'Hossz', 'Ft/m', 'Nettó', 'ÁFA', 'Bruttó']}
              rows={[
                [
                  'Vágási díj',
                  `${material.cutting_cost.total_cutting_length_m.toFixed(2)} m`,
                  formatQuotePrice(
                    material.cutting_cost.fee_per_meter,
                    material.cutting_cost.currency
                  ),
                  formatQuotePrice(
                    material.cutting_cost.net_price,
                    material.cutting_cost.currency
                  ),
                  formatQuotePrice(
                    material.cutting_cost.vat_amount,
                    material.cutting_cost.currency
                  ),
                  formatQuotePrice(
                    material.cutting_cost.gross_price,
                    material.cutting_cost.currency
                  )
                ]
              ]}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function QuoteTable({
  title,
  headers,
  rows,
  footer
}: {
  title: string
  headers: string[]
  rows: React.ReactNode[][]
  footer?: React.ReactNode[]
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <p className="border-b border-border bg-subtle px-2.5 py-1.5 text-hint font-medium text-ink">
        {title}
      </p>
      <table className="w-full min-w-[32rem] border-collapse text-left text-hint">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h, i) => (
              <th
                key={h}
                className={cn(
                  'px-2.5 py-1.5 font-medium text-ink-secondary',
                  i > 0 && 'text-right'
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border last:border-0">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    'px-2.5 py-1.5 align-top text-ink',
                    ci > 0 && 'text-right tabular-nums'
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {footer ? (
            <tr className="bg-subtle">
              {footer.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    'px-2.5 py-1.5 font-semibold text-ink',
                    ci > 0 && 'text-right tabular-nums'
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
