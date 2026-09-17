'use server'

import { revalidatePath } from 'next/cache'

import {
  stockTransferFormSchema,
  type StockTransferFormInput
} from '@/lib/stock-transfers/parse'
import { getAccessoryOnHand } from '@/lib/stock/queries'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export type StockTransferActionResult =
  | { ok: true; id: string; transferNumber?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const LIST_PATH = '/keszlet/atadasok'
const MOVEMENTS_PATH = '/keszlet/mozgasok'

function revalidateTransferPaths(id?: string) {
  revalidatePath(LIST_PATH)
  revalidatePath(MOVEMENTS_PATH)
  if (id) revalidatePath(`${LIST_PATH}/${id}`)
  revalidatePath('/torzsadatok/alapanyagok/termekek')
}

export async function getTransferOnHandAction(
  accessoryId: string,
  warehouseId: string
): Promise<{ ok: true; onHand: number } | { ok: false; message: string }> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }
  try {
    const onHand = await getAccessoryOnHand(
      supabase,
      user.tenantId,
      accessoryId,
      warehouseId
    )
    return { ok: true, onHand }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : 'Nem sikerült lekérdezni a készletet.'
    }
  }
}

export async function createStockTransferAction(
  input: StockTransferFormInput
): Promise<StockTransferActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = stockTransferFormSchema.safeParse(input)
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

  const { fromWarehouseId, toWarehouseId, note, items } = parsed.data

  const payload = items.map((it) => ({
    accessory_id: it.accessoryId,
    quantity: it.quantity
  }))

  const { data, error } = await ctx.supabase.rpc('create_stock_transfer', {
    p_from_warehouse_id: fromWarehouseId,
    p_to_warehouse_id: toWarehouseId,
    p_note: note,
    p_items: payload
  })

  if (error) {
    console.error('createStockTransferAction', error.message)
    return { ok: false, message: 'Nem sikerült rögzíteni az áttárolást.' }
  }

  const result = data as {
    ok?: boolean
    id?: string
    transfer_number?: string
    message?: string
  } | null

  if (!result?.ok || !result.id) {
    return {
      ok: false,
      message: result?.message ?? 'Nem sikerült rögzíteni az áttárolást.'
    }
  }

  revalidateTransferPaths(result.id)
  for (const it of items) {
    revalidatePath(`/torzsadatok/alapanyagok/termekek/${it.accessoryId}`)
  }

  return {
    ok: true,
    id: result.id,
    transferNumber: result.transfer_number
  }
}
