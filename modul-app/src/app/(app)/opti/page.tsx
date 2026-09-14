import type { Metadata } from 'next'
import Link from 'next/link'

import { OptiWorkspaceClient } from '@/components/opti/opti-workspace-client'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { getSessionUser } from '@/lib/auth/session'
import {
  getCuttingFee,
  toOptiCuttingFeeConfig
} from '@/lib/cutting-fees/queries'
import { listCustomersForSelect } from '@/lib/customers/queries'
import {
  listOptiEdgeMaterials,
  listOptiSheetMaterials
} from '@/lib/opti/queries'
import { getQuoteForOptiEdit } from '@/lib/quotes/opti-edit'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Opti'
}

type SearchParams = Promise<{
  quote_id?: string
}>

export default async function OptiPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const quoteId = params.quote_id?.trim() || null
  const user = await getSessionUser()

  let loadError: string | null = null
  let sheetMaterials: Awaited<ReturnType<typeof listOptiSheetMaterials>> = []
  let edgeMaterials: Awaited<ReturnType<typeof listOptiEdgeMaterials>> = []
  let cuttingFee: ReturnType<typeof toOptiCuttingFeeConfig> = null
  let customers: Awaited<ReturnType<typeof listCustomersForSelect>> = []
  let initialEdit: Awaited<ReturnType<typeof getQuoteForOptiEdit>> = null
  let editLoadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const [sheets, edges, feeRow, customerRows] = await Promise.all([
          listOptiSheetMaterials(supabase, user.tenantId),
          listOptiEdgeMaterials(supabase, user.tenantId),
          getCuttingFee(supabase, user.tenantId),
          listCustomersForSelect(supabase, user.tenantId)
        ])
        sheetMaterials = sheets
        edgeMaterials = edges
        cuttingFee = toOptiCuttingFeeConfig(feeRow)
        customers = customerRows

        if (quoteId) {
          const edit = await getQuoteForOptiEdit(
            supabase,
            user.tenantId,
            quoteId,
            sheetMaterials,
            edgeMaterials
          )
          if (!edit) {
            editLoadError = 'Az árajánlat nem található, vagy nincs hozzáférésed.'
          } else if (!edit.editable) {
            editLoadError =
              edit.warnings[0] ??
              'Ez a dokumentum nem szerkeszthető Optiból.'
            initialEdit = edit
          } else {
            initialEdit = edit
          }
        }
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni az Opti adatokat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et, és futtasd a migrációkat.'
  } else if (!user?.tenantId) {
    loadError = 'Nincs kiválasztott cég. Válassz tenancy-t, majd nyisd meg újra az Optit.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <PageHeader
          title="Opti"
          description="Adj hozzá panelt. Az optimalizálás és a mentés később jön."
        />
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Szükséges migrációk:{' '}
          <code className="text-hint">sheet_materials</code>,{' '}
          <code className="text-hint">edge_materials</code>.
        </p>
        <Link
          href="/torzsadatok/alapanyagok/tablas-anyagok"
          className="inline-flex h-8 w-fit items-center justify-center rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:bg-subtle"
        >
          Táblás anyagok
        </Link>
      </div>
    )
  }

  return (
    <OptiWorkspaceClient
      sheetMaterials={sheetMaterials}
      edgeMaterials={edgeMaterials}
      cuttingFee={cuttingFee}
      customers={customers}
      initialEdit={initialEdit}
      editLoadError={editLoadError}
    />
  )
}
