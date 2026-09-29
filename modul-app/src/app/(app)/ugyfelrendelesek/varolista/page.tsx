import type { Metadata } from 'next'
import { Suspense } from 'react'

import { CsoWaitingListClient } from '@/components/customer-orders/cso-waiting-list-client'
import { getSessionUser } from '@/lib/auth/session'
import {
  countCustomerSpecialOrderItemsWaiting,
  listCustomerSpecialOrderItemsWaiting
} from '@/lib/customer-orders/queries'
import {
  CSO_WAITING_VIEWS,
  type CsoWaitingCounts,
  type CsoWaitingView
} from '@/lib/customer-orders/types'
import { createClient } from '@/lib/supabase/server'
import { listSuppliers } from '@/lib/suppliers/queries'

export const metadata: Metadata = {
  title: 'Beszállítói várólista'
}

type SearchParams = Promise<{
  q?: string
  page?: string
  view?: string
  supplier?: string
  notify?: string
}>

function asView(raw: string | undefined): CsoWaitingView {
  if (raw && (CSO_WAITING_VIEWS as readonly string[]).includes(raw)) {
    return raw as CsoWaitingView
  }
  return 'todo'
}

const EMPTY_COUNTS: CsoWaitingCounts = {
  todo: 0,
  on_way: 0,
  ready: 0,
  done: 0,
  cancelled: 0
}

export default async function CsoWaitingListPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)
  const view = asView(params.view)
  const supplierId = params.supplier?.trim() || ''
  const notifyPending = params.notify === 'pending' && view === 'ready'

  let loadError: string | null = null
  let rows: Awaited<
    ReturnType<typeof listCustomerSpecialOrderItemsWaiting>
  >['rows'] = []
  let total = 0
  let limit = 25
  let counts = EMPTY_COUNTS
  let suppliers: { id: string; name: string }[] = []

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const [listResult, countResult, supplierResult] = await Promise.all([
          listCustomerSpecialOrderItemsWaiting(supabase, {
            tenantId: user.tenantId,
            view,
            q: q || undefined,
            supplierId: supplierId || undefined,
            notifyPending,
            page,
            limit: 25
          }),
          countCustomerSpecialOrderItemsWaiting(
            supabase,
            user.tenantId,
            supplierId || undefined
          ),
          listSuppliers(supabase, {
            tenantId: user.tenantId,
            status: 'active',
            limit: 200
          })
        ])
        rows = listResult.rows
        total = listResult.total
        limit = listResult.limit
        counts = countResult
        suppliers = supplierResult.rows.map((s) => ({
          id: s.id,
          name: s.name
        }))
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a várólistát.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Beszállítói várólista</h1>
        <p className="text-body text-danger" role="alert">
          {loadError}
        </p>
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <CsoWaitingListClient
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        counts={counts}
        canWrite={canWrite}
        initialQ={q}
        initialView={view}
        initialSupplierId={supplierId}
        initialNotifyPending={notifyPending}
        suppliers={suppliers}
      />
    </Suspense>
  )
}
