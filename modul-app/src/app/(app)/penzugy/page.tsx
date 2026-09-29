import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  CircleDollarSign,
  Download,
  Receipt,
  Wallet
} from 'lucide-react'

import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { getSessionUser } from '@/lib/auth/session'
import { getFinanceDashboard } from '@/lib/finance/queries'
import { formatMoneyFt } from '@/lib/sales/parse'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Pénzügy'
}

export default async function PenzugyPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Pénzügy</h1>
        <p className="text-body text-ink-secondary">Nincs aktív munkamenet.</p>
      </div>
    )
  }

  const supabase = await createClient()
  if (!supabase) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Pénzügy</h1>
        <p className="text-body text-danger-ink">Nincs adatbázis kapcsolat.</p>
      </div>
    )
  }

  const dash = await getFinanceDashboard(supabase, user.tenantId)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pénzügy"
        description="Kinnlevőség, ÁFA egyeztetés és könyvelői export — a Számlázz.hu a jogi motor."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Kinnlevő"
          value={`${formatMoneyFt(dash.aging.total)} Ft`}
          hint={`${dash.aging.count} bizonylat`}
        />
        <Kpi
          label="Lejárt"
          value={`${formatMoneyFt(dash.aging.overdue)} Ft`}
          hint="Aging összeg"
          warn={dash.aging.overdue > 0}
        />
        <Kpi
          label="7 napon belül"
          value={`${formatMoneyFt(dash.dueSoonSum)} Ft`}
          hint={`${dash.dueSoonCount} tétel`}
        />
        <Kpi
          label={`ÁFA ${dash.periodYm}`}
          value={`${formatMoneyFt(dash.afaVat)} Ft`}
          hint={`Nettó ${formatMoneyFt(dash.afaNet)} · ${dash.afaInvoiceCount} biz.`}
        />
      </div>

      {dash.agentErrorCount > 0 ? (
        <p
          className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-body text-warning-ink"
          role="status"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {dash.agentErrorCount} bizonylaton van Agent hiba / figyelmeztetés —
          nézd meg a Bizonylatok listát.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href="/penzugy/kintlevoseg"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink no-underline hover:bg-subtle"
        >
          <Wallet className="size-3.5" aria-hidden />
          Kintlévőség
        </Link>
        <Link
          href="/szamlak?view=awaiting"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink no-underline hover:bg-subtle"
        >
          <Receipt className="size-3.5" aria-hidden />
          Fizetésre vár
        </Link>
        <Link
          href={`/penzugy/afa?period=${dash.periodYm}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink no-underline hover:bg-subtle"
        >
          <CircleDollarSign className="size-3.5" aria-hidden />
          ÁFA összesítő
        </Link>
        <Link
          href={`/penzugy/exportok?period=${dash.periodYm}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink no-underline hover:bg-subtle"
        >
          <Download className="size-3.5" aria-hidden />
          Exportok
        </Link>
      </div>

      <div className="rounded-md border border-border">
        <p className="border-b border-border px-3 py-2 text-[12px] font-medium text-ink-muted">
          Aging (nyitott)
        </p>
        <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-5">
          {(
            [
              ['current', 'Nem lejárt', dash.aging.sums.current],
              ['d1_30', '1–30 nap', dash.aging.sums.d1_30],
              ['d31_60', '31–60', dash.aging.sums.d31_60],
              ['d61_90', '61–90', dash.aging.sums.d61_90],
              ['d90p', '90+', dash.aging.sums.d90p]
            ] as const
          ).map(([key, label, sum]) => (
            <div key={key} className="px-3 py-2.5">
              <p className="text-hint text-ink-muted">{label}</p>
              <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-ink">
                {formatMoneyFt(sum)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
  warn
}: {
  label: string
  value: string
  hint: string
  warn?: boolean
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <p className="text-hint text-ink-muted">{label}</p>
      <p
        className={`mt-1 text-[15px] font-semibold tabular-nums ${
          warn ? 'text-danger-ink' : 'text-ink'
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-hint text-ink-secondary">{hint}</p>
    </div>
  )
}
