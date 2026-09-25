import type { SupabaseClient } from '@supabase/supabase-js'

import {
  DEFAULT_WEBSHOP_SHIPPING,
  type WebshopShippingDefaults
} from '@/lib/webshop/enrich'

export type TenantWebshopSettings = WebshopShippingDefaults & {
  tenantId: string
}

/** Vásárlói (storefront) beállítások — PDP szállítás / csere / készlet. */
export type StorefrontSettings = {
  shippingFeeGross: number | null
  freeShippingThresholdGross: number | null
  deliveryDaysMin: number | null
  deliveryDaysMax: number | null
  pickupEnabled: boolean
  pickupLabel: string | null
  returnDays: number | null
  warrantyMonths: number | null
  returnPolicyText: string | null
  lowStockThreshold: number
  showSoldCount: boolean
  reviewsEnabled: boolean
  hostingProviderName: string | null
  hostingProviderAddress: string | null
  hostingProviderEmail: string | null
  termsUrl: string | null
  privacyUrl: string | null
  complaintInfo: string | null
  /** GPTBot / Google-Extended stb. taníthat-e a tartalomból (keresés ettől független). */
  allowAiTraining: boolean
  /** Termékképek aránya a listákban és a galériában. */
  imageAspect: 'square' | 'portrait'
  /** B2B: nettó ár a bruttó alatt. */
  showNetPrice: boolean
}

/** Fttv. / Ptk. — rövidebb elállási idő nem ígérhető. */
export const STATUTORY_RETURN_DAYS = 14

export const DEFAULT_STOREFRONT_SETTINGS: StorefrontSettings = {
  shippingFeeGross: null,
  freeShippingThresholdGross: null,
  deliveryDaysMin: null,
  deliveryDaysMax: null,
  pickupEnabled: false,
  pickupLabel: null,
  returnDays: null,
  warrantyMonths: null,
  returnPolicyText: null,
  lowStockThreshold: 10,
  showSoldCount: true,
  reviewsEnabled: true,
  hostingProviderName: null,
  hostingProviderAddress: null,
  hostingProviderEmail: null,
  termsUrl: null,
  privacyUrl: null,
  complaintInfo: null,
  allowAiTraining: false,
  imageAspect: 'square',
  showNetPrice: false
}

const LEGAL_COLUMNS = `
  hosting_provider_name,
  hosting_provider_address,
  hosting_provider_email,
  terms_url,
  privacy_url,
  complaint_info
`

const STOREFRONT_COLUMNS = `
  shipping_fee_gross,
  free_shipping_threshold_gross,
  delivery_days_min,
  delivery_days_max,
  pickup_enabled,
  pickup_label,
  return_days,
  warranty_months,
  return_policy_text,
  low_stock_threshold,
  show_sold_count,
  reviews_enabled
`

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function textOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export async function getTenantWebshopSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<WebshopShippingDefaults> {
  const { data, error } = await supabase
    .from('tenant_webshop_settings')
    .select(
      'default_shipping_weight_kg, default_shipping_length_cm, default_shipping_width_cm, default_shipping_height_cm'
    )
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    console.error('getTenantWebshopSettings', error.message)
    return { ...DEFAULT_WEBSHOP_SHIPPING }
  }
  if (!data) return { ...DEFAULT_WEBSHOP_SHIPPING }

  return {
    weightKg: Number(data.default_shipping_weight_kg) || DEFAULT_WEBSHOP_SHIPPING.weightKg,
    lengthCm: Number(data.default_shipping_length_cm) || DEFAULT_WEBSHOP_SHIPPING.lengthCm,
    widthCm: Number(data.default_shipping_width_cm) || DEFAULT_WEBSHOP_SHIPPING.widthCm,
    heightCm: Number(data.default_shipping_height_cm) || DEFAULT_WEBSHOP_SHIPPING.heightCm
  }
}

export async function getStorefrontSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<StorefrontSettings> {
  // Régebbi sémán (migráció előtt) a hiányzó oszlopcsoport nélkül olvasunk.
  const selects = [
    `${STOREFRONT_COLUMNS}, ${LEGAL_COLUMNS}, allow_ai_training, image_aspect, show_net_price`,
    `${STOREFRONT_COLUMNS}, ${LEGAL_COLUMNS}, allow_ai_training`,
    `${STOREFRONT_COLUMNS}, ${LEGAL_COLUMNS}`,
    STOREFRONT_COLUMNS
  ]
  let data: Record<string, unknown> | null = null
  let error: { message: string } | null = null
  for (const columns of selects) {
    ;({ data, error } = await supabase
      .from('tenant_webshop_settings')
      .select(columns)
      .eq('tenant_id', tenantId)
      .maybeSingle())
    if (!error?.message.includes('column')) break
    console.error('getStorefrontSettings columns', error.message)
  }

  if (error) {
    console.error('getStorefrontSettings', error.message)
    return { ...DEFAULT_STOREFRONT_SETTINGS }
  }
  if (!data) return { ...DEFAULT_STOREFRONT_SETTINGS }

  const row = data as Record<string, unknown>
  const threshold = numOrNull(row.low_stock_threshold)
  return {
    shippingFeeGross: numOrNull(row.shipping_fee_gross),
    freeShippingThresholdGross: numOrNull(row.free_shipping_threshold_gross),
    deliveryDaysMin: numOrNull(row.delivery_days_min),
    deliveryDaysMax: numOrNull(row.delivery_days_max),
    pickupEnabled: row.pickup_enabled === true,
    pickupLabel: textOrNull(row.pickup_label),
    returnDays: numOrNull(row.return_days),
    warrantyMonths: numOrNull(row.warranty_months),
    returnPolicyText: textOrNull(row.return_policy_text),
    lowStockThreshold: threshold ?? DEFAULT_STOREFRONT_SETTINGS.lowStockThreshold,
    showSoldCount: row.show_sold_count !== false,
    reviewsEnabled: row.reviews_enabled !== false,
    hostingProviderName: textOrNull(row.hosting_provider_name),
    hostingProviderAddress: textOrNull(row.hosting_provider_address),
    hostingProviderEmail: textOrNull(row.hosting_provider_email),
    termsUrl: textOrNull(row.terms_url),
    privacyUrl: textOrNull(row.privacy_url),
    complaintInfo: textOrNull(row.complaint_info),
    allowAiTraining: row.allow_ai_training === true,
    imageAspect: row.image_aspect === 'portrait' ? 'portrait' : 'square',
    showNetPrice: row.show_net_price === true
  }
}
