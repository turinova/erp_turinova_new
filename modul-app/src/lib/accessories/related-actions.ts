'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { revalidateStorefrontTenant } from '@/lib/storefront/revalidate'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type RelatedProduct = {
  id: string
  name: string
  sku: string
  imageUrl: string | null
}

export type RelatedActionResult =
  | { ok: true; items: RelatedProduct[] }
  | { ok: false; message: string }

const MAX_RELATED = 8
const uuid = z.string().uuid()

function toItem(r: Record<string, unknown>): RelatedProduct {
  return {
    id: String(r.id),
    name: String(r.web_title || r.name || ''),
    sku: String(r.sku ?? ''),
    imageUrl: (r.image_url as string | null) ?? null
  }
}

async function listRelated(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<RelatedProduct[]> {
  const { data } = await supabase
    .from('accessory_related')
    .select('related_id, sort_order, accessories!accessory_related_related_id_fkey ( id, name, web_title, sku, image_url )')
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
    .order('sort_order', { ascending: true })
  return ((data ?? []) as Record<string, unknown>[])
    .map((r) => {
      const a = Array.isArray(r.accessories) ? r.accessories[0] : r.accessories
      return a ? toItem(a as Record<string, unknown>) : null
    })
    .filter((x): x is RelatedProduct => x != null)
}

export async function getRequiredProducts(accessoryId: string): Promise<RelatedActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!uuid.safeParse(accessoryId).success) return { ok: false, message: 'Érvénytelen termék.' }
  return { ok: true, items: await listRelated(ctx.supabase, ctx.user.tenantId!, accessoryId) }
}

export async function searchRequiredCandidates(
  accessoryId: string,
  q: string
): Promise<RelatedActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const term = q.trim().slice(0, 80).replace(/[%_,()]/g, ' ')
  if (term.length < 2) return { ok: true, items: [] }
  const { data, error } = await ctx.supabase
    .from('accessories')
    .select('id, name, web_title, sku, image_url')
    .eq('tenant_id', ctx.user.tenantId!)
    .eq('sellable_web', true)
    .is('deleted_at', null)
    .neq('id', accessoryId)
    .or(`name.ilike.%${term}%,web_title.ilike.%${term}%,sku.ilike.%${term}%`)
    .order('name', { ascending: true })
    .limit(10)
  if (error) return { ok: false, message: 'Nem sikerült keresni.' }
  return { ok: true, items: ((data ?? []) as Record<string, unknown>[]).map(toItem) }
}

export async function addRequiredProduct(
  accessoryId: string,
  relatedId: string
): Promise<RelatedActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!uuid.safeParse(accessoryId).success || !uuid.safeParse(relatedId).success) {
    return { ok: false, message: 'Érvénytelen termék.' }
  }
  if (accessoryId === relatedId) {
    return { ok: false, message: 'A termék nem lehet önmaga kiegészítője.' }
  }
  const tenantId = ctx.user.tenantId!
  const { data: owned } = await ctx.supabase
    .from('accessories')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('id', [accessoryId, relatedId])
    .is('deleted_at', null)
  if ((owned ?? []).length !== 2) return { ok: false, message: 'A termék nem található.' }
  const current = await listRelated(ctx.supabase, tenantId, accessoryId)
  if (current.some((c) => c.id === relatedId)) return { ok: true, items: current }
  if (current.length >= MAX_RELATED) {
    return { ok: false, message: `Legfeljebb ${MAX_RELATED} kiegészítő adható meg.` }
  }
  const { error } = await ctx.supabase.from('accessory_related').insert({
    tenant_id: tenantId,
    accessory_id: accessoryId,
    related_id: relatedId,
    kind: 'required',
    sort_order: current.length
  })
  if (error) return { ok: false, message: 'Nem sikerült hozzáadni.' }
  await revalidateStorefrontTenant(tenantId)
  return { ok: true, items: await listRelated(ctx.supabase, tenantId, accessoryId) }
}

export async function removeRequiredProduct(
  accessoryId: string,
  relatedId: string
): Promise<RelatedActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!uuid.safeParse(accessoryId).success || !uuid.safeParse(relatedId).success) {
    return { ok: false, message: 'Érvénytelen termék.' }
  }
  const tenantId = ctx.user.tenantId!
  const { error } = await ctx.supabase
    .from('accessory_related')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
    .eq('related_id', relatedId)
  if (error) return { ok: false, message: 'Nem sikerült eltávolítani.' }
  await revalidateStorefrontTenant(tenantId)
  return { ok: true, items: await listRelated(ctx.supabase, tenantId, accessoryId) }
}
