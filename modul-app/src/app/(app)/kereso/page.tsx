import type { Metadata } from 'next'
import { Suspense } from 'react'

import { KeresoClient } from '@/components/search/kereso-client'
import { getSessionUser } from '@/lib/auth/session'
import { tenantHasBeszerzes } from '@/lib/beszerzes/entitlement'
import { tenantHasLapszabaszat } from '@/lib/lapszabaszat/entitlement'
import {
  allowedUnifiedKinds,
  resolvePartnerSearchKind,
  type PartnerSearchKinds
} from '@/lib/partner-settings/queries'
import {
  enrichUnifiedRowsWithStockOnHand,
  parseSearchKindParam,
  searchMaterialsUnified,
  type UnifiedSearchKind
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

function staffSearchKinds(hasLapszabaszat: boolean): PartnerSearchKinds {
  return {
    sheet: hasLapszabaszat,
    linear: hasLapszabaszat,
    accessory: true
  }
}

export default async function KeresoPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const user = await getSessionUser()
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)
  const requestedKind = parseSearchKindParam(params.kind)

  let loadError: string | null = null
  let rows: Awaited<ReturnType<typeof searchMaterialsUnified>>['rows'] = []
  let total = 0
  let limit = 25
  let showProcurementStock = false
  let allowedKinds: UnifiedSearchKind[] | undefined
  let kind: ReturnType<typeof parseSearchKindParam> = requestedKind

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      const [hasBeszerzes, hasLapszabaszat] = await Promise.all([
        tenantHasBeszerzes(supabase, user.tenantId),
        tenantHasLapszabaszat(supabase, user.tenantId)
      ])
      showProcurementStock = hasBeszerzes
      const kinds = staffSearchKinds(hasLapszabaszat)
      allowedKinds = hasLapszabaszat
        ? undefined
        : allowedUnifiedKinds(kinds)
      kind = resolvePartnerSearchKind(requestedKind, kinds)

      // Deep-link seed only — gépelés közben /api/kereso
      if (q) {
        try {
          const result = await searchMaterialsUnified(supabase, {
            tenantId: user.tenantId,
            q,
            page,
            limit: 25,
            kind,
            allowedKinds
          })
          rows = showProcurementStock
            ? await enrichUnifiedRowsWithStockOnHand(
                supabase,
                user.tenantId,
                result.rows
              )
            : result.rows
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
        allowedKinds={allowedKinds}
        showProcurementStock={showProcurementStock}
      />
    </Suspense>
  )
}
