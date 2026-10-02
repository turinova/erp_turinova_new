import type { ReactNode } from 'react'
import { ClipboardList, Plus, Search } from 'lucide-react'

import { StatusBadge } from '@/components/patterns/status-badge'
import { getNavAccentClasses } from '@/lib/nav-accent'
import {
  PO_ORDER_KIND_LABEL,
  PO_STATUS_LABEL,
  poOrderKindTone,
  poStatusTone,
  type PurchaseOrderKind,
  type PurchaseOrderStatus
} from '@/lib/purchase-orders/parse'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

/**
 * Statikus UI-másolat: `/beszallitoi-rendelesek` lista.
 * Címkék / badge = `purchase-orders-list-client` + `lib/purchase-orders/parse`.
 * Nincs scroll, nincs DB, nincs interaktivitás.
 */

type MockRow = {
  id: string
  poNumber: string
  orderKind: PurchaseOrderKind
  supplier: string
  status: PurchaseOrderStatus
  expectedDate: string | null
  itemsCount: number
  netTotal: number
}

const ROWS: MockRow[] = [
  {
    id: '1',
    poNumber: 'PO-2026-0188',
    orderKind: 'product',
    supplier: 'Blum Magyarország',
    status: 'ordered',
    expectedDate: '2026. 04. 04.',
    itemsCount: 6,
    netTotal: 428_500
  },
  {
    id: '2',
    poNumber: 'PO-2026-0187',
    orderKind: 'material',
    supplier: 'Egger Hungária',
    status: 'partial',
    expectedDate: '2026. 04. 02.',
    itemsCount: 4,
    netTotal: 1_240_000
  },
  {
    id: '3',
    poNumber: 'PO-2026-0186',
    orderKind: 'product',
    supplier: 'Hettich',
    status: 'draft',
    expectedDate: null,
    itemsCount: 3,
    netTotal: 89_200
  },
  {
    id: '4',
    poNumber: 'PO-2026-0185',
    orderKind: 'product',
    supplier: 'Local Supply Kft.',
    status: 'received',
    expectedDate: '2026. 03. 28.',
    itemsCount: 12,
    netTotal: 156_800
  }
]

const STATUS_CHIPS: { label: string; active?: boolean }[] = [
  { label: 'Mind (12)', active: true },
  { label: 'Vázlat (2)' },
  { label: 'Elküldve (4)' },
  { label: 'Részben beérkezett (3)' },
  { label: 'Beérkezett (3)' }
]

function AppFrame({
  path,
  children,
  className
}: {
  path: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-app shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
        </span>
        <span className="rounded bg-subtle px-2 py-0.5 text-[11px] text-ink-muted">
          {path}
        </span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function FakeChip({
  children,
  active
}: {
  children: ReactNode
  active?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-md px-2.5 text-hint font-medium',
        active ? 'bg-ink text-surface' : 'bg-subtle text-ink-secondary'
      )}
    >
      {children}
    </span>
  )
}

export function BeszerzesRendelesekMockup({
  className
}: {
  className?: string
}) {
  const tones = getNavAccentClasses('amber')

  return (
    <AppFrame
      path="turinova.hu/beszallitoi-rendelesek"
      className={className}
    >
      <div className="pointer-events-none select-none space-y-3" aria-hidden>
        {/* PageHeader */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-md',
                  tones.soft,
                  tones.icon
                )}
              >
                <ClipboardList className="size-4" />
              </span>
              <h3 className="text-h1 text-ink">Beszállítói rendelések</h3>
            </div>
            <p className="max-w-xl pl-[42px] text-body text-ink-secondary">
              Termék vagy anyag (tábla + munkalap) rendelés beszállítótól.
            </p>
            <div
              className={cn(
                'ml-[42px] mt-2 h-0.5 w-12 rounded-full',
                tones.bar
              )}
            />
          </div>
          <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-white">
            <Plus className="size-3.5" aria-hidden />
            Új rendelés
          </span>
        </div>

        {/* Kereső */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[10rem] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <span className="flex h-8 w-full items-center rounded-md border border-border bg-surface pl-8 pr-3 text-[13px] text-ink-muted">
              Szám / beszállító…
            </span>
          </div>
          <span className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink">
            Keresés
          </span>
        </div>

        {/* Státusz chipek */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_CHIPS.map((c) => (
            <FakeChip key={c.label} active={c.active}>
              {c.label}
            </FakeChip>
          ))}
        </div>

        {/* Tábla — 4 sor, nincs scroll, nincs műveletek oszlop */}
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead className="border-b border-border bg-subtle">
              <tr className="text-hint text-ink-secondary">
                <th className="px-2.5 py-2 font-medium">Szám</th>
                <th className="px-2.5 py-2 font-medium">Beszállító</th>
                <th className="px-2.5 py-2 font-medium">Státusz</th>
                <th className="hidden px-2.5 py-2 font-medium sm:table-cell">
                  Várható
                </th>
                <th className="px-2.5 py-2 text-right font-medium">Tételek</th>
                <th className="px-2.5 py-2 text-right font-medium">Nettó</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ROWS.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'bg-surface',
                    row.orderKind === 'material' &&
                      'border-l-[3px] border-l-info'
                  )}
                >
                  <td className="px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-ink">
                        {row.poNumber}
                      </span>
                      <StatusBadge tone={poOrderKindTone(row.orderKind)}>
                        {PO_ORDER_KIND_LABEL[row.orderKind]}
                      </StatusBadge>
                    </div>
                  </td>
                  <td className="px-2.5 py-2 text-ink-secondary">
                    {row.supplier}
                  </td>
                  <td className="px-2.5 py-2">
                    <StatusBadge tone={poStatusTone(row.status)}>
                      {PO_STATUS_LABEL[row.status]}
                    </StatusBadge>
                  </td>
                  <td className="hidden px-2.5 py-2 tabular-nums text-ink-secondary sm:table-cell">
                    {row.expectedDate ?? '—'}
                  </td>
                  <td className="px-2.5 py-2 text-right tabular-nums text-ink">
                    {row.itemsCount}
                  </td>
                  <td className="px-2.5 py-2 text-right tabular-nums font-medium text-ink">
                    {formatMoneyFt(row.netTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppFrame>
  )
}
