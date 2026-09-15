import type { Metadata } from 'next'

import { FeeTypesClient } from '@/components/fee-types/fee-types-client'
import { getSessionUser } from '@/lib/auth/session'
import {
  listFeeTypeTaxOptions,
  listFeeTypeUnitOptions,
  listFeeTypes
} from '@/lib/fee-types/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Díj típusok'
}

export default async function DijTipusokPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let rows: Awaited<ReturnType<typeof listFeeTypes>> = []
  let taxRates: Awaited<ReturnType<typeof listFeeTypeTaxOptions>> = []
  let units: Awaited<ReturnType<typeof listFeeTypeUnitOptions>> = []
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        ;[rows, taxRates, units] = await Promise.all([
          listFeeTypes(supabase, user.tenantId),
          listFeeTypeTaxOptions(supabase, user.tenantId),
          listFeeTypeUnitOptions(supabase, user.tenantId)
        ])
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a díj típusokat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et, és futtasd a fee_types migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Díj típusok</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260413_fee_types.sql
          </code>{' '}
          és a{' '}
          <code className="text-hint">
            supabase/migrations/20260415_fee_types_units.sql
          </code>{' '}
          fájlokat a Supabase SQL Editorben, majd frissítsd az oldalt.
        </p>
      </div>
    )
  }

  return (
    <FeeTypesClient
      initialRows={rows}
      taxRates={taxRates}
      units={units}
      canWrite={canWrite}
    />
  )
}
