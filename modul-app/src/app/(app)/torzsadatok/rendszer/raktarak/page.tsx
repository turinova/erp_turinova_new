import type { Metadata } from 'next'

import { WarehousesClient } from '@/components/warehouses/warehouses-client'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { listWarehouses } from '@/lib/warehouses/queries'

export const metadata: Metadata = {
  title: 'Raktárak'
}

export default async function RaktarakPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let rows: Awaited<ReturnType<typeof listWarehouses>> = []
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        rows = await listWarehouses(supabase, user.tenantId)
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a raktárakat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et, és futtasd a warehouses migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Raktárak</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260503_warehouses.sql
          </code>{' '}
          fájlt a Supabase SQL Editorben, majd frissítsd az oldalt.
        </p>
      </div>
    )
  }

  return <WarehousesClient initialRows={rows} canWrite={canWrite} />
}
