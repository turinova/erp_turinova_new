import { Box, Breadcrumbs, Link, Typography } from '@mui/material'
import { AccountBalanceWallet as WalletIcon, Home as HomeIcon } from '@mui/icons-material'
import NextLink from 'next/link'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { computeDijbekeroDeletionBlockedByOrderId } from '@/lib/invoice-dijbekero-delete-guard'
import OutgoingInvoicesClient from './OutgoingInvoicesClient'

export type OutgoingInvoiceRow = {
  id: string
  internal_number: string
  provider: string
  provider_invoice_number: string | null
  invoice_type: string
  related_order_type: string
  related_order_id: string | null
  related_order_number: string | null
  customer_name: string | null
  payment_due_date: string | null
  fulfillment_date: string | null
  gross_total: number | string | null
  payment_status: string
  pdf_url: string | null
  connection_id: string | null
  created_at: string
}

interface PageProps {
  searchParams?: Promise<{
    page?: string
    limit?: string
    type?: string
    status?: string
    search?: string
    from?: string
    to?: string
  }>
}

export default async function OutgoingInvoicesPage({ searchParams }: PageProps = {}) {
  const resolved = searchParams ? await searchParams : {}
  const page = parseInt(resolved.page || '1', 10)
  const limit = Math.min(parseInt(resolved.limit || '25', 10), 100)
  const typeFilter = resolved.type || 'all'
  const statusFilter = resolved.status || 'all'
  const search = resolved.search || ''
  const from = resolved.from || ''
  const to = resolved.to || ''

  let rows: OutgoingInvoiceRow[] = []
  let connectionNames: Record<string, string> = {}
  let dijbekeroDeletionBlockedByOrderId: Record<string, boolean> = {}
  let totalCount = 0
  let totalPages = 0
  let pageGrossSum = 0

  try {
    const supabase = await getTenantSupabase()
    const offset = (page - 1) * limit

    let query = supabase
      .from('invoices')
      .select(
        `
        id,
        internal_number,
        provider,
        provider_invoice_number,
        invoice_type,
        related_order_type,
        related_order_id,
        related_order_number,
        customer_name,
        payment_due_date,
        fulfillment_date,
        gross_total,
        payment_status,
        pdf_url,
        connection_id,
        created_at
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (typeFilter && typeFilter !== 'all') {
      query = query.eq('invoice_type', typeFilter)
    }

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('payment_status', statusFilter)
    }

    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      query = query.gte('created_at', `${from}T00:00:00.000Z`)
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      query = query.lte('created_at', `${to}T23:59:59.999Z`)
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`
      query = query.or(
        `internal_number.ilike.${term},customer_name.ilike.${term},related_order_number.ilike.${term},provider_invoice_number.ilike.${term}`
      )
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (!error && data) {
      rows = data as OutgoingInvoiceRow[]
      totalCount = count || 0
      totalPages = Math.ceil(totalCount / limit)
      pageGrossSum = rows.reduce((acc, r) => {
        const g = r.gross_total
        const n = typeof g === 'string' ? parseFloat(g) : Number(g)
        return acc + (Number.isFinite(n) ? n : 0)
      }, 0)

      const connIds = [...new Set(rows.map((r) => r.connection_id).filter(Boolean))] as string[]
      if (connIds.length > 0) {
        const { data: conns } = await supabase.from('webshop_connections').select('id, name').in('id', connIds)
        connectionNames = Object.fromEntries((conns || []).map((c: { id: string; name: string }) => [c.id, c.name]))
      }

      const orderIdsForDijbekeroGuard = [
        ...new Set(
          rows
            .filter((r) => r.invoice_type === 'dijbekero' && r.related_order_id)
            .map((r) => r.related_order_id as string)
        )
      ]
      if (orderIdsForDijbekeroGuard.length > 0) {
        dijbekeroDeletionBlockedByOrderId = await computeDijbekeroDeletionBlockedByOrderId(
          supabase,
          orderIdsForDijbekeroGuard
        )
      }
    }
  } catch (e) {
    console.error('Error fetching outgoing invoices:', e)
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1680, mx: 'auto' }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <Link component={NextLink} href="/home" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize="small" />
          Főoldal
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <WalletIcon fontSize="small" />
          Kimenő számlák
        </Typography>
      </Breadcrumbs>

      <OutgoingInvoicesClient
        rows={rows}
        connectionNames={connectionNames}
        dijbekeroDeletionBlockedByOrderId={dijbekeroDeletionBlockedByOrderId}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={page}
        limit={limit}
        initialType={typeFilter}
        initialStatus={statusFilter}
        initialSearch={search}
        initialFrom={from}
        initialTo={to}
        pageGrossSum={pageGrossSum}
      />
    </Box>
  )
}
