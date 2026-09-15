import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { KeresoClient } from '@/components/search/kereso-client'
import { getPartnerSession } from '@/lib/auth/partner-session'
import { PARTNER_SETTINGS_PATH } from '@/lib/auth/surface'
import { resolvePartnerCompanyLabel } from '@/lib/partner/company-label'
import {
  parseSearchKindParam,
  searchMaterialsUnified
} from '@/lib/search/materials-search'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Kereső · Asztalos'
}

type SearchParams = Promise<{
  q?: string
  page?: string
  kind?: string
}>

export default async function PartnerKeresoPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const session = await getPartnerSession()
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)
  const kind = parseSearchKindParam(params.kind)

  if (!session) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Kereső</h1>
        <p className="text-body text-ink-secondary">Nincs bejelentkezve.</p>
      </div>
    )
  }

  const tenantId = session.selectedTenantId
  if (!tenantId) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Kereső</h1>
        <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-warning-ink">
          Nincs kapcsolt cég. Válassz céget a Beállításokban, majd gyere vissza.
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

  const companyLabel = await resolvePartnerCompanyLabel(tenantId)
  let loadError: string | null = null
  let rows: Awaited<ReturnType<typeof searchMaterialsUnified>>['rows'] = []
  let total = 0
  let limit = 25

  const supabase = await createClient()
  if (!supabase) {
    loadError = 'Az adatbázis kapcsolat nem elérhető.'
  } else if (q) {
    try {
      const result = await searchMaterialsUnified(supabase, {
        tenantId,
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
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        initialQ={q}
        initialKind={kind}
        sheetDetailBase={null}
        linearDetailBase={null}
        accessoryDetailBase={null}
        description={
          companyLabel
            ? `Árlekérdezés — ${companyLabel}. Táblás, szálas és termék (bruttó Ft/m, Ft/m², egységár; tájékoztató).`
            : 'Táblás, szálas és termék árlekérdezés — bruttó Ft/m, Ft/m² és egységár (tájékoztató).'
        }
      />
    </Suspense>
  )
}
