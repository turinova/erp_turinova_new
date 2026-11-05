import type { Metadata } from 'next'
import { Suspense } from 'react'

import { CustomerOrdersListClient } from '@/components/customer-orders/customer-orders-list-client'
import { getSessionUser } from '@/lib/auth/session'
import { listCustomerSpecialOrders } from '@/lib/customer-orders/queries'
import type {
  CsoListCounts,
  CsoListStatus
} from '@/lib/customer-orders/types'
import { listActiveSuppliersForSelect } from '@/lib/suppliers/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Ügyfélrendelések'
}

type SearchParams = Promise<{
  q?: string
  page?: string
  status?: string
  nosms?: string
  supplier?: string
}>

const EMPTY_COUNTS: CsoListCounts = {
  active: 0,
  felveve: 0,
  rendelve: 0,
  itt_van: 0,
  nosms: 0
}

function asStatusFilter(raw: string | undefined): CsoListStatus {
  if (
    raw === 'felveve' ||
    raw === 'rendelve' ||
    raw === 'itt_van' ||
    raw === 'atadva' ||
    raw === 'torolve' ||
    raw === 'all' ||
    raw === 'active'
  ) {
    return raw
  }
  return 'active'
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function UgyfelrendelesekListPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)
  const status = asStatusFilter(params.status)
  const nosms = params.nosms === '1'
  const supplierId =
    params.supplier && UUID_RE.test(params.supplier) ? params.supplier : null

  let loadError: string | null = null
  let rows: Awaited<ReturnType<typeof listCustomerSpecialOrders>>['rows'] =
    []
  let total = 0
  let limit = 25
  let counts = EMPTY_COUNTS
  let suppliers: { value: string; label: string }[] = []

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const [result, supplierRows] = await Promise.all([
          listCustomerSpecialOrders(supabase, {
            tenantId: user.tenantId,
            q: q || undefined,
            status,
            nosms,
            supplierId,
            page,
            limit: 25
          }),
          listActiveSuppliersForSelect(supabase, user.tenantId)
        ])
        rows = result.rows
        total = result.total
        limit = result.limit
        counts = result.counts
        suppliers = supplierRows.map((s) => ({ value: s.id, label: s.name }))
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni az ügyfélrendeléseket.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et, és futtasd a customer_special_orders migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Ügyfélrendelések</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <CustomerOrdersListClient
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        counts={counts}
        suppliers={suppliers}
        canWrite={canWrite}
        initialQ={q}
        initialStatus={status}
        initialNosms={nosms}
        initialSupplierId={supplierId}
      />
    </Suspense>
  )
}
