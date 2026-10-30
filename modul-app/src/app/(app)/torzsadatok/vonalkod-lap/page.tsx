import type { Metadata } from 'next'

import { A4SheetsListClient } from '@/components/a4-barcode-sheets/a4-sheets-list-client'
import { listA4BarcodeSheets } from '@/lib/a4-barcode-sheets/queries'
import { getSessionUser } from '@/lib/auth/session'
import { tenantHasProductLabels } from '@/lib/labels/entitlement'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Vonalkód lap'
}

export default async function VonalkodLapPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let rows: Awaited<ReturnType<typeof listA4BarcodeSheets>>['rows'] = []
  let loadError: string | null = null
  let labelsOk = false

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        labelsOk = await tenantHasProductLabels(supabase, user.tenantId)
        if (!labelsOk) {
          loadError =
            'A vonalkód lap a címkenyomtatás csomaghoz tartozik (product_labels).'
        } else {
          const listed = await listA4BarcodeSheets(supabase, user.tenantId, {
            limit: 25
          })
          rows = listed.rows
        }
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a vonalkód lapokat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et, és futtasd a 20260624_a4_barcode_sheets migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Vonalkód lap</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        {!labelsOk ? null : (
          <p className="max-w-xl text-body text-ink-secondary">
            Futtasd a{' '}
            <code className="text-hint">
              supabase/migrations/20260624_a4_barcode_sheets.sql
            </code>{' '}
            fájlt a Supabase SQL Editorben, majd frissítsd az oldalt.
          </p>
        )}
      </div>
    )
  }

  return <A4SheetsListClient initialRows={rows} canWrite={canWrite} />
}
