'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { invalidateSearchDictionary } from '@/lib/storefront/search/dictionary'
import { normSearch } from '@/lib/storefront/search/normalize'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'

export type SearchActionResult = { ok: true } | { ok: false; message: string }

const PATH = '/webshop/kereses'

async function context() {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return ctx
  const entitled = await tenantHasWebshop(ctx.supabase, ctx.user.tenantId!)
  if (!entitled) return { ok: false as const, message: 'A Webshop add-on nincs bekapcsolva.' }
  return ctx
}

const synonymSchema = z.object({
  id: z.string().uuid().nullish(),
  terms: z.array(z.string().max(60, 'Egy kifejezés legfeljebb 60 karakter.')).max(12, 'Legfeljebb 12 kifejezés.')
})

export async function saveSearchSynonym(input: z.input<typeof synonymSchema>): Promise<SearchActionResult> {
  const parsed = synonymSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Hibás adat.' }
  const terms = [...new Set(parsed.data.terms.map(normSearch).filter((t) => t.length >= 2))]
  if (terms.length < 2) {
    return { ok: false, message: 'Adj meg legalább két különböző kifejezést (pl. pánt, zsanér).' }
  }

  const ctx = await context()
  if (!ctx.ok) return ctx
  const tenantId = ctx.user.tenantId!

  const { error } = parsed.data.id
    ? await ctx.supabase
        .from('storefront_search_synonyms')
        .update({ terms, updated_at: new Date().toISOString() })
        .eq('id', parsed.data.id)
        .eq('tenant_id', tenantId)
    : await ctx.supabase.from('storefront_search_synonyms').insert({ tenant_id: tenantId, terms })
  if (error) {
    console.error('saveSearchSynonym', error.message)
    return { ok: false, message: 'Nem sikerült menteni a szinonimát.' }
  }
  invalidateSearchDictionary(tenantId)
  revalidatePath(PATH)
  return { ok: true }
}

export async function deleteSearchSynonym(id: string): Promise<SearchActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: 'Hibás azonosító.' }
  const ctx = await context()
  if (!ctx.ok) return ctx
  const tenantId = ctx.user.tenantId!
  const { error } = await ctx.supabase
    .from('storefront_search_synonyms')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)
  if (error) {
    console.error('deleteSearchSynonym', error.message)
    return { ok: false, message: 'Nem sikerült törölni a szinonimát.' }
  }
  invalidateSearchDictionary(tenantId)
  revalidatePath(PATH)
  return { ok: true }
}
