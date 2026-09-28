import type { SupabaseClient } from '@supabase/supabase-js'

import { COUNTIES } from '@/lib/webshop/legal/constants'
import type { CountyCode, WebshopLegalSettings } from '@/lib/webshop/legal/types'
import { carrierCodes, paymentCodes } from '@/lib/webshop/settings'

export const DEFAULT_LEGAL_SETTINGS: WebshopLegalSettings = {
  shippingCarriers: [],
  paymentMethods: [],
  bankAccount: null,
  transferHoldDays: null,
  returnShippingPaidBy: 'customer',
  sellerName: null,
  postalCode: null,
  city: null,
  address: null,
  email: null,
  phone: null,
  taxNumber: null,
  registrationNumber: null,
  vatId: null,
  county: null,
  serviceAddress: null,
  supportHours: null,
  audience: 'consumer',
  madeToOrder: false,
  mandatoryWarranty: false,
  newsletter: false,
  microEnterprise: true,
  termsUrl: null,
  privacyUrl: null
}

const COLUMNS = `
  shipping_carriers, payment_methods, bank_account, transfer_hold_days, return_shipping_paid_by,
  legal_seller_name, legal_postal_code, legal_city, legal_address, legal_email, legal_phone,
  legal_tax_number, legal_registration_number, legal_vat_id, legal_county,
  service_address, support_hours, audience, made_to_order, mandatory_warranty, newsletter,
  micro_enterprise, terms_url, privacy_url
`

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** A tenant saját (nyers) jogi bemenetei — a 20260551 migráció előtt alapértékek. */
export async function getWebshopLegalSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<WebshopLegalSettings> {
  const { data, error } = await supabase
    .from('tenant_webshop_settings')
    .select(COLUMNS)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) {
    if (error.code !== '42703') console.error('getWebshopLegalSettings', error.message)
    return { ...DEFAULT_LEGAL_SETTINGS }
  }
  if (!data) return { ...DEFAULT_LEGAL_SETTINGS }
  const r = data as Record<string, unknown>
  const county = text(r.legal_county)
  const hold = Number(r.transfer_hold_days)
  return {
    shippingCarriers: carrierCodes(r.shipping_carriers),
    paymentMethods: paymentCodes(r.payment_methods),
    bankAccount: text(r.bank_account),
    transferHoldDays: Number.isInteger(hold) && hold > 0 ? hold : null,
    returnShippingPaidBy: r.return_shipping_paid_by === 'seller' ? 'seller' : 'customer',
    sellerName: text(r.legal_seller_name),
    postalCode: text(r.legal_postal_code),
    city: text(r.legal_city),
    address: text(r.legal_address),
    email: text(r.legal_email),
    phone: text(r.legal_phone),
    taxNumber: text(r.legal_tax_number),
    registrationNumber: text(r.legal_registration_number),
    vatId: text(r.legal_vat_id),
    county: county && county in COUNTIES ? (county as CountyCode) : null,
    serviceAddress: text(r.service_address),
    supportHours: text(r.support_hours),
    audience: r.audience === 'business' ? 'business' : 'consumer',
    madeToOrder: r.made_to_order === true,
    mandatoryWarranty: r.mandatory_warranty === true,
    newsletter: r.newsletter === true,
    microEnterprise: r.micro_enterprise !== false,
    termsUrl: text(r.terms_url),
    privacyUrl: text(r.privacy_url)
  }
}
