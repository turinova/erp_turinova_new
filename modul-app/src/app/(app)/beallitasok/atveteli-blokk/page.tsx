import type { Metadata } from 'next'

import { HandoverSlipSettingsClient } from '@/components/handover-slip/handover-slip-settings-client'
import { getSessionUser } from '@/lib/auth/session'
import { ensureHandoverSlipSettingsRow } from '@/lib/handover-slip/queries'
import {
  DEFAULT_HANDOVER_SLIP_SETTINGS,
  type HandoverSlipReviewQr
} from '@/lib/handover-slip/types'
import { loadHandoverReviewQr } from '@/lib/reviews/handover-qr'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Átvételi blokk'
}

export default async function HandoverSlipSettingsPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let initial = { ...DEFAULT_HANDOVER_SLIP_SETTINGS }
  let loadError: string | null = null
  let reviewQr: HandoverSlipReviewQr | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        ;[initial, reviewQr] = await Promise.all([
          ensureHandoverSlipSettingsRow(supabase, user.tenantId),
          loadHandoverReviewQr(supabase, user.tenantId)
        ])
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni az átvételi blokk beállításokat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et, és futtasd a 20260565 migrációt.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Átvételi blokk</h1>
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
    <HandoverSlipSettingsClient
      initial={initial}
      canWrite={canWrite}
      reviewQr={reviewQr}
    />
  )
}
