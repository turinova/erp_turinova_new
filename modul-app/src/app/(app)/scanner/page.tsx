import type { Metadata } from 'next'

import { ScannerClient } from '@/components/scanner/scanner-client'
import { getSessionUser } from '@/lib/auth/session'
import { listActivePaymentMethods } from '@/lib/payment-methods/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Scanner'
}

export default async function ScannerPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let loadError: string | null = null
  let paymentMethods: Awaited<
    ReturnType<typeof listActivePaymentMethods>
  > = []

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        paymentMethods = await listActivePaymentMethods(
          supabase,
          user.tenantId
        )
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a fizetési módokat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et.'
  } else {
    loadError = 'Nincs aktív céged.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Scanner</h1>
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
    <ScannerClient canWrite={canWrite} paymentMethods={paymentMethods} />
  )
}
