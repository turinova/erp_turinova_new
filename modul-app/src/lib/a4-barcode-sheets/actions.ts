'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

import { a4SheetFormSchema } from '@/lib/a4-barcode-sheets/parse'
import { A4_PAGE_KEY } from '@/lib/a4-barcode-sheets/types'
import { PRODUCT_LABELS_FEATURE } from '@/lib/labels/types'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type A4SheetActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

async function assertProductLabels(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .eq('feature_key', PRODUCT_LABELS_FEATURE)
    .maybeSingle()
  if (error) {
    console.error('assertProductLabels', error.message)
    return 'Nem sikerült ellenőrizni a címke jogosultságot.'
  }
  if (!data) {
    return 'A címkenyomtatás / vonalkód lap nincs a csomagban (product_labels).'
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

export async function createA4BarcodeSheet(
  input: unknown
): Promise<A4SheetActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const gate = await assertProductLabels(ctx.supabase, ctx.user.tenantId!)
  if (gate) return { ok: false, message: gate }

  const parsed = a4SheetFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const d = parsed.data
  for (const c of d.cells) {
    if (c.row >= d.rows || c.col >= d.cols) {
      return { ok: false, message: 'Érvénytelen cellapozíció a rácshoz képest.' }
    }
  }

  const tenantId = ctx.user.tenantId!
  const { data: sheet, error } = await ctx.supabase
    .from('a4_barcode_sheets')
    .insert({
      tenant_id: tenantId,
      name: d.name,
      cols: d.cols,
      rows: d.rows,
      margin_mm: d.marginMm,
      show_name: d.showName,
      show_sku: d.showSku,
      show_price: d.showPrice
    })
    .select('id')
    .single()

  if (error || !sheet) {
    console.error('createA4BarcodeSheet', error?.message)
    return {
      ok: false,
      message:
        /relation .* does not exist/i.test(error?.message ?? '')
          ? 'A vonalkód lap tábla nincs telepítve. Futtasd a migrációt.'
          : 'Nem sikerült létrehozni a lapot.'
    }
  }

  if (d.cells.length > 0) {
    const { error: cellErr } = await ctx.supabase
      .from('a4_barcode_sheet_cells')
      .insert(
        d.cells.map((c) => ({
          tenant_id: tenantId,
          sheet_id: sheet.id,
          row_i: c.row,
          col_i: c.col,
          accessory_id: c.accessoryId,
          barcode_value: c.barcodeValue,
          barcode_source: c.barcodeSource,
          name_snap: c.nameSnap || null,
          sku_snap: c.skuSnap || null,
          price_snap: c.priceGross ?? null,
          unit_snap: c.unitSnap || 'db',
          show_name: c.showName,
          show_sku: c.showSku,
          show_price: c.showPrice,
          show_barcode: c.showBarcode
        }))
      )
    if (cellErr) {
      console.error('createA4BarcodeSheet cells', cellErr.message)
      await ctx.supabase
        .from('a4_barcode_sheets')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', sheet.id)
        .eq('tenant_id', tenantId)
      return { ok: false, message: 'Nem sikerült menteni a cellákat.' }
    }
  }

  revalidatePath(A4_PAGE_KEY)
  return { ok: true, id: sheet.id as string }
}

export async function updateA4BarcodeSheet(
  sheetId: string,
  input: unknown
): Promise<A4SheetActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const gate = await assertProductLabels(ctx.supabase, ctx.user.tenantId!)
  if (gate) return { ok: false, message: gate }

  if (!sheetId) return { ok: false, message: 'Hiányzó lap azonosító.' }

  const parsed = a4SheetFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const d = parsed.data
  for (const c of d.cells) {
    if (c.row >= d.rows || c.col >= d.cols) {
      return { ok: false, message: 'Érvénytelen cellapozíció a rácshoz képest.' }
    }
  }

  const tenantId = ctx.user.tenantId!
  const { data: existing, error: findErr } = await ctx.supabase
    .from('a4_barcode_sheets')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', sheetId)
    .is('deleted_at', null)
    .maybeSingle()

  if (findErr || !existing) {
    return { ok: false, message: 'A lap nem található.' }
  }

  const { error } = await ctx.supabase
    .from('a4_barcode_sheets')
    .update({
      name: d.name,
      cols: d.cols,
      rows: d.rows,
      margin_mm: d.marginMm,
      show_name: d.showName,
      show_sku: d.showSku,
      show_price: d.showPrice,
      updated_at: new Date().toISOString()
    })
    .eq('id', sheetId)
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('updateA4BarcodeSheet', error.message)
    return { ok: false, message: 'Nem sikerült menteni a lapot.' }
  }

  const { error: delErr } = await ctx.supabase
    .from('a4_barcode_sheet_cells')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('sheet_id', sheetId)

  if (delErr) {
    console.error('updateA4BarcodeSheet clear cells', delErr.message)
    return { ok: false, message: 'Nem sikerült frissíteni a cellákat.' }
  }

  if (d.cells.length > 0) {
    const { error: cellErr } = await ctx.supabase
      .from('a4_barcode_sheet_cells')
      .insert(
        d.cells.map((c) => ({
          tenant_id: tenantId,
          sheet_id: sheetId,
          row_i: c.row,
          col_i: c.col,
          accessory_id: c.accessoryId,
          barcode_value: c.barcodeValue,
          barcode_source: c.barcodeSource,
          name_snap: c.nameSnap || null,
          sku_snap: c.skuSnap || null,
          price_snap: c.priceGross ?? null,
          unit_snap: c.unitSnap || 'db',
          show_name: c.showName,
          show_sku: c.showSku,
          show_price: c.showPrice,
          show_barcode: c.showBarcode
        }))
      )
    if (cellErr) {
      console.error('updateA4BarcodeSheet cells', cellErr.message)
      return { ok: false, message: 'Nem sikerült menteni a cellákat.' }
    }
  }

  revalidatePath(A4_PAGE_KEY)
  revalidatePath(`${A4_PAGE_KEY}/${sheetId}`)
  return { ok: true, id: sheetId }
}

export async function softDeleteA4BarcodeSheet(
  sheetId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const gate = await assertProductLabels(ctx.supabase, ctx.user.tenantId!)
  if (gate) return { ok: false, message: gate }

  const { error } = await ctx.supabase
    .from('a4_barcode_sheets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', sheetId)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)

  if (error) {
    console.error('softDeleteA4BarcodeSheet', error.message)
    return { ok: false, message: 'Nem sikerült törölni a lapot.' }
  }

  revalidatePath(A4_PAGE_KEY)
  return { ok: true }
}
