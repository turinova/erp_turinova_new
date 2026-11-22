import type { SupabaseClient } from '@supabase/supabase-js'

import {
  isCustomerNameConflict,
  matchKindForCount,
  normalizeGuestName,
  renamedCustomerName,
  type KioskCustomerMatch
} from '@/lib/kiosk/customer-match-rules'
import type { KioskGuest } from '@/lib/kiosk/types'

type PhoneMatchRow = {
  id: string
  name: string
  email: string | null
  billing_name: string | null
  billing_city: string | null
}

export type KioskCustomerResult =
  | { ok: true; customerId: string; match: KioskCustomerMatch }
  | { ok: false; message: string }

function emptyToNull(value: string): string | null {
  const t = value.trim()
  return t === '' ? null : t
}

function guestBillingFields(guest: KioskGuest) {
  if (guest.billingMode !== 'here') return null
  const b = guest.billing
  return {
    billing_name: emptyToNull(b.name),
    billing_country: 'Magyarország',
    billing_postal_code: emptyToNull(b.postalCode),
    billing_city: emptyToNull(b.city),
    billing_street: emptyToNull(b.street),
    billing_house_number: emptyToNull(b.houseNumber),
    billing_tax_number: emptyToNull(b.taxNumber)
  }
}

/** Meglévő ügyfél: csak az üres mezőket töltjük (nevet, kitöltött adatot nem írunk felül). */
async function fillEmptyFields(
  admin: SupabaseClient,
  tenantId: string,
  row: PhoneMatchRow,
  guest: KioskGuest
): Promise<void> {
  const patch: Record<string, string | null> = {}
  const email = emptyToNull(guest.email)
  if (email && !row.email?.trim()) patch.email = email

  const billing = guestBillingFields(guest)
  if (billing && !row.billing_name?.trim() && !row.billing_city?.trim()) {
    Object.assign(patch, billing)
  }

  if (Object.keys(patch).length === 0) return

  const { error } = await admin
    .from('customers')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('kiosk customer fill', error.message)
  }
}

/**
 * Telefonszám-egyezés (normalizált) → meglévő ügyfél, különben új ügyfél.
 * Több egyezésnél a legutóbb módosított, `phone_multiple` jelzéssel (pult dönt).
 */
export async function resolveKioskCustomer(
  admin: SupabaseClient,
  tenantId: string,
  guest: KioskGuest
): Promise<KioskCustomerResult> {
  const { data: matches, error: matchError } = await admin.rpc(
    'find_customers_by_phone',
    { p_tenant_id: tenantId, p_phone: guest.phone }
  )

  if (matchError) {
    console.error('find_customers_by_phone', matchError.message)
    return { ok: false, message: 'Nem sikerült ellenőrizni az ügyfelet.' }
  }

  const rows = (matches ?? []) as PhoneMatchRow[]
  const matchKind = matchKindForCount(rows.length)
  if (matchKind && rows[0]) {
    await fillEmptyFields(admin, tenantId, rows[0], guest)
    return { ok: true, customerId: rows[0].id, match: matchKind }
  }

  const baseName = normalizeGuestName(guest.name)
  const billing = guestBillingFields(guest)
  const names: Array<{ name: string; renamed: boolean }> = [
    { name: baseName, renamed: false },
    { name: renamedCustomerName(baseName, guest.phone, 1), renamed: true },
    { name: renamedCustomerName(baseName, guest.phone, 2), renamed: true }
  ]

  for (const candidate of names) {
    const { data, error } = await admin
      .from('customers')
      .insert({
        tenant_id: tenantId,
        name: candidate.name,
        mobile: guest.phone.trim(),
        email: emptyToNull(guest.email),
        sms_notification: true,
        ...(billing ?? {})
      })
      .select('id')
      .single()

    if (!error && data) {
      return {
        ok: true,
        customerId: data.id as string,
        match: candidate.renamed ? 'created_renamed' : 'created'
      }
    }
    if (!isCustomerNameConflict(error)) {
      console.error('kiosk customer insert', error?.message)
      return { ok: false, message: 'Nem sikerült rögzíteni az adataidat.' }
    }
  }

  return { ok: false, message: 'Nem sikerült rögzíteni az adataidat.' }
}
