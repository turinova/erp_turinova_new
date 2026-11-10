import type { Metadata } from 'next'
import Link from 'next/link'

import {
  SmsSettingsForm,
  type SmsReviewState
} from '@/components/sms/sms-settings-form'
import { getSessionUser } from '@/lib/auth/session'
import { getTenantCompany, getTenantGoogleProfile } from '@/lib/company/queries'
import { getTenantReviewSettings } from '@/lib/reviews/settings'
import type { OrderStatusPreviewCompany } from '@/lib/order-status/sample'
import { tenantHasQuoteReadySms } from '@/lib/sms/entitlement'
import { getTenantSmsTemplate } from '@/lib/sms/templates'
import {
  CSO_READY_TEMPLATE_KEY,
  QUOTE_READY_TEMPLATE_KEY,
  REVIEW_THANKS_TEMPLATE_KEY,
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
  let reviewThanksBody = defaultSmsBody(REVIEW_THANKS_TEMPLATE_KEY)
  let review: SmsReviewState | null = null
  let company: OrderStatusPreviewCompany | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (!supabase) {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    } else {
      const [hasQuote, csoEnt, companyRow] = await Promise.all([
        tenantHasQuoteReadySms(supabase, user.tenantId),
        supabase
          .from('tenant_entitlements')
          .select('feature_key')
          .eq('tenant_id', user.tenantId)
          .eq('feature_key', 'customer_special_orders')
          .maybeSingle(),
        getTenantCompany(supabase, user.tenantId).catch(() => null)
      ])
      const hasCso = Boolean(csoEnt.data)
      showQuote = hasQuote
      showCso = hasCso || hasQuote
      if (companyRow) {
        company = {
          name: companyRow.name,
          logoUrl: companyRow.logo_url,
          phone: companyRow.phone_number,
          email: companyRow.email,
          addressLine: [
            [companyRow.postal_code, companyRow.city]
              .filter(Boolean)
              .join(' '),
            companyRow.address
          ]
            .filter((p) => p && String(p).trim())
            .join(', ')
        }
      }

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
          loads.push(
            getTenantSmsTemplate(supabase, user.tenantId, REVIEW_THANKS_TEMPLATE_KEY)
          )
          const [[q, c, r], reviewSettings, google] = await Promise.all([
            Promise.all(loads),
            getTenantReviewSettings(supabase, user.tenantId),
            getTenantGoogleProfile(supabase, user.tenantId)
          ])
          quoteBody = q
          csoBody = c
          reviewThanksBody = r
          review = {
            statusPageEnabled: reviewSettings.settings.statusPageEnabled,
            thankSmsEnabled: reviewSettings.settings.thankSmsEnabled,
            hasLink: Boolean(google.reviewUrl && google.code)
          }
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
      reviewThanksBody={reviewThanksBody}
      review={review}
      showQuote={showQuote}
      showCso={showCso}
      canWrite={canWrite}
      company={company}
    />
  )
}
