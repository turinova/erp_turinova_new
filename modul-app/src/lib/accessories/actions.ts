'use server'

import { revalidatePath } from 'next/cache'

import { accessoryFormSchema } from '@/lib/accessories/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { revalidateShopProduct } from '@/lib/webshop/revalidate-product'

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

export type AccessoryFormInput = {
  name: string
  manufacturerId?: string | null
  supplierIds?: string[]
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
  webGallery?: string[]
}

async function replaceAccessorySuppliers(
  supabase: Awaited<
    ReturnType<typeof requireWritableTenant>
  > extends { ok: true; supabase: infer S }
    ? S
    : never,
  tenantId: string,
  accessoryId: string,
  supplierIds: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: delError } = await supabase
    .from('accessory_suppliers')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)

  if (delError) {
    console.error('replaceAccessorySuppliers delete', delError.message)
    return { ok: false, message: 'Nem sikerült frissíteni a beszállítókat.' }
  }

  const unique = [...new Set(supplierIds)]
  if (unique.length === 0) return { ok: true }

  const rows = unique.map((supplierId, index) => ({
    tenant_id: tenantId,
    accessory_id: accessoryId,
    supplier_id: supplierId,
    is_primary: index === 0,
    sort_order: index
  }))

  const { error: insError } = await supabase
    .from('accessory_suppliers')
    .insert(rows)

  if (insError) {
    console.error('replaceAccessorySuppliers insert', insError.message)
    return {
      ok: false,
      message:
        insError.message.includes('supplier_id') ||
        insError.message.includes('foreign key')
          ? 'Érvénytelen beszállító.'
          : 'Nem sikerült menteni a beszállítókat.'
    }
  }

  return { ok: true }
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

  const values = parsed.data

  const { data, error } = await ctx.supabase
    .from('accessories')
    .insert({
      tenant_id: ctx.user.tenantId!,
      name: values.name,
      manufacturer_id: values.manufacturerId,
      sku: values.sku,
      barcode: values.barcode,
      barcode_internal: values.barcodeInternal,
      tax_rate_id: values.taxRateId,
      unit_id: values.unitId,
      price_net: values.priceNet,
      purchase_price_net: values.purchasePriceNet,
      margin_factor: values.marginFactor,
      image_url: values.imageUrl ?? null,
      active: values.active,
      sellable_pos: values.sellablePos,
      web_gallery: values.webGallery
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

  revalidatePath(LIST_PATH)
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

  const values = parsed.data

  const { data, error } = await ctx.supabase
    .from('accessories')
    .update({
      name: values.name,
      manufacturer_id: values.manufacturerId,
      sku: values.sku,
      barcode: values.barcode,
      barcode_internal: values.barcodeInternal,
      tax_rate_id: values.taxRateId,
      unit_id: values.unitId,
      price_net: values.priceNet,
      purchase_price_net: values.purchasePriceNet,
      margin_factor: values.marginFactor,
      image_url: values.imageUrl ?? null,
      active: values.active,
      sellable_pos: values.sellablePos,
      web_gallery: values.webGallery,
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

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${data.id}`)
  await revalidateShopProduct(ctx.supabase, ctx.user.tenantId!, data.id)
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
  await revalidateShopProduct(ctx.supabase, ctx.user.tenantId!, data.id)
  return { ok: true, id: data.id }
}
