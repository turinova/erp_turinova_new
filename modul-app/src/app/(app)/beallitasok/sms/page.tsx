import type { Metadata } from 'next'
import Link from 'next/link'

import { SmsSettingsForm } from '@/components/sms/sms-settings-form'
import { getSessionUser } from '@/lib/auth/session'
import { tenantHasQuoteReadySms } from '@/lib/sms/entitlement'
import { getTenantSmsTemplate } from '@/lib/sms/templates'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'SMS sablon'
}

export default async function SmsSettingsPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let loadError: string | null = null
  let missingAddon = false
  let initialBody = ''

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (!supabase) {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    } else {
      const hasAddon = await tenantHasQuoteReadySms(supabase, user.tenantId)
      if (!hasAddon) {
        missingAddon = true
      } else {
        try {
          initialBody = await getTenantSmsTemplate(supabase, user.tenantId)
        } catch (err) {
          loadError =
            err instanceof Error
              ? err.message
              : 'Nem sikerült betölteni a sablont.'
        }
      }
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et.'
  } else {
    loadError = 'Nincs aktív céged.'
  }

  if (missingAddon) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">SMS sablon</h1>
        <p className="max-w-xl rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-warning-ink">
          A Készre jelentés SMS add-on nincs bekapcsolva ennél a cégnél. A
          platform kapcsolhatja be.
        </p>
        <Link
          href="/beallitasok/cegadatok"
          className="text-hint text-ink no-underline hover:underline"
        >
          Vissza a cégadatokhoz
        </Link>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">SMS sablon</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
      </div>
    )
  }

  return <SmsSettingsForm initialBody={initialBody} canWrite={canWrite} />
}
