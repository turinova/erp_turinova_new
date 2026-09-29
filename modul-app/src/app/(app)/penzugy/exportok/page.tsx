import type { Metadata } from 'next'

import { FinanceExportsClient } from '@/components/finance/finance-exports-client'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { getSessionUser } from '@/lib/auth/session'
import { listFinancePeriodLocks } from '@/lib/finance/period-lock'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Pénzügy exportok'
}

type SearchParams = Promise<{ period?: string }>

export default async function ExportokPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Exportok</h1>
        <p className="text-body text-ink-secondary">Nincs aktív munkamenet.</p>
      </div>
    )
  }

  const sp = await searchParams
  const period =
    sp.period && /^\d{4}-\d{2}$/.test(sp.period)
      ? sp.period
      : new Date().toISOString().slice(0, 7)

  const supabase = await createClient()
  if (!supabase) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Exportok</h1>
        <p className="text-body text-danger-ink">Nincs adatbázis kapcsolat.</p>
      </div>
    )
  }

  const from = `${period}-01`
  const [y, m] = period.split('-').map(Number)
  const lastDay = new Date(y!, m!, 0).getDate()
  const to = `${period}-${String(lastDay).padStart(2, '0')}`

  const { data: invoices } = await supabase
    .from('invoices')
    .select(
      'id, internal_number, provider_invoice_number, invoice_type, customer_name, fulfillment_date, payment_due_date, net_total, vat_total, gross_total, payment_status, related_source_type, related_source_number'
    )
    .eq('tenant_id', user.tenantId)
    .is('deleted_at', null)
    .gte('fulfillment_date', from)
    .lte('fulfillment_date', to)
    .order('fulfillment_date', { ascending: true })
    .limit(2000)

  const ids = (invoices ?? []).map((i) => i.id)
  let lines: {
    invoice_id: string
    line_no: number
    name: string
    vat_percent: number
    line_net: number
    line_vat: number
    line_gross: number
  }[] = []
  if (ids.length > 0) {
    const { data: lineData } = await supabase
      .from('invoice_lines')
      .select(
        'invoice_id, line_no, name, vat_percent, line_net, line_vat, line_gross'
      )
      .eq('tenant_id', user.tenantId)
      .in('invoice_id', ids)
      .order('line_no', { ascending: true })
    lines = lineData ?? []
  }

  const locks = await listFinancePeriodLocks(supabase, user.tenantId)
  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const canUnlock = user.role === 'owner' || user.role === 'admin'

  return (
    <div className="space-y-4">
      <PageHeader
        title="Exportok"
        description="Könyvelői XLS/CSV és hónap soft-lock. Adóhatósági XML: Számlázz.hu."
      />
      <FinanceExportsClient
        period={period}
        invoices={(invoices ?? []).map((r) => ({
          ...r,
          net_total: r.net_total != null ? Number(r.net_total) : null,
          vat_total: r.vat_total != null ? Number(r.vat_total) : null,
          gross_total: r.gross_total != null ? Number(r.gross_total) : null
        }))}
        lines={lines.map((l) => ({
          ...l,
          vat_percent: Number(l.vat_percent),
          line_net: Number(l.line_net),
          line_vat: Number(l.line_vat),
          line_gross: Number(l.line_gross)
        }))}
        locks={locks}
        canWrite={canWrite}
        canUnlock={canUnlock}
      />
    </div>
  )
}
