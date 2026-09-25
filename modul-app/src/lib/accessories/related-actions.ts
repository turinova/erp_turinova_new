'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import {
  isRelatedKind,
  MAX_RELATED_PER_KIND,
  RELATED_KIND_META,
  RELATED_KINDS,
  type RelatedKind
} from '@/lib/accessories/related-kinds'
import { revalidateStorefrontTenant } from '@/lib/storefront/revalidate'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type RelatedProduct = {
  id: string
  name: string
  sku: string
  imageUrl: string | null
}

export type RelatedGroups = Record<RelatedKind, RelatedProduct[]>

export type RelatedActionResult =
  | { ok: true; groups: RelatedGroups }
  | { ok: false; message: string }

export type RelatedSearchResult =
  | { ok: true; items: RelatedProduct[] }
  | { ok: false; message: string }

const uuid = z.string().uuid()

function toItem(r: Record<string, unknown>): RelatedProduct {
  return {
    id: String(r.id),
    name: String(r.web_title || r.name || ''),
    sku: String(r.sku ?? ''),
    imageUrl: (r.image_url as string | null) ?? null
  }
}

function emptyGroups(): RelatedGroups {
  return { required: [], accessory: [], alternative: [], larger_pack: [] }
}

async function listRelated(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<RelatedGroups> {
  const { data } = await supabase
    .from('accessory_related')
    .select(
      'related_id, kind, sort_order, accessories!accessory_related_related_id_fkey ( id, name, web_title, sku, image_url )'
    )
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
    .order('sort_order', { ascending: true })
    .limit(RELATED_KINDS.length * MAX_RELATED_PER_KIND)
  const groups = emptyGroups()
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const a = Array.isArray(r.accessories) ? r.accessories[0] : r.accessories
    const kind = isRelatedKind(r.kind) ? r.kind : 'required'
    if (a) groups[kind].push(toItem(a as Record<string, unknown>))
  }
  return groups
}

export async function getRelatedProducts(accessoryId: string): Promise<RelatedActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!uuid.safeParse(accessoryId).success) return { ok: false, message: 'Érvénytelen termék.' }
  return { ok: true, groups: await listRelated(ctx.supabase, ctx.user.tenantId!, accessoryId) }
}

export async function searchRelatedCandidates(
  accessoryId: string,
  q: string
): Promise<RelatedSearchResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const term = q.trim().slice(0, 80).replace(/[%_,()]/g, ' ')
  if (term.length < 2) return { ok: true, items: [] }
  const { data, error } = await ctx.supabase
    .from('storefront_products')
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

export async function addRelatedProduct(
  accessoryId: string,
  relatedId: string,
  kind: RelatedKind
): Promise<RelatedActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!uuid.safeParse(accessoryId).success || !uuid.safeParse(relatedId).success) {
    return { ok: false, message: 'Érvénytelen termék.' }
  }
  if (!isRelatedKind(kind)) return { ok: false, message: 'Érvénytelen kapcsolattípus.' }
  if (accessoryId === relatedId) {
    return { ok: false, message: 'A termék nem kapcsolható önmagához.' }
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
  const existingKind = RELATED_KINDS.find((k) => current[k].some((c) => c.id === relatedId))
  if (existingKind === kind) return { ok: true, groups: current }
  if (existingKind) {
    return {
      ok: false,
      message: `Ez a termék már szerepel itt: „${RELATED_KIND_META[existingKind].label}”. Előbb onnan töröld.`
    }
  }
  if (current[kind].length >= MAX_RELATED_PER_KIND) {
    return {
      ok: false,
      message: `Legfeljebb ${MAX_RELATED_PER_KIND} termék adható meg itt: „${RELATED_KIND_META[kind].label}”.`
    }
  }

  const { error } = await ctx.supabase.from('accessory_related').insert({
    tenant_id: tenantId,
    accessory_id: accessoryId,
    related_id: relatedId,
    kind,
    sort_order: current[kind].length
  })
  if (error) return { ok: false, message: 'Nem sikerült hozzáadni.' }

  if (kind === 'alternative') {
    // Visszairány csak akkor, ha a párnak még nincs más típusú kapcsolata.
    await ctx.supabase.from('accessory_related').upsert(
      {
        tenant_id: tenantId,
        accessory_id: relatedId,
        related_id: accessoryId,
        kind: 'alternative',
        sort_order: 100
      },
      { onConflict: 'accessory_id,related_id', ignoreDuplicates: true }
    )
  }

  await revalidateStorefrontTenant(tenantId)
  return { ok: true, groups: await listRelated(ctx.supabase, tenantId, accessoryId) }
}

export async function removeRelatedProduct(
  accessoryId: string,
  relatedId: string,
  kind: RelatedKind
): Promise<RelatedActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!uuid.safeParse(accessoryId).success || !uuid.safeParse(relatedId).success) {
    return { ok: false, message: 'Érvénytelen termék.' }
  }
  if (!isRelatedKind(kind)) return { ok: false, message: 'Érvénytelen kapcsolattípus.' }
  const tenantId = ctx.user.tenantId!
  const { error } = await ctx.supabase
    .from('accessory_related')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
    .eq('related_id', relatedId)
    .eq('kind', kind)
  if (error) return { ok: false, message: 'Nem sikerült eltávolítani.' }
  if (kind === 'alternative') {
    await ctx.supabase
      .from('accessory_related')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('accessory_id', relatedId)
      .eq('related_id', accessoryId)
      .eq('kind', 'alternative')
  }
  await revalidateStorefrontTenant(tenantId)
  return { ok: true, groups: await listRelated(ctx.supabase, tenantId, accessoryId) }
}
