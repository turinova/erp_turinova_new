'use server'

import { revalidatePath } from 'next/cache'

import { runAutoProforma } from '@/lib/partner/auto-proforma'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type RetryAutoProformaResult =
  | { ok: true; providerNumber: string }
  | { ok: false; message: string }

/** Staff: kihagyott / hibás automatikus díjbekérő újraküldése. */
export async function retryAutoProforma(
  quoteId: string
): Promise<RetryAutoProformaResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!

  const { data: quote } = await ctx.supabase
    .from('quotes')
    .select('id, source, portal_submitted_at')
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!quote || quote.source !== 'portal' || !quote.portal_submitted_at) {
    return { ok: false, message: 'Az ajánlat nem található.' }
  }

  const result = await runAutoProforma({
    tenantId,
    quoteId,
    mode: 'retry',
    userId: ctx.user.id
  })

  revalidatePath(`/ajanlatok/${quoteId}`)
  revalidatePath('/home')

  if (result.status === 'busy') {
    return { ok: false, message: 'A díjbekérő küldése már folyamatban van.' }
  }
  if (result.status === 'issued') {
    return { ok: true, providerNumber: result.note ?? '' }
  }
  return { ok: false, message: result.note ?? 'Nem sikerült elküldeni a díjbekérőt.' }
}
