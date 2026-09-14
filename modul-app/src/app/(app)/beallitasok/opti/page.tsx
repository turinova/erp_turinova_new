import type { Metadata } from 'next'

import { OptiSettingsForm } from '@/components/opti-settings/opti-settings-form'
import { getSessionUser } from '@/lib/auth/session'
import {
  getCuttingFee,
  listTaxRateOptions,
  type CuttingFeeRow,
  type TaxRateOption
} from '@/lib/cutting-fees/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Opti beállítások'
}

export default async function OptiSettingsPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let cuttingFee: CuttingFeeRow | null = null
  let taxRates: TaxRateOption[] = []
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        ;[cuttingFee, taxRates] = await Promise.all([
          getCuttingFee(supabase, user.tenantId),
          listTaxRateOptions(supabase, user.tenantId)
        ])
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni az Opti beállításokat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et, és futtasd a cutting_fees migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Opti beállítások</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260313_cutting_fees.sql
          </code>{' '}
          migrációt, majd a seedet.
        </p>
      </div>
    )
  }

  return (
    <OptiSettingsForm
      initial={cuttingFee}
      taxRates={taxRates}
      canWrite={canWrite}
    />
  )
}
