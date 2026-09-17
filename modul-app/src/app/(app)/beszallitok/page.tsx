import type { Metadata } from 'next'
import { Suspense } from 'react'

import { SuppliersListClient } from '@/components/suppliers/suppliers-list-client'
import { getSessionUser } from '@/lib/auth/session'
import type { SupplierStatus } from '@/lib/suppliers/parse'
import { listSuppliers } from '@/lib/suppliers/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Beszállítók'
}

type SearchParams = Promise<{
  q?: string
  page?: string
  status?: string
}>

function parseStatus(raw?: string): SupplierStatus | 'all' {
  if (raw === 'active' || raw === 'inactive') return raw
  return 'all'
}

export default async function BeszallitokListPage({
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

  let loadError: string | null = null
  let rows: Awaited<ReturnType<typeof listSuppliers>>['rows'] = []
  let total = 0
  let limit = 25

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const result = await listSuppliers(supabase, {
          tenantId: user.tenantId,
          q: q || undefined,
          status,
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
            : 'Nem sikerült betölteni a beszállítókat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et, és futtasd a suppliers migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Beszállítók</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260501_suppliers.sql
          </code>{' '}
          fájlt a Supabase SQL Editorben, majd frissítsd az oldalt.
        </p>
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <SuppliersListClient
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        canWrite={canWrite}
        initialQ={q}
        initialStatus={status}
      />
    </Suspense>
  )
}
