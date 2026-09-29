import type { Metadata } from 'next'
import Link from 'next/link'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { getSessionUser } from '@/lib/auth/session'
import { listAfaSummary } from '@/lib/finance/queries'
import { formatMoneyFt } from '@/lib/sales/parse'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'ÁFA összesítő'
}

type SearchParams = Promise<{ period?: string }>

function defaultPeriod() {
  return new Date().toISOString().slice(0, 7)
}

export default async function AfaPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">ÁFA összesítő</h1>
        <p className="text-body text-ink-secondary">Nincs aktív munkamenet.</p>
      </div>
    )
  }

  const sp = await searchParams
  const period =
    sp.period && /^\d{4}-\d{2}$/.test(sp.period) ? sp.period : defaultPeriod()

  const supabase = await createClient()
  if (!supabase) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">ÁFA összesítő</h1>
        <p className="text-body text-danger-ink">Nincs adatbázis kapcsolat.</p>
      </div>
    )
  }

  const { rows, invoiceCount } = await listAfaSummary(
    supabase,
    user.tenantId,
    period
  )
  const sumNet = rows.reduce((s, r) => s + r.line_net, 0)
  const sumVat = rows.reduce((s, r) => s + r.line_vat, 0)
  const sumGross = rows.reduce((s, r) => s + r.line_gross, 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="ÁFA összesítő"
        description="Teljesítés dátum szerinti hónap — díjbekérő nélkül. Könyvelői egyeztetéshez, nem ÁNYK beadás."
      />

      <form className="flex flex-wrap items-end gap-2" method="get">
        <div>
          <label
            htmlFor="afa-period"
            className="mb-1 block text-hint text-ink-muted"
          >
            Időszak (YYYY-MM)
          </label>
          <input
            id="afa-period"
            name="period"
            type="month"
            defaultValue={period}
            className="flex h-8 rounded-md border border-border bg-surface px-2 text-[13px]"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[13px] font-medium text-white"
        >
          Mutatás
        </button>
        <Link
          href={`/penzugy/exportok?period=${period}`}
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-[13px] font-medium text-ink no-underline hover:bg-subtle"
        >
          Exportok
        </Link>
      </form>

      <p className="text-body text-ink-secondary" role="status">
        {period} · {invoiceCount} bizonylat · nettó{' '}
        <span className="font-semibold tabular-nums text-ink">
          {formatMoneyFt(sumNet)}
        </span>{' '}
        · ÁFA{' '}
        <span className="font-semibold tabular-nums text-ink">
          {formatMoneyFt(sumVat)}
        </span>{' '}
        · bruttó{' '}
        <span className="font-semibold tabular-nums text-ink">
          {formatMoneyFt(sumGross)}
        </span>
      </p>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-body text-ink-secondary">
          Nincs tétel ebben a hónapban (vagy a régi bizonylatoknak még nincs
          tétel-snapshotja — új kiállítás után jelenik meg).
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>ÁFA kulcs %</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Nettó</DataTableHeaderCell>
              <DataTableHeaderCell align="right">ÁFA</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Bruttó</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {rows.map((r) => (
              <DataTableRow key={r.vat_percent}>
                <DataTableCell className="tabular-nums">
                  {r.vat_percent}
                </DataTableCell>
                <DataTableCell align="right" className="tabular-nums">
                  {formatMoneyFt(r.line_net)}
                </DataTableCell>
                <DataTableCell align="right" className="tabular-nums">
                  {formatMoneyFt(r.line_vat)}
                </DataTableCell>
                <DataTableCell align="right" className="tabular-nums font-medium">
                  {formatMoneyFt(r.line_gross)}
                </DataTableCell>
              </DataTableRow>
            ))}
            <DataTableRow>
              <DataTableCell className="font-semibold">Összesen</DataTableCell>
              <DataTableCell
                align="right"
                className="font-semibold tabular-nums"
              >
                {formatMoneyFt(sumNet)}
              </DataTableCell>
              <DataTableCell
                align="right"
                className="font-semibold tabular-nums"
              >
                {formatMoneyFt(sumVat)}
              </DataTableCell>
              <DataTableCell
                align="right"
                className="font-semibold tabular-nums"
              >
                {formatMoneyFt(sumGross)}
              </DataTableCell>
            </DataTableRow>
          </DataTableBody>
        </DataTable>
      )}
    </div>
  )
}
