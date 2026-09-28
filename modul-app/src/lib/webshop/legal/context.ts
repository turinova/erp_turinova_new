/**
 * LegalContext = minden, amiből a jogi oldalak generálódnak.
 * Források: ERP cégadatok (csak olvasás, alapérték) → webshop jogi felülírások → bolt beállítások → platform konstansok.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { getTenantCompany, type TenantCompanyRow } from '@/lib/company/queries'
import {
  CARD_PROCESSOR,
  CARRIERS,
  DEFAULT_TRANSFER_HOLD_DAYS,
  EMAIL_PROCESSOR,
  HOSTING_PROVIDER,
  INVOICING_PROCESSOR,
  PLATFORM_PROCESSORS,
  COUNTIES
} from '@/lib/webshop/legal/constants'
import {
  companyFormOf,
  conciliationFor,
  countyFromPostalCode,
  countyFromRegistration,
  joinAddress
} from '@/lib/webshop/legal/derive'
import { getWebshopLegalSettings } from '@/lib/webshop/legal/settings'
import type {
  CountyCode,
  LegalContext,
  LegalMissing,
  WebshopLegalSettings
} from '@/lib/webshop/legal/types'
import {
  getStorefrontSettings,
  STATUTORY_RETURN_DAYS,
  type StorefrontSettings
} from '@/lib/webshop/settings'
import { emailConfigured } from '@/lib/email/send'

/** Az ERP cégadatokból jövő alapértékek (a jogi oldalon felülírhatók). */
export type SellerDefaults = {
  sellerName: string
  postalCode: string | null
  city: string | null
  address: string | null
  email: string | null
  phone: string | null
  taxNumber: string | null
  registrationNumber: string | null
  vatId: string | null
  website: string | null
}

export function sellerDefaultsOf(company: TenantCompanyRow | null, fallbackName: string): SellerDefaults {
  const t = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)
  return {
    sellerName: t(company?.name) ?? fallbackName,
    postalCode: t(company?.postal_code),
    city: t(company?.city),
    address: t(company?.address),
    email: t(company?.email),
    phone: t(company?.phone_number),
    taxNumber: t(company?.tax_number),
    registrationNumber: t(company?.company_registration_number),
    vatId: t(company?.vat_id),
    website: t(company?.website)
  }
}

export function derivedCounty(
  legal: Pick<WebshopLegalSettings, 'county'>,
  registrationNumber: string | null,
  postalCode: string | null
): CountyCode | null {
  return legal.county ?? countyFromRegistration(registrationNumber) ?? countyFromPostalCode(postalCode)
}

export function composeLegalContext(input: {
  shopName: string
  shopUrl: string
  defaults: SellerDefaults
  legal: WebshopLegalSettings
  settings: StorefrontSettings
  invoicing: boolean
}): LegalContext {
  const { defaults: d, legal: l, settings: s } = input
  const name = l.sellerName ?? d.sellerName
  const postalCode = l.postalCode ?? d.postalCode
  const city = l.city ?? d.city
  const street = l.address ?? d.address
  const registrationNumber = l.registrationNumber ?? d.registrationNumber
  const form = companyFormOf(name)
  const regCounty = countyFromRegistration(registrationNumber)
  const county = derivedCounty(l, registrationNumber, postalCode)
  const address = joinAddress([postalCode, city, street])
  const payments = s.paymentMethods
  const email = emailConfigured()

  const processors = [...PLATFORM_PROCESSORS]
  if (email) processors.push(EMAIL_PROCESSOR)
  if (input.invoicing) processors.push(INVOICING_PROCESSOR)
  if (payments.includes('card')) processors.push(CARD_PROCESSOR)

  return {
    shopName: input.shopName,
    shopUrl: input.shopUrl,
    seller: {
      name,
      form,
      postalCode,
      city,
      street,
      address,
      email: l.email ?? d.email,
      phone: l.phone ?? d.phone,
      website: d.website,
      taxNumber: l.taxNumber ?? d.taxNumber,
      vatId: l.vatId ?? d.vatId,
      registrationNumber,
      registrationLabel: form === 'ev' ? 'Nyilvántartási szám' : 'Cégjegyzékszám',
      registryCourt: form !== 'ev' && regCounty ? COUNTIES[regCounty].court : null,
      county
    },
    hosting: HOSTING_PROVIDER,
    audience: l.audience,
    shipping: {
      carriers: s.shippingCarriers.map((c) => CARRIERS[c]),
      feeGross: s.shippingFeeGross,
      freeFromGross: s.freeShippingThresholdGross,
      daysMin: s.deliveryDaysMin,
      daysMax: s.deliveryDaysMax,
      pickup: { enabled: s.pickupEnabled, label: s.pickupLabel }
    },
    payments,
    bankAccount: s.bankAccount,
    transferHoldDays: s.transferHoldDays ?? DEFAULT_TRANSFER_HOLD_DAYS,
    returns: {
      days: Math.max(s.returnDays ?? STATUTORY_RETURN_DAYS, STATUTORY_RETURN_DAYS),
      paidBy: s.returnShippingPaidBy,
      address: l.serviceAddress ?? address
    },
    warranty: {
      voluntaryMonths: s.warrantyMonths && s.warrantyMonths > 0 ? s.warrantyMonths : null,
      mandatory: l.mandatoryWarranty
    },
    madeToOrder: l.madeToOrder,
    serviceAddress: l.serviceAddress,
    supportHours: l.supportHours,
    conciliation: conciliationFor(county),
    processors,
    features: {
      reviews: s.reviewsEnabled,
      stockNotify: true,
      newsletter: l.newsletter,
      invoicing: input.invoicing,
      email
    },
    microEnterprise: l.microEnterprise
  }
}

const LEGAL_PAGE = '/webshop/jogi'
const SETTINGS_PAGE = '/webshop/beallitasok'

/** Kötelező adatok, amelyek nélkül a jogi oldalak hiányosak (Ekertv. 4. §, 45/2014. 11. §). */
export function legalMissing(ctx: LegalContext): LegalMissing[] {
  const out: LegalMissing[] = []
  const need = (ok: unknown, field: string, label: string, href: string) => {
    if (!ok) out.push({ field, label, href })
  }
  const s = ctx.seller
  need(s.name.trim(), 'sellerName', 'Eladó neve', `${LEGAL_PAGE}#elado`)
  need(s.postalCode && s.city && s.street, 'address', 'Székhely (irányítószám, város, cím)', `${LEGAL_PAGE}#elado`)
  need(s.email, 'email', 'E-mail cím', `${LEGAL_PAGE}#elado`)
  need(s.phone, 'phone', 'Telefonszám', `${LEGAL_PAGE}#elado`)
  need(s.taxNumber, 'taxNumber', 'Adószám', `${LEGAL_PAGE}#elado`)
  need(s.registrationNumber, 'registrationNumber', s.registrationLabel, `${LEGAL_PAGE}#elado`)
  if (ctx.audience === 'consumer') {
    need(ctx.conciliation, 'county', 'Székhely vármegyéje (békéltető testület)', `${LEGAL_PAGE}#elado`)
  }
  need(
    ctx.shipping.carriers.length > 0 || ctx.shipping.pickup.enabled,
    'shippingCarriers',
    'Legalább egy szállítási mód vagy személyes átvétel',
    `${SETTINGS_PAGE}#szallitas`
  )
  need(
    ctx.shipping.carriers.length === 0 || ctx.shipping.feeGross != null,
    'shippingFeeGross',
    'Szállítási díj',
    `${SETTINGS_PAGE}#szallitas`
  )
  need(ctx.payments.length > 0, 'paymentMethods', 'Legalább egy fizetési mód', `${SETTINGS_PAGE}#fizetes`)
  need(
    !ctx.payments.includes('transfer') || ctx.bankAccount,
    'bankAccount',
    'Bankszámlaszám (átutaláshoz)',
    `${SETTINGS_PAGE}#fizetes`
  )
  return out
}

/** Egy tenant teljes jogi kontextusa (admin és bolt közös). */
export async function loadLegalContext(
  supabase: SupabaseClient,
  tenantId: string,
  shop: { name: string; url: string }
): Promise<{
  ctx: LegalContext
  defaults: SellerDefaults
  legal: WebshopLegalSettings
  settings: StorefrontSettings
}> {
  const [company, legal, settings, invoice] = await Promise.all([
    getTenantCompany(supabase, tenantId).catch(() => null),
    getWebshopLegalSettings(supabase, tenantId),
    getStorefrontSettings(supabase, tenantId),
    supabase.from('tenant_invoice_settings').select('agent_key').eq('tenant_id', tenantId).maybeSingle()
  ])
  const defaults = sellerDefaultsOf(company, shop.name)
  const invoicing = Boolean((invoice.data as { agent_key?: string | null } | null)?.agent_key?.trim())
  const ctx = composeLegalContext({
    shopName: legal.sellerName ?? defaults.sellerName,
    shopUrl: shop.url,
    defaults,
    legal,
    settings,
    invoicing
  })
  return { ctx, defaults, legal, settings }
}
