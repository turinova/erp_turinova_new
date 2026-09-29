import type { Metadata } from 'next'
import { Suspense } from 'react'

import { CustomerOrdersListClient } from '@/components/customer-orders/customer-orders-list-client'
import { getSessionUser } from '@/lib/auth/session'
import { listCustomerSpecialOrders } from '@/lib/customer-orders/queries'
import type { CsoItemStatus } from '@/lib/customer-orders/types'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Ügyfélrendelések'
}

type SearchParams = Promise<{
  q?: string
  page?: string
  status?: string
  sms?: string
}>

type ListStatus = CsoItemStatus | 'all' | 'active'
type SmsFilter = 'all' | 'sent' | 'pending'

function asStatusFilter(raw: string | undefined): ListStatus {
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

function asSmsFilter(raw: string | undefined): SmsFilter {
  if (raw === 'sent' || raw === 'pending') return raw
  return 'all'
}

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
  const sms = asSmsFilter(params.sms)

  let loadError: string | null = null
  let rows: Awaited<ReturnType<typeof listCustomerSpecialOrders>>['rows'] =
    []
  let total = 0
  let limit = 25

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const result = await listCustomerSpecialOrders(supabase, {
          tenantId: user.tenantId,
          q: q || undefined,
          status,
          sms,
          page,
          limit: 25
        })
        rows = result.rows
        total = result.total
        limit = result.limit
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
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260559_customer_special_orders.sql
          </code>{' '}
          fájlt a Supabase SQL Editorben, majd frissítsd az oldalt.
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
        canWrite={canWrite}
        initialQ={q}
        initialStatus={status}
        initialSms={sms}
      />
    </Suspense>
  )
}
