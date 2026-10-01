'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/auth/session'
import { tenantHasLapszabaszat } from '@/lib/lapszabaszat/entitlement'
import {
  openingStockFormSchema,
  type OpeningStockFormInput,
  type OpeningStockSearchItem
} from '@/lib/opening-stock/parse'
import { searchOpeningStockItems } from '@/lib/opening-stock/queries'
import { lookupPosBarcodeProduct } from '@/lib/pos/barcode-lookup'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { createClient } from '@/lib/supabase/server'

export type OpeningStockActionResult =
  | { ok: true; lineCount: number }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const MOVEMENTS_PATH = '/keszlet/mozgasok'
const NYITO_PATH = '/keszlet/nyito'

export async function searchOpeningStockAction(
  q: string,
  warehouseId: string
): Promise<
  | { ok: true; rows: OpeningStockSearchItem[] }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }
  if (!warehouseId) {
    return { ok: false, message: 'Válaszd ki a raktárat.' }
  }

  const includeMaterials = await tenantHasLapszabaszat(supabase, user.tenantId)
  try {
    const rows = await searchOpeningStockItems(
      supabase,
      user.tenantId,
      q,
      warehouseId,
      { includeMaterials, limit: 25 }
    )
    return { ok: true, rows }
  } catch (err) {
    console.error('searchOpeningStockAction', err)
    return { ok: false, message: 'Nem sikerült a keresés.' }
  }
}

export async function lookupOpeningStockBarcodeAction(
  code: string,
  warehouseId: string
): Promise<
  | { ok: true; item: OpeningStockSearchItem }
  | { ok: false; message: string; notFound?: boolean }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }
  if (!warehouseId) {
    return { ok: false, message: 'Válaszd ki a raktárat.' }
  }

  const res = await lookupPosBarcodeProduct(
    supabase,
    user.tenantId,
    code,
    warehouseId
  )
  if (!res.ok) {
    return {
      ok: false,
      message: res.message,
      notFound: res.notFound
    }
  }

  return {
    ok: true,
    item: {
      kind: 'product',
      id: res.product.id,
      name: res.product.name,
      sku: res.product.sku,
      unitShortform: res.product.unit_shortform || 'db',
      onHand: Number(res.product.on_hand) || 0,
      imageUrl: res.product.image_url ?? null
    }
  }
}

export async function commitOpeningStockAction(
  input: OpeningStockFormInput
): Promise<OpeningStockActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = openingStockFormSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form'
      if (!fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Hibás adatok.',
      fieldErrors
    }
  }

  const payload = parsed.data.items.map((it) => ({
    kind: it.kind,
    id: it.id,
    quantity: it.quantity
  }))

  const { data, error } = await ctx.supabase.rpc('commit_opening_stock', {
    p_warehouse_id: parsed.data.warehouseId,
    p_items: payload
  })

  if (error) {
    console.error('commitOpeningStockAction', error.message)
    return { ok: false, message: 'Nem sikerült rögzíteni a nyitó készletet.' }
  }

  const result = data as {
    ok?: boolean
    message?: string
    line_count?: number
  } | null

  if (!result?.ok) {
    return {
      ok: false,
      message: result?.message ?? 'Nem sikerült rögzíteni a nyitó készletet.'
    }
  }

  revalidatePath(MOVEMENTS_PATH)
  revalidatePath(NYITO_PATH)
  revalidatePath('/torzsadatok/alapanyagok/termekek')
  revalidatePath('/torzsadatok/alapanyagok/tablas-anyagok')
  revalidatePath('/torzsadatok/alapanyagok/szalas-anyagok')

  return { ok: true, lineCount: Number(result.line_count) || payload.length }
}
