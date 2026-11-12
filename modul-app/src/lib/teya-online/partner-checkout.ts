'use server'

import { getPartnerSession } from '@/lib/auth/partner-session'
import {
  partnerBillingForProformaReady,
  partnerBillingIncompleteMessage
} from '@/lib/partner/auto-proforma-rules'
import {
  quoteRemainingGross,
  roundQuoteMoney
} from '@/lib/quotes/payment-labels'
import { resolvePaymentMethodKind } from '@/lib/payment-methods/kinds'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createTeyaCheckoutSession } from '@/lib/teya-online/client'
import {
  credentialsFromRow,
  getTeyaOnlineSettingsRow,
  toTeyaOnlinePublic
} from '@/lib/teya-online/queries'

export type PartnerTeyaCheckoutResult =
  | {
      ok: true
      sessionToken: string
      sessionId: string
      amountHuf: number
      currency: 'HUF'
      env: 'staging' | 'production'
      quoteNumber: string
      quoteId: string
    }
  | {
      ok: false
      message: string
      code?:
        | 'billing_incomplete'
        | 'teya_not_ready'
        | 'already_paid'
        | 'not_card'
        | 'not_found'
    }

/**
 * Partner bankkártyás Embedded Checkout session.
 * Credentialt service role olvassa (partner RLS nem látja a secretet).
 */
export async function createPartnerTeyaCheckoutSession(
  quoteIdRaw: string
): Promise<PartnerTeyaCheckoutResult> {
  const session = await getPartnerSession()
  if (!session) {
    return { ok: false, message: 'Nincs bejelentkezve.', code: 'not_found' }
  }
  const tenantId = session.selectedTenantId
  if (!tenantId) {
    return {
      ok: false,
      message: 'Nincs kapcsolt cég. Válassz céget a Beállításokban.'
    }
  }

  const quoteId = quoteIdRaw.trim()
  if (!quoteId) {
    return { ok: false, message: 'Hiányzó rendelés.', code: 'not_found' }
  }

  const billing = partnerBillingForProformaReady({
    name: session.profile.name,
    billing_name: session.profile.billing_name,
    email: session.email,
    billing_postal_code: session.profile.billing_postal_code,
    billing_city: session.profile.billing_city,
    billing_street: session.profile.billing_street
  })
  if (!billing.ok) {
    return {
      ok: false,
      message: partnerBillingIncompleteMessage(billing),
      code: 'billing_incomplete'
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return { ok: false, message: 'Az adatbázis kapcsolat nem elérhető.' }
  }

  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .select(
      `
      id,
      quote_number,
      tenant_id,
      source,
      portal_submitted_at,
      payment_status,
      total_gross,
      final_total_gross,
      preferred_payment_method_id,
      preferred_payment_method_name
    `
    )
    .eq('id', quoteId)
    .eq('partner_profile_id', session.id)
    .eq('source', 'portal')
    .is('deleted_at', null)
    .maybeSingle()

  if (quoteErr) {
    console.error('createPartnerTeyaCheckoutSession quote', quoteErr.message)
    return {
      ok: false,
      message: 'Nem sikerült betölteni a rendelést.',
      code: 'not_found'
    }
  }
  if (!quote) {
    return {
      ok: false,
      message: 'A rendelés nem található.',
      code: 'not_found'
    }
  }
  if (quote.tenant_id !== tenantId) {
    return {
      ok: false,
      message: 'Ez a rendelés másik céghez tartozik. Válts kapcsolt céget.'
    }
  }
  if (!quote.portal_submitted_at) {
    return {
      ok: false,
      message: 'Előbb küldd be az ajánlatot, aztán fizethetsz kártyával.'
    }
  }
  if (quote.payment_status === 'paid') {
    return {
      ok: false,
      message: 'Ez a rendelés már ki van fizetve.',
      code: 'already_paid'
    }
  }

  let methodKind = resolvePaymentMethodKind({
    kind: null,
    name: quote.preferred_payment_method_name
  })
  if (quote.preferred_payment_method_id) {
    const { data: method } = await supabase
      .from('payment_methods')
      .select('id, kind, name')
      .eq('id', quote.preferred_payment_method_id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (method) {
      methodKind = resolvePaymentMethodKind(method)
    }
  }
  if (methodKind !== 'card') {
    return {
      ok: false,
      message:
        'Ehhez a rendeléshez nem bankkártyás fizetés van választva. Ha kártyával szeretnél fizetni, jelezd a cégnek.',
      code: 'not_card'
    }
  }

  const finalGross = roundQuoteMoney(
    Number(quote.final_total_gross ?? quote.total_gross) || 0
  )

  // total_paid nincs a quotes táblán — Σ quote_payments (partner RLS).
  const { data: paymentRows, error: paymentsErr } = await supabase
    .from('quote_payments')
    .select('amount')
    .eq('quote_id', quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  if (paymentsErr) {
    console.error(
      'createPartnerTeyaCheckoutSession payments',
      paymentsErr.message
    )
    return {
      ok: false,
      message: 'Nem sikerült betölteni a befizetéseket.'
    }
  }

  const totalPaid = roundQuoteMoney(
    (paymentRows ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
  )
  const amountHuf = quoteRemainingGross(finalGross, totalPaid)
  if (!(amountHuf > 0)) {
    return {
      ok: false,
      message: 'Nincs fizetendő összeg.',
      code: 'already_paid'
    }
  }

  const admin = createServiceClient()
  if (!admin) {
    return {
      ok: false,
      message: 'A fizetés most nem érhető el (szerver konfiguráció).'
    }
  }

  let settingsRow
  try {
    settingsRow = await getTeyaOnlineSettingsRow(admin, tenantId)
  } catch (err) {
    console.error('createPartnerTeyaCheckoutSession settings', err)
    return {
      ok: false,
      message: 'Nem sikerült betölteni a Teya beállításokat.',
      code: 'teya_not_ready'
    }
  }

  const pub = toTeyaOnlinePublic(settingsRow)
  if (!pub.ready) {
    return {
      ok: false,
      message:
        'A cégnél még nincs beállítva az online kártyás fizetés. Válassz átutalást, vagy jelezd nekik.',
      code: 'teya_not_ready'
    }
  }

  const creds = credentialsFromRow(settingsRow)
  if (!creds) {
    return {
      ok: false,
      message: 'Hiányos Teya konfiguráció a cégnél.',
      code: 'teya_not_ready'
    }
  }

  const idempotencyKey = crypto.randomUUID()
  const merchantReference = (quote.quote_number as string).slice(0, 64)

  try {
    const created = await createTeyaCheckoutSession(creds, {
      amountHuf,
      merchantReference,
      idempotencyKey,
      metadata: {
        quote_id: quoteId,
        tenant_id: tenantId,
        partner_id: session.id
      }
    })

    return {
      ok: true,
      sessionToken: created.sessionToken,
      sessionId: created.sessionId,
      amountHuf,
      currency: 'HUF',
      env: creds.env,
      quoteNumber: quote.quote_number as string,
      quoteId
    }
  } catch (err) {
    console.error('createPartnerTeyaCheckoutSession', err)
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült elindítani a kártyás fizetést.'
    }
  }
}
