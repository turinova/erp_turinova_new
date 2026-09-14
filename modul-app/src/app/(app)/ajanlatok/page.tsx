import type { Metadata } from 'next'
import { Suspense } from 'react'

import { QuotesListClient } from '@/components/quotes/quotes-list-client'
import { getSessionUser } from '@/lib/auth/session'
import { listQuotes } from '@/lib/quotes/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Árajánlatok'
}

type SearchParams = Promise<{
  q?: string
  page?: string
}>

export default async function AjanlatokPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)

  let loadError: string | null = null
  let rows: Awaited<ReturnType<typeof listQuotes>>['rows'] = []
  let total = 0
  let limit = 25

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const result = await listQuotes(supabase, {
          tenantId: user.tenantId,
          status: 'draft',
          q: q || undefined,
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
            : 'Nem sikerült betölteni az árajánlatokat.'
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
        <h1 className="text-h1 text-ink">Árajánlatok</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Ha még nem futott, futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260316_quotes.sql
          </code>{' '}
          fájlt a Supabase SQL Editorben.
        </p>
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <QuotesListClient
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        canWrite={canWrite}
        initialQ={q}
      />
    </Suspense>
  )
}
