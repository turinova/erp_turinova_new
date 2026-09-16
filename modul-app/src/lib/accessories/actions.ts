'use server'

import { revalidatePath } from 'next/cache'

import { accessoryFormSchema } from '@/lib/accessories/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

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
  manufacturerId: string
  sku: string
  barcode?: string
  barcodeInternal?: string
  taxRateId: string
  unitId: string
  priceNet: number
  purchasePriceNet: number | null
  marginFactor: number | null
  active: boolean
}

export async function createAccessory(
  input: AccessoryFormInput
): Promise<AccessoryActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = accessoryFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const { data, error } = await ctx.supabase
    .from('accessories')
    .insert({
      tenant_id: ctx.user.tenantId!,
      name: parsed.data.name,
      manufacturer_id: parsed.data.manufacturerId,
      sku: parsed.data.sku,
      barcode: parsed.data.barcode,
      barcode_internal: parsed.data.barcodeInternal,
      tax_rate_id: parsed.data.taxRateId,
      unit_id: parsed.data.unitId,
      price_net: parsed.data.priceNet,
      purchase_price_net: parsed.data.purchasePriceNet,
      margin_factor: parsed.data.marginFactor,
      image_url: parsed.data.imageUrl ?? null,
      active: parsed.data.active
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
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const { data, error } = await ctx.supabase
    .from('accessories')
    .update({
      name: parsed.data.name,
      manufacturer_id: parsed.data.manufacturerId,
      sku: parsed.data.sku,
      barcode: parsed.data.barcode,
      barcode_internal: parsed.data.barcodeInternal,
      tax_rate_id: parsed.data.taxRateId,
      unit_id: parsed.data.unitId,
      price_net: parsed.data.priceNet,
      purchase_price_net: parsed.data.purchasePriceNet,
      margin_factor: parsed.data.marginFactor,
      image_url: parsed.data.imageUrl ?? null,
      active: parsed.data.active,
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
