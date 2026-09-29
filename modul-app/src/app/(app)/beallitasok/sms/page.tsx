import type { Metadata } from 'next'
import Link from 'next/link'

import { SmsSettingsForm } from '@/components/sms/sms-settings-form'
import { getSessionUser } from '@/lib/auth/session'
import { tenantHasQuoteReadySms } from '@/lib/sms/entitlement'
import { getTenantSmsTemplate } from '@/lib/sms/templates'
import {
  CSO_READY_TEMPLATE_KEY,
  QUOTE_READY_TEMPLATE_KEY,
  defaultSmsBody
} from '@/lib/sms/types'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'SMS sablonok'
}

export default async function SmsSettingsPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let loadError: string | null = null
  let missingAccess = false
  let showQuote = false
  let showCso = false
  let quoteBody = defaultSmsBody(QUOTE_READY_TEMPLATE_KEY)
  let csoBody = defaultSmsBody(CSO_READY_TEMPLATE_KEY)

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (!supabase) {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    } else {
      const [hasQuote, csoEnt] = await Promise.all([
        tenantHasQuoteReadySms(supabase, user.tenantId),
        supabase
          .from('tenant_entitlements')
          .select('feature_key')
          .eq('tenant_id', user.tenantId)
          .eq('feature_key', 'customer_special_orders')
          .maybeSingle()
      ])
      const hasCso = Boolean(csoEnt.data)
      showQuote = hasQuote
      showCso = hasCso || hasQuote

      if (!showQuote && !showCso) {
        missingAccess = true
      } else {
        try {
          const loads: Promise<string>[] = []
          if (showQuote) {
            loads.push(
              getTenantSmsTemplate(
                supabase,
                user.tenantId,
                QUOTE_READY_TEMPLATE_KEY
              )
            )
          } else {
            loads.push(Promise.resolve(quoteBody))
          }
          if (showCso) {
            loads.push(
              getTenantSmsTemplate(
                supabase,
                user.tenantId,
                CSO_READY_TEMPLATE_KEY
              )
            )
          } else {
            loads.push(Promise.resolve(csoBody))
          }
          const [q, c] = await Promise.all(loads)
          quoteBody = q
          csoBody = c
        } catch (err) {
          loadError =
            err instanceof Error
              ? err.message
              : 'Nem sikerült betölteni a sablonokat.'
        }
      }
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et.'
  } else {
    loadError = 'Nincs aktív céged.'
  }

  if (missingAccess) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">SMS sablonok</h1>
        <p className="max-w-xl rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-warning-ink">
          Nincs bekapcsolva a készre jelentés SMS add-on, és nincs
          ügyfélrendelés jogosultság sem.
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
        <h1 className="text-h1 text-ink">SMS sablonok</h1>
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
    <SmsSettingsForm
      quoteBody={quoteBody}
      csoBody={csoBody}
      showQuote={showQuote}
      showCso={showCso}
      canWrite={canWrite}
    />
  )
}
