import type { SupabaseClient } from '@supabase/supabase-js'

import { resolveKioskCustomer } from '@/lib/kiosk/customer-match'
import { normalizeGuestName } from '@/lib/kiosk/customer-match-rules'
import { validateKioskGuest } from '@/lib/kiosk/guest'
import type { KioskPriceLineInput } from '@/lib/kiosk/map-to-opti'
import { buildKioskCartQuote } from '@/lib/kiosk/price'
import type { KioskGuest } from '@/lib/kiosk/types'
import { allocatePartnerQuoteNumber } from '@/lib/quotes/partner-quote-number'
import { persistOptiQuoteChildren } from '@/lib/quotes/persist-opti-quote'
import { quotePricingMode } from '@/lib/quotes/snapshot'

export const KIOSK_CONSENT_VERSION = 'v1-2026-11'

/** Ennyi Ft eltérésig nem kérdezünk rá az árváltozásra (kerekítés). */
const PRICE_DRIFT_TOLERANCE_GROSS = 1

export type KioskSubmitInput = {
  tenantId: string
  deviceId: string | null
  submissionId: string
  lines: KioskPriceLineInput[]
  guest: KioskGuest
  expectedTotalGross: number | null
}

export type KioskSubmitResult =
  | { ok: true; quoteId: string; quoteNumber: string; totalGross: number }
  | {
      ok: false
      status: number
      code:
        | 'guest'
        | 'validation'
        | 'price_changed'
        | 'unplaced'
        | 'disabled'
        | 'server'
      message: string
      totalGross?: number
    }

async function findBySubmission(
  admin: SupabaseClient,
  tenantId: string,
  submissionId: string
): Promise<{ id: string; quote_number: string; total_gross: number } | null> {
  const { data } = await admin
    .from('quotes')
    .select('id, quote_number, total_gross')
    .eq('tenant_id', tenantId)
    .eq('kiosk_submission_id', submissionId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id as string,
    quote_number: data.quote_number as string,
    total_gross: Number(data.total_gross) || 0
  }
}

function isUniqueViolation(
  error: { code?: string; message?: string } | null,
  needle: string
): boolean {
  return Boolean(
    error && error.code === '23505' && (error.message ?? '').includes(needle)
  )
}

/**
 * Kiosk leadás → piszkozat ajánlat (`source = 'kiosk'`).
 * Az árat a szerver számolja újra; a kliens ár csak eltérés-ellenőrzésre kell.
 */
export async function submitKioskOrder(
  admin: SupabaseClient,
  input: KioskSubmitInput
): Promise<KioskSubmitResult> {
  const { tenantId } = input

  const existing = await findBySubmission(admin, tenantId, input.submissionId)
  if (existing) {
    return {
      ok: true,
      quoteId: existing.id,
      quoteNumber: existing.quote_number,
      totalGross: Math.round(existing.total_gross)
    }
  }

  const v = validateKioskGuest(input.guest)
  if (!v.ok) {
    return {
      ok: false,
      status: 422,
      code: 'guest',
      message: v.missing ?? 'Hiányzó adat.'
    }
  }

  const built = await buildKioskCartQuote(admin, tenantId, input.lines)
  if (!built.ok) {
    const disabled = built.error.code === 'disabled'
    return {
      ok: false,
      status: disabled ? 403 : 422,
      code: disabled
        ? 'disabled'
        : built.error.code === 'unplaced'
          ? 'unplaced'
          : 'validation',
      message: disabled
        ? 'A kiosk most nem fogad rendelést. Szólj a pultnál.'
        : built.error.message
    }
  }

  const totalGross = Math.round(built.quote.grand_total_gross)
  if (
    input.expectedTotalGross == null ||
    Math.abs(totalGross - input.expectedTotalGross) > PRICE_DRIFT_TOLERANCE_GROSS
  ) {
    return {
      ok: false,
      status: 409,
      code: 'price_changed',
      message: 'Az ár közben változott.',
      totalGross
    }
  }

  const customer = await resolveKioskCustomer(admin, tenantId, input.guest)
  if (!customer.ok) {
    return { ok: false, status: 500, code: 'server', message: customer.message }
  }

  const guest = input.guest
  const billing =
    guest.billingMode === 'here'
      ? {
          billing_name_snapshot: guest.billing.name.trim() || null,
          billing_country_snapshot: 'Magyarország',
          billing_postal_code_snapshot: guest.billing.postalCode.trim() || null,
          billing_city_snapshot: guest.billing.city.trim() || null,
          billing_street_snapshot: guest.billing.street.trim() || null,
          billing_house_number_snapshot:
            guest.billing.houseNumber.trim() || null,
          billing_tax_number_snapshot: guest.billing.taxNumber.trim() || null
        }
      : {}

  const now = new Date().toISOString()
  let quoteId: string | null = null
  let quoteNumber = ''

  for (let attempt = 0; attempt < 3 && !quoteId; attempt++) {
    const allocated = await allocatePartnerQuoteNumber(tenantId)
    if (!allocated.ok) {
      return { ok: false, status: 500, code: 'server', message: allocated.message }
    }

    const { data: inserted, error: insertError } = await admin
      .from('quotes')
      .insert({
        tenant_id: tenantId,
        customer_id: customer.customerId,
        quote_number: allocated.quoteNumber,
        status: 'draft',
        source: 'kiosk',
        pricing_mode: quotePricingMode(built.quote),
        currency: built.quote.currency || 'HUF',
        total_net: Math.round(built.quote.grand_total_net),
        total_vat: Math.round(built.quote.grand_total_vat),
        total_gross: totalGross,
        created_by: null,
        kiosk_submitted_at: now,
        kiosk_device_id: input.deviceId,
        kiosk_submission_id: input.submissionId,
        kiosk_guest_name: normalizeGuestName(guest.name),
        kiosk_guest_phone: guest.phone.trim(),
        kiosk_guest_email: guest.email.trim() || null,
        kiosk_consent_at: now,
        kiosk_consent_version: KIOSK_CONSENT_VERSION,
        kiosk_customer_match: customer.match,
        ...billing
      })
      .select('id')
      .single()

    if (!insertError && inserted) {
      quoteId = inserted.id as string
      quoteNumber = allocated.quoteNumber
      break
    }

    if (isUniqueViolation(insertError, 'kiosk_submission')) {
      const dup = await findBySubmission(admin, tenantId, input.submissionId)
      if (dup) {
        return {
          ok: true,
          quoteId: dup.id,
          quoteNumber: dup.quote_number,
          totalGross: Math.round(dup.total_gross)
        }
      }
    }
    if (!isUniqueViolation(insertError, 'quote_number')) {
      console.error('kiosk quotes insert', insertError?.message)
      return {
        ok: false,
        status: 500,
        code: 'server',
        message: 'Nem sikerült leadni a rendelést.'
      }
    }
  }

  if (!quoteId) {
    return {
      ok: false,
      status: 500,
      code: 'server',
      message: 'Nem sikerült leadni a rendelést.'
    }
  }

  const persisted = await persistOptiQuoteChildren({
    supabase: admin,
    tenantId,
    quoteId,
    panels: built.panels,
    quote: built.quote,
    sheetMaterials: built.usedSheets,
    logPrefix: 'kiosk'
  })

  if (!persisted.ok) {
    await admin
      .from('quotes')
      .update({ deleted_at: new Date().toISOString(), kiosk_submission_id: null })
      .eq('id', quoteId)
      .eq('tenant_id', tenantId)
    return {
      ok: false,
      status: 500,
      code: 'server',
      message: 'Nem sikerült leadni a rendelést.'
    }
  }

  return { ok: true, quoteId, quoteNumber, totalGross }
}
