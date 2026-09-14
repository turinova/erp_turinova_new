import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { PartnerQuotesListClient } from '@/components/partner/partner-quotes-list-client'
import { getPartnerSession } from '@/lib/auth/partner-session'
import { PARTNER_SETTINGS_PATH } from '@/lib/auth/surface'
import { listPartnerSubmittedQuotes } from '@/lib/partner/quotes-queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Megrendelések · Asztalos' }

type SearchParams = Promise<{
  q?: string
  page?: string
}>

export default async function PartnerMegrendelesekPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const session = await getPartnerSession()
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)

  if (!session) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Megrendelések</h1>
        <p className="text-body text-ink-secondary">Nincs bejelentkezve.</p>
      </div>
    )
  }

  if (!session.selectedTenantId) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Megrendelések</h1>
        <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-warning-ink">
          Nincs kapcsolt cég. Válassz céget a Beállításokban.
        </p>
        <Link
          href={PARTNER_SETTINGS_PATH}
          className="text-hint text-ink no-underline hover:underline"
        >
          Beállítások → Kapcsolt cég
        </Link>
      </div>
    )
  }

  let loadError: string | null = null
  let rows: Awaited<ReturnType<typeof listPartnerSubmittedQuotes>>['rows'] = []
  let total = 0
  let limit = 25

  const supabase = await createClient()
  if (!supabase) {
    loadError = 'Az adatbázis kapcsolat nem elérhető.'
  } else {
    try {
      const result = await listPartnerSubmittedQuotes(supabase, {
        partnerId: session.id,
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
          : 'Nem sikerült betölteni a megrendeléseket.'
    }
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
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <PartnerQuotesListClient
        mode="submitted"
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        initialQ={q}
      />
    </Suspense>
  )
}
