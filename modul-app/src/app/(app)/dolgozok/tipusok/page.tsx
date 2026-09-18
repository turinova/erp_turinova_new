import type { Metadata } from 'next'

import { EmployeeTypesClient } from '@/components/jelenlet/employee-types-client'
import { getSessionUser } from '@/lib/auth/session'
import { listEmployeeTypes } from '@/lib/jelenlet/employee-types-queries'
import type { HrEmployeeTypeRow } from '@/lib/jelenlet/types'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Dolgozó típusok' }

export default async function DolgozoTipusokPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let rows: HrEmployeeTypeRow[] = []
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        rows = await listEmployeeTypes(supabase, user.tenantId, {
          includeInactive: true
        })
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a típusokat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Futtasd a hr_employee_types migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Dolgozó típusok</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260519_hr_employee_types.sql
          </code>{' '}
          fájlt, majd frissítsd az oldalt.
        </p>
      </div>
    )
  }

  return <EmployeeTypesClient initialRows={rows} canWrite={canWrite} />
}
