'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

import { accessoryFormSchema } from '@/lib/accessories/parse'
import type { AccessoryFormValues } from '@/lib/accessories/parse'
import { normalizePriceTiers } from '@/lib/accessories/web-shop'
import { revalidateStorefrontTenant } from '@/lib/storefront/revalidate'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { enrichWebProductFields } from '@/lib/webshop/enrich'
import { getTenantWebshopSettings } from '@/lib/webshop/settings'

export type AccessoryActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const LIST_PATH = '/torzsadatok/alapanyagok/termekek'

function mapDbError(message: string): {
  field?: string
  message: string
} | null {
  if (
    message.includes('accessories_tenant_sku_alive') ||
    (message.includes('duplicate key') && message.includes('sku'))
  ) {
    return {
      field: 'sku',
      message: 'Már van ilyen SKU ebben a cégben.'
    }
  }
  if (
    message.includes('accessories_tenant_barcode_alive') ||
    (message.includes('duplicate key') && message.includes('barcode'))
  ) {
    return {
      field: 'barcode',
      message: 'Ez a gyártói vonalkód már foglalt.'
    }
  }
  if (message.includes('accessories_tenant_barcode_internal_alive')) {
    return {
      field: 'barcodeInternal',
      message: 'Ez a belső vonalkód már foglalt.'
    }
  }
  if (
    message.includes('accessories_tenant_web_slug_alive') ||
    (message.includes('duplicate key') && message.includes('web_slug'))
  ) {
    return {
      field: 'webSlug',
      message: 'Ez a webshop slug már foglalt.'
    }
  }
  if (message.includes('accessories_web_slug_format')) {
    return {
      field: 'webSlug',
      message: 'A slug csak kisbetű, szám és kötőjel lehet.'
    }
  }
  if (message.includes('tax_rate_id')) {
    return {
      field: 'taxRateId',
      message: 'A választott adónem érvénytelen.'
    }
  }
  if (message.includes('unit_id')) {
    return {
      field: 'unitId',
      message: 'A választott egység érvénytelen.'
    }
  }
  if (message.includes('manufacturer_id')) {
    return {
      field: 'manufacturerId',
      message: 'A választott gyártó érvénytelen.'
    }
  }
  return null
}

function fieldErrorsFromZod(
  issues: { path: (string | number)[]; message: string }[]
): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !fieldErrors[key]) {
      fieldErrors[key] = issue.message
    }
  }
  return fieldErrors
}


function webPayload(data: AccessoryFormValues) {
  return {
    sellable_web: data.sellableWeb,
    web_slug: data.webSlug,
    web_title: data.webTitle,
    web_description_short: data.webDescriptionShort,
    web_description_long: data.webDescriptionLong,
    web_brand: data.webBrand,
    web_gtin: data.webGtin,
    web_mpn: data.webMpn,
    web_product_type: data.webProductType,
    web_google_category: data.webGoogleCategory,
    web_tags: data.webTags,
    web_search_aliases: data.webSearchAliases,
    web_color: data.webColor,
    web_size: data.webSize,
    web_material: data.webMaterial,
    web_attributes: data.webAttributes,
    web_specs: data.webSpecs,
    web_gallery: data.webGallery,
    web_faq: data.webFaq,
    web_use_cases: data.webUseCases,
    web_compatibility: data.webCompatibility,
    web_compare_at_price: data.webCompareAtPrice,
    shipping_weight_kg: data.shippingWeightKg,
    shipping_length_cm: data.shippingLengthCm,
    shipping_width_cm: data.shippingWidthCm,
    shipping_height_cm: data.shippingHeightCm,
    product_weight_kg: data.productWeightKg,
    product_length_cm: data.productLengthCm,
    product_width_cm: data.productWidthCm,
    product_height_cm: data.productHeightCm,
    web_group_id: data.webGroupId,
    web_category_id: data.webCategoryId,
    web_box_contents: data.webBoxContents,
    web_dimension_image_url: data.webDimensionImageUrl,
    web_safety_info: data.webSafetyInfo,
    web_identifier_exists: data.webIdentifierExists,
    web_image_alts: data.webImageAlts,
    web_price_tiers: normalizePriceTiers(data.webPriceTiers)
  }
}

async function applyServerWebEnrichment(
  data: AccessoryFormValues,
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessoryFormValues> {
  if (!data.sellableWeb) return data
  const shippingDefaults = await getTenantWebshopSettings(supabase, tenantId)
  const enriched = enrichWebProductFields(
    {
      sellableWeb: true,
      webSearchAliases: data.webSearchAliases ?? [],
      webSpecs: data.webSpecs ?? {},
      webFaq: data.webFaq ?? [],
      webUseCases: data.webUseCases ?? [],
      webColor: data.webColor ?? null,
      webSize: data.webSize ?? null,
      webMaterial: data.webMaterial ?? null,
      webDescriptionLong: data.webDescriptionLong ?? null,
      webProductType: data.webProductType ?? null,
      shippingWeightKg: data.shippingWeightKg ?? null,
      shippingLengthCm: data.shippingLengthCm ?? null,
      shippingWidthCm: data.shippingWidthCm ?? null,
      shippingHeightCm: data.shippingHeightCm ?? null,
      productWeightKg: data.productWeightKg ?? null,
      productLengthCm: data.productLengthCm ?? null,
      productWidthCm: data.productWidthCm ?? null,
      productHeightCm: data.productHeightCm ?? null,
      webMpn: data.webMpn ?? null
    },
    {
      productName: data.name,
      sku: data.sku,
      shippingDefaults
    }
  )
  return {
    ...data,
    webSearchAliases: enriched.webSearchAliases,
    webSpecs: enriched.webSpecs,
    webFaq: enriched.webFaq,
    webUseCases: enriched.webUseCases,
    webColor: enriched.webColor,
    webSize: enriched.webSize,
    webMaterial: enriched.webMaterial,
    shippingWeightKg: enriched.shippingWeightKg,
    shippingLengthCm: enriched.shippingLengthCm,
    shippingWidthCm: enriched.shippingWidthCm,
    shippingHeightCm: enriched.shippingHeightCm,
    productWeightKg: enriched.productWeightKg,
    productLengthCm: enriched.productLengthCm,
    productWidthCm: enriched.productWidthCm,
    productHeightCm: enriched.productHeightCm,
    webMpn: enriched.webMpn
  }
}

async function syncAttributeValues(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string,
  valueIds: string[]
) {
  await supabase
    .from('accessory_attribute_values')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)

  if (valueIds.length === 0) return

  const { error } = await supabase.from('accessory_attribute_values').insert(
    valueIds.map((attribute_value_id) => ({
      tenant_id: tenantId,
      accessory_id: accessoryId,
      attribute_value_id
    }))
  )
  if (error) {
    console.error('syncAttributeValues', error.message)
  }
}

async function syncAttributeInputs(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string,
  inputs: AccessoryFormValues['attributeInputs']
) {
  const nonEmpty = inputs.filter(
    (i) => i.valueNum != null || i.valueMax != null || i.valueBool != null
  )
  let valid = nonEmpty
  if (nonEmpty.length > 0) {
    const { data: attrs } = await supabase
      .from('product_attributes')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .neq('value_type', 'list')
      .in(
        'id',
        nonEmpty.map((i) => i.attributeId)
      )
    const ok = new Set((attrs ?? []).map((a) => a.id as string))
    valid = nonEmpty.filter((i) => ok.has(i.attributeId))
  }

  const { error: delError } = await supabase
    .from('accessory_attribute_inputs')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
  if (delError) {
    console.error('syncAttributeInputs delete', delError.message)
    return
  }
  if (valid.length === 0) return

  const { error } = await supabase.from('accessory_attribute_inputs').insert(
    valid.map((i) => ({
      tenant_id: tenantId,
      accessory_id: accessoryId,
      attribute_id: i.attributeId,
      value_num: i.valueNum,
      value_max: i.valueMax,
      value_bool: i.valueBool
    }))
  )
  if (error) {
    console.error('syncAttributeInputs', error.message)
  }
}

export type AccessoryFormInput = {
  name: string
  manufacturerId: string
  sku: string
  barcode?: string
  barcodeInternal?: string
  taxRateId: string
  unitId: string
  priceNet: number
  purchasePriceNet: number | null
  marginFactor: number | null
  imageUrl?: string | null
  active: boolean
  sellablePos: boolean
  sellableWeb?: boolean
  webSlug?: string | null
  webTitle?: string | null
  webDescriptionShort?: string | null
  webDescriptionLong?: string | null
  webBrand?: string | null
  webGtin?: string | null
  webMpn?: string | null
  webProductType?: string | null
  webGoogleCategory?: string | null
  webTags?: string[]
  webSearchAliases?: string[]
  webColor?: string | null
  webSize?: string | null
  webMaterial?: string | null
  webAttributes?: Record<string, string>
  webSpecs?: Record<string, string>
  webGallery?: string[]
  webFaq?: { q: string; a: string }[]
  webUseCases?: string[]
  webCompatibility?: string[]
  webCompareAtPrice?: number | null
  shippingWeightKg?: number | null
  shippingLengthCm?: number | null
  shippingWidthCm?: number | null
  shippingHeightCm?: number | null
  productWeightKg?: number | null
  productLengthCm?: number | null
  productWidthCm?: number | null
  productHeightCm?: number | null
  webGroupId?: string | null
  webCategoryId?: string | null
  attributeValueIds?: string[]
  attributeInputs?: {
    attributeId: string
    valueNum: number | null
    valueMax: number | null
    valueBool: boolean | null
  }[]
  webBoxContents?: string[]
  webDimensionImageUrl?: string | null
  webSafetyInfo?: string | null
  webIdentifierExists?: boolean
  webImageAlts?: Record<string, string>
  webPriceTiers?: { min_qty: number; price_net: number }[]
}

export async function createAccessory(
  input: AccessoryFormInput
): Promise<AccessoryActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = accessoryFormSchema.safeParse(input)
  if (!parsed.success) {
    console.error(
      'createAccessory validation',
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    )
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  if (parsed.data.sellableWeb) {
    const entitled = await tenantHasWebshop(
      ctx.supabase,
      ctx.user.tenantId!
    )
    if (!entitled) {
      return {
        ok: false,
        message:
          'A Webshop add-on nincs bekapcsolva. Kapcsold be a platformon, vagy kapcsold ki az „Online bolt” kapcsolót.'
      }
    }
  }

  const enriched = await applyServerWebEnrichment(
    parsed.data,
    ctx.supabase,
    ctx.user.tenantId!
  )

  const { data, error } = await ctx.supabase
    .from('accessories')
    .insert({
      tenant_id: ctx.user.tenantId!,
      name: enriched.name,
      manufacturer_id: enriched.manufacturerId,
      sku: enriched.sku,
      barcode: enriched.barcode,
      barcode_internal: enriched.barcodeInternal,
      tax_rate_id: enriched.taxRateId,
      unit_id: enriched.unitId,
      price_net: enriched.priceNet,
      purchase_price_net: enriched.purchasePriceNet,
      margin_factor: enriched.marginFactor,
      image_url: enriched.imageUrl ?? null,
      active: enriched.active,
      sellable_pos: enriched.sellablePos,
      ...webPayload(enriched)
    })
    .select('id')
    .single()

  if (error) {
    const mapped = mapDbError(error.message)
    return {
      ok: false,
      message: mapped?.message ?? 'Nem sikerült létrehozni a terméket.',
      fieldErrors:
        mapped?.field != null ? { [mapped.field]: mapped.message } : undefined
    }
  }

  await syncAttributeValues(
    ctx.supabase,
    ctx.user.tenantId!,
    data.id,
    enriched.attributeValueIds
  )
  await syncAttributeInputs(
    ctx.supabase,
    ctx.user.tenantId!,
    data.id,
    enriched.attributeInputs
  )

  revalidatePath(LIST_PATH)
  revalidatePath('/webshop')
  revalidatePath('/webshop/katalogus')
  await revalidateStorefrontTenant(ctx.user.tenantId!, { productSlugs: [enriched.webSlug] })
  return { ok: true, id: data.id }
}

export async function updateAccessory(
  input: AccessoryFormInput & { id: string }
): Promise<AccessoryActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = accessoryFormSchema.safeParse(input)
  if (!parsed.success) {
    console.error(
      'updateAccessory validation',
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    )
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  if (parsed.data.sellableWeb) {
    const entitled = await tenantHasWebshop(
      ctx.supabase,
      ctx.user.tenantId!
    )
    if (!entitled) {
      return {
        ok: false,
        message:
          'A Webshop add-on nincs bekapcsolva. Kapcsold be a platformon, vagy kapcsold ki az „Online bolt” kapcsolót.'
      }
    }
  }

  const enriched = await applyServerWebEnrichment(
    parsed.data,
    ctx.supabase,
    ctx.user.tenantId!
  )

  const { data, error } = await ctx.supabase
    .from('accessories')
    .update({
      name: enriched.name,
      manufacturer_id: enriched.manufacturerId,
      sku: enriched.sku,
      barcode: enriched.barcode,
      barcode_internal: enriched.barcodeInternal,
      tax_rate_id: enriched.taxRateId,
      unit_id: enriched.unitId,
      price_net: enriched.priceNet,
      purchase_price_net: enriched.purchasePriceNet,
      margin_factor: enriched.marginFactor,
      image_url: enriched.imageUrl ?? null,
      active: enriched.active,
      sellable_pos: enriched.sellablePos,
      ...webPayload(enriched),
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    const mapped = mapDbError(error.message)
    return {
      ok: false,
      message: mapped?.message ?? 'Nem sikerült menteni a terméket.',
      fieldErrors:
        mapped?.field != null ? { [mapped.field]: mapped.message } : undefined
    }
  }

  if (!data) {
    return { ok: false, message: 'A termék nem található.' }
  }

  await syncAttributeValues(
    ctx.supabase,
    ctx.user.tenantId!,
    data.id,
    enriched.attributeValueIds
  )
  await syncAttributeInputs(
    ctx.supabase,
    ctx.user.tenantId!,
    data.id,
    enriched.attributeInputs
  )

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${data.id}`)
  revalidatePath('/webshop')
  revalidatePath('/webshop/katalogus')
  await revalidateStorefrontTenant(ctx.user.tenantId!, { productSlugs: [enriched.webSlug] })
  return { ok: true, id: data.id }
}

export async function softDeleteAccessory(
  id: string
): Promise<AccessoryActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('accessories')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      active: false
    })
    .eq('id', id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült törölni a terméket.' }
  }

  if (!data) {
    return { ok: false, message: 'A termék nem található.' }
  }

  revalidatePath(LIST_PATH)
  return { ok: true, id: data.id }
}
