import type { Metadata } from 'next'
import { Suspense } from 'react'

import { KeresoClient } from '@/components/search/kereso-client'
import { getSessionUser } from '@/lib/auth/session'
import {
  parseSearchKindParam,
  searchMaterialsUnified
} from '@/lib/search/materials-search'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Kereső'
}

type SearchParams = Promise<{
  q?: string
  page?: string
  kind?: string
}>

export default async function KeresoPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const user = await getSessionUser()
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)
  const kind = parseSearchKindParam(params.kind)

  let loadError: string | null = null
  let rows: Awaited<ReturnType<typeof searchMaterialsUnified>>['rows'] = []
  let total = 0
  let limit = 25

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      // Deep-link seed only — gépelés közben /api/kereso
      if (q) {
        try {
          const result = await searchMaterialsUnified(supabase, {
            tenantId: user.tenantId,
            q,
            page,
            limit: 25,
            kind
          })
          rows = result.rows
          total = result.total
          limit = result.limit
        } catch (err) {
          loadError =
            err instanceof Error
              ? err.message
              : 'Nem sikerült betölteni a keresést.'
        }
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et.'
  } else if (!user) {
    loadError = 'Nincs bejelentkezve.'
  } else {
    loadError = 'Nincs aktív céged.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Kereső</h1>
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
      <KeresoClient
        initialRows={rows}
        initialTotal={total}
        initialPage={page}
        initialLimit={limit}
        initialQ={q}
        initialKind={kind}
      />
    </Suspense>
  )
}
