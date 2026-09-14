import type { Metadata } from 'next'

import { TaxRatesClient } from '@/components/tax-rates/tax-rates-client'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { listTaxRates } from '@/lib/tax-rates/queries'

export const metadata: Metadata = {
  title: 'Adónem'
}

export default async function AdonemPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let rows: Awaited<ReturnType<typeof listTaxRates>> = []
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        rows = await listTaxRates(supabase, user.tenantId)
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni az adónemeket.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et, és futtasd a tax_rates migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Adónem</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">supabase/migrations/20260310_tax_rates.sql</code>{' '}
          fájlt a Supabase SQL Editorben, majd frissítsd az oldalt. Új demo
          adatokhoz a frissített <code className="text-hint">seed.sql</code> is
          futtatható.
        </p>
      </div>
    )
  }

  return <TaxRatesClient initialRows={rows} canWrite={canWrite} />
}
