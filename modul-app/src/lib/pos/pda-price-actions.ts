'use server'

import { revalidatePath } from 'next/cache'

import { grossFromNet, netFromGross } from '@/lib/accessories/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { revalidateShopProduct } from '@/lib/webshop/revalidate-product'

const ACCESSORY_LIST = '/torzsadatok/alapanyagok/termekek'

export type UpdatePdaSellGrossResult =
  | {
      ok: true
      priceNet: number
      marginFactor: number | null
      unitPriceGross: number
    }
  | { ok: false; message: string }

/**
 * PDA árellenőrzés: bruttó eladási ár mentése.
 * Beszerzési nettó marad; árrés szorzó = price_net / purchase (ha van).
 */
export async function updateAccessorySellGrossFromPdaAction(input: {
  accessoryId: string
  unitPriceGross: number
}): Promise<UpdatePdaSellGrossResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const accessoryId = input.accessoryId?.trim()
  if (!accessoryId) {
    return { ok: false, message: 'Hiányzó termék.' }
  }

  const gross = Math.round(Number(input.unitPriceGross))
  if (!Number.isFinite(gross) || gross < 0) {
    return { ok: false, message: 'Érvénytelen bruttó ár.' }
  }
  if (gross > 99_999_999) {
    return { ok: false, message: 'A bruttó ár túl nagy.' }
  }

  const { data: row, error: loadErr } = await ctx.supabase
    .from('accessories')
    .select('id, price_net, purchase_price_net, margin_factor, tax_rates ( rate_percent )')
    .eq('id', accessoryId)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr) {
    console.error('updateAccessorySellGrossFromPda load', loadErr.message)
    return { ok: false, message: 'Nem sikerült betölteni a terméket.' }
  }
  if (!row) {
    return { ok: false, message: 'A termék nem található.' }
  }

  const taxJoin = row.tax_rates as
    | { rate_percent: number }
    | { rate_percent: number }[]
    | null
  const taxOne = Array.isArray(taxJoin) ? taxJoin[0] : taxJoin
  const taxPct = Number(taxOne?.rate_percent) || 0

  const priceNet = netFromGross(gross, taxPct)
  const purchase = row.purchase_price_net
  const purchaseNum =
    purchase == null ? null : Number(purchase)

  let marginFactor: number | null =
    row.margin_factor == null ? null : Number(row.margin_factor)

  if (purchaseNum != null && purchaseNum > 0) {
    marginFactor = Math.round((priceNet / purchaseNum) * 10000) / 10000
  }

  const { data: updated, error: updErr } = await ctx.supabase
    .from('accessories')
    .update({
      price_net: priceNet,
      margin_factor: marginFactor,
      updated_at: new Date().toISOString()
    })
    .eq('id', accessoryId)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (updErr) {
    console.error('updateAccessorySellGrossFromPda update', updErr.message)
    return { ok: false, message: 'Nem sikerült menteni az árat.' }
  }
  if (!updated) {
    return { ok: false, message: 'A termék nem található.' }
  }

  revalidatePath(ACCESSORY_LIST)
  revalidatePath(`${ACCESSORY_LIST}/${accessoryId}`)
  await revalidateShopProduct(ctx.supabase, ctx.user.tenantId!, accessoryId)

  return {
    ok: true,
    priceNet,
    marginFactor,
    unitPriceGross: grossFromNet(priceNet, taxPct)
  }
}
