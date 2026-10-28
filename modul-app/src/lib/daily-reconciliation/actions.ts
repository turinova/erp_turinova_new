'use server'

import { revalidatePath } from 'next/cache'

import {
  saveDailyReconciliationSchema,
  type SaveDailyReconciliationInput
} from '@/lib/daily-reconciliation/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type DailyReconActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const PAGE = '/ertekesitesek/napi-egyeztetes'

export async function saveDailyReconciliation(
  raw: SaveDailyReconciliationInput
): Promise<DailyReconActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = saveDailyReconciliationSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) {
        fieldErrors[key] = issue.message
      }
    }
    return {
      ok: false,
      message: 'Ellenőrizd a megadott összegeket.',
      fieldErrors
    }
  }

  const d = parsed.data
  const tenantId = ctx.user.tenantId!
  const userId = ctx.user.id

  const payload = {
    tenant_id: tenantId,
    business_date: d.businessDate,
    store_cash: d.storeCash,
    store_card: d.storeCard,
    store_transfer: d.storeTransfer,
    system_cash_snapshot: d.systemCash,
    system_card_snapshot: d.systemCard,
    system_transfer_snapshot: d.systemTransfer,
    note: d.note?.trim() ? d.note.trim() : null,
    updated_at: new Date().toISOString(),
    updated_by: userId
  }

  const { data: existing } = await ctx.supabase
    .from('daily_reconciliations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('business_date', d.businessDate)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await ctx.supabase
      .from('daily_reconciliations')
      .update(payload)
      .eq('id', existing.id)
      .eq('tenant_id', tenantId)

    if (error) {
      console.error('saveDailyReconciliation update', error.message)
      return { ok: false, message: 'Nem sikerült menteni az egyeztetést.' }
    }
    revalidatePath(PAGE)
    return { ok: true, id: existing.id }
  }

  const { data: inserted, error } = await ctx.supabase
    .from('daily_reconciliations')
    .insert({
      ...payload,
      created_by: userId
    })
    .select('id')
    .single()

  if (error || !inserted) {
    console.error('saveDailyReconciliation insert', error?.message)
    return { ok: false, message: 'Nem sikerült menteni az egyeztetést.' }
  }

  revalidatePath(PAGE)
  return { ok: true, id: inserted.id as string }
}
