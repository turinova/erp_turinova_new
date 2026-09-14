import type { Metadata } from 'next'
import { Suspense } from 'react'

import { OrdersListClient } from '@/components/orders/orders-list-client'
import { getSessionUser } from '@/lib/auth/session'
import { listActivePaymentMethods } from '@/lib/payment-methods/queries'
import {
  listOrders,
  type OrderListStatusFilter
} from '@/lib/quotes/orders-queries'
import { listActiveProductionMachines } from '@/lib/production-machines/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Megrendelések'
}

type SearchParams = Promise<{
  q?: string
  page?: string
  status?: string
  machine?: string
  date?: string
}>

const STATUS_VALUES: OrderListStatusFilter[] = [
  'all',
  'ordered',
  'in_production',
  'ready',
  'finished',
  'cancelled'
]

function parseStatus(raw: string | undefined): OrderListStatusFilter {
  if (raw && STATUS_VALUES.includes(raw as OrderListStatusFilter)) {
    return raw as OrderListStatusFilter
  }
  return 'ordered'
}

export default async function MegrendelesekPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)
  const status = parseStatus(params.status)
  const machineId = params.machine?.trim() ?? ''
  const productionDate = params.date?.trim() ?? ''

  let loadError: string | null = null
  let rows: Awaited<ReturnType<typeof listOrders>>['rows'] = []
  let total = 0
  let limit = 25
  let machines: Awaited<ReturnType<typeof listActiveProductionMachines>> = []
  let paymentMethods: Awaited<ReturnType<typeof listActivePaymentMethods>> = []

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const [ordersResult, machineRows, methodRows] = await Promise.all([
          listOrders(supabase, {
            tenantId: user.tenantId,
            status,
            q: q || undefined,
            machineId: machineId || undefined,
            productionDate: productionDate || undefined,
            page,
            limit: 25
          }),
          listActiveProductionMachines(supabase, user.tenantId),
          listActivePaymentMethods(supabase, user.tenantId)
        ])
        rows = ordersResult.rows
        total = ordersResult.total
        limit = ordersResult.limit
        machines = machineRows
        paymentMethods = methodRows
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a megrendeléseket.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et.'
  } else {
    loadError = 'Nincs aktív céged.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Megrendelések</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          A gyártás mezőkhöz futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260324_quote_production.sql
          </code>{' '}
          migrációt is.
        </p>
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <OrdersListClient
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        canWrite={canWrite}
        initialQ={q}
        initialStatus={status}
        initialMachineId={machineId}
        initialProductionDate={productionDate}
        machines={machines}
        paymentMethods={paymentMethods}
      />
    </Suspense>
  )
}
