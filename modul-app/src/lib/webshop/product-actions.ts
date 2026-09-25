'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import { normalizePriceTiers, suggestWebSlug } from '@/lib/accessories/web-shop'
import { revalidateStorefrontTenant } from '@/lib/storefront/revalidate'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { enrichWebProductFields } from '@/lib/webshop/enrich'
import {
  shopProductSchema,
  shopRequirementIssues,
  shopValuesToRow,
  type ShopProductInput,
  type ShopProductValues,
  type ShopRequirementIssue
} from '@/lib/webshop/product-parse'
import { getTenantWebshopSettings } from '@/lib/webshop/settings'

export type ShopSaveResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

export type ShopAvailabilityResult =
  | {
      ok: true
      updated: number
      blocked: { id: string; name: string; issues: ShopRequirementIssue[] }[]
    }
  | { ok: false; message: string }

const NOT_ENTITLED = 'Az Online bolt modul nincs bekapcsolva ennél a cégnél.'

type CoreRow = {
  id: string
  name: string
  sku: string
  image_url: string | null
  price_net: number
  active: boolean
}

async function loadCore(
  supabase: SupabaseClient,
  tenantId: string,
  ids: string[]
): Promise<Map<string, CoreRow>> {
  const { data } = await supabase
    .from('accessories')
    .select('id, name, sku, image_url, price_net, active')
    .eq('tenant_id', tenantId)
    .in('id', ids)
    .is('deleted_at', null)
  return new Map(
    (data ?? []).map((r) => [
      r.id as string,
      {
        id: r.id as string,
        name: String(r.name ?? ''),
        sku: String(r.sku ?? ''),
        image_url: (r.image_url as string | null)?.trim() || null,
        price_net: Number(r.price_net ?? 0),
        active: r.active === true
      }
    ])
  )
}

/** Szabad webcím: `alap`, `alap-2`, `alap-3` … (a saját sorát nem számolja foglaltnak). */
async function uniqueSlug(
  supabase: SupabaseClient,
  tenantId: string,
  base: string,
  ownId: string
): Promise<string> {
  const root = base || 'termek'
  const { data } = await supabase
    .from('accessory_web')
    .select('accessory_id, web_slug')
    .eq('tenant_id', tenantId)
    .like('web_slug', `${root}%`)
  const taken = new Set(
    (data ?? []).filter((r) => r.accessory_id !== ownId).map((r) => r.web_slug as string)
  )
  if (!taken.has(root)) return root
  for (let i = 2; i < 1000; i++) {
    const candidate = `${root.slice(0, 115)}-${i}`
    if (!taken.has(candidate)) return candidate
  }
  return `${root.slice(0, 110)}-${Date.now().toString(36)}`
}

function mapDbError(message: string): { field?: string; message: string } {
  if (message.includes('accessory_web_tenant_slug_uidx') || message.includes('web_slug')) {
    return { field: 'webSlug', message: 'Ez a webcím már foglalt egy másik terméknél.' }
  }
  if (message.includes('web_category_id')) {
    return { field: 'webCategoryId', message: 'A választott kategória nem létezik.' }
  }
  if (message.includes('youtube') || message.includes('video')) {
    return { field: 'webVideoUrl', message: 'Csak YouTube link adható meg.' }
  }
  return { message: 'Nem sikerült menteni a bolt adatokat.' }
}

function fieldErrorsFromIssues(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !out[key]) out[key] = issue.message
  }
  return out
}

async function syncAttributes(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string,
  data: ShopProductValues
) {
  await supabase
    .from('accessory_attribute_values')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
  if (data.attributeValueIds.length > 0) {
    const { error } = await supabase.from('accessory_attribute_values').insert(
      data.attributeValueIds.map((attribute_value_id) => ({
        tenant_id: tenantId,
        accessory_id: accessoryId,
        attribute_value_id
      }))
    )
    if (error) console.error('syncAttributes values', error.message)
  }

  const nonEmpty = data.attributeInputs.filter(
    (i) => i.valueNum != null || i.valueMax != null || i.valueBool != null
  )
  let valid = nonEmpty
  if (nonEmpty.length > 0) {
    const { data: attrs } = await supabase
      .from('product_attributes')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .neq('value_type', 'list')
      .in(
        'id',
        nonEmpty.map((i) => i.attributeId)
      )
    const ok = new Set((attrs ?? []).map((a) => a.id as string))
    valid = nonEmpty.filter((i) => ok.has(i.attributeId))
  }
  const { error: delError } = await supabase
    .from('accessory_attribute_inputs')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
  if (delError) {
    console.error('syncAttributes inputs delete', delError.message)
    return
  }
  if (valid.length === 0) return
  const { error } = await supabase.from('accessory_attribute_inputs').insert(
    valid.map((i) => ({
      tenant_id: tenantId,
      accessory_id: accessoryId,
      attribute_id: i.attributeId,
      value_num: i.valueNum,
      value_max: i.valueMax,
      value_bool: i.valueBool
    }))
  )
  if (error) console.error('syncAttributes inputs', error.message)
}

function revalidateAdmin(accessoryIds: string[]) {
  revalidatePath('/webshop')
  revalidatePath('/webshop/katalogus')
  revalidatePath('/torzsadatok/alapanyagok/termekek')
  for (const id of accessoryIds) {
    revalidatePath(`/webshop/katalogus/${id}`)
    revalidatePath(`/torzsadatok/alapanyagok/termekek/${id}`)
  }
}

export async function saveShopProduct(
  accessoryId: string,
  input: ShopProductInput
): Promise<ShopSaveResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!
  if (!(await tenantHasWebshop(ctx.supabase, tenantId))) {
    return { ok: false, message: NOT_ENTITLED }
  }

  const parsed = shopProductSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromIssues(parsed.error.issues)
    }
  }

  const core = (await loadCore(ctx.supabase, tenantId, [accessoryId])).get(accessoryId)
  if (!core) return { ok: false, message: 'A termék nem található.' }

  const { data: prev } = await ctx.supabase
    .from('accessory_web')
    .select('web_slug')
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
    .maybeSingle()

  let data = parsed.data
  if (!data.webSlug) {
    data = {
      ...data,
      webSlug: await uniqueSlug(ctx.supabase, tenantId, suggestWebSlug(core.name), accessoryId)
    }
  }

  if (data.sellableWeb) {
    const issues = shopRequirementIssues(data, {
      name: core.name,
      imageUrl: core.image_url,
      priceNet: core.price_net,
      active: core.active
    })
    if (issues.length > 0) {
      return {
        ok: false,
        message: `A boltba kerüléshez még kell: ${issues.map((i) => i.label.toLowerCase()).join(', ')}.`,
        fieldErrors: Object.fromEntries(issues.map((i) => [i.field, i.message]))
      }
    }
    const shippingDefaults = await getTenantWebshopSettings(ctx.supabase, tenantId)
    data = {
      ...data,
      ...enrichWebProductFields(data, { productName: core.name, sku: core.sku, shippingDefaults })
    }
  }

  const { error } = await ctx.supabase.from('accessory_web').upsert(
    {
      accessory_id: accessoryId,
      tenant_id: tenantId,
      ...shopValuesToRow(data, normalizePriceTiers(data.webPriceTiers)),
      updated_at: new Date().toISOString()
    },
    { onConflict: 'accessory_id' }
  )
  if (error) {
    const mapped = mapDbError(error.message)
    console.error('saveShopProduct', error.message)
    return {
      ok: false,
      message: mapped.message,
      fieldErrors: mapped.field ? { [mapped.field]: mapped.message } : undefined
    }
  }

  await syncAttributes(ctx.supabase, tenantId, accessoryId, data)

  revalidateAdmin([accessoryId])
  await revalidateStorefrontTenant(tenantId, {
    productSlugs: [data.webSlug, (prev?.web_slug as string | null) ?? null]
  })
  return { ok: true }
}

const MAX_BULK = 100

/**
 * Bekapcsolásnál csak az a termék kerül ki, amelyiknél minden kötelező megvan;
 * a többit visszaadjuk a hiánylistával.
 */
export async function setShopAvailability(
  accessoryIds: string[],
  on: boolean
): Promise<ShopAvailabilityResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!
  if (!(await tenantHasWebshop(ctx.supabase, tenantId))) {
    return { ok: false, message: NOT_ENTITLED }
  }
  const ids = [...new Set(accessoryIds)].slice(0, MAX_BULK)
  if (ids.length === 0) return { ok: true, updated: 0, blocked: [] }

  const { data: webRows } = await ctx.supabase
    .from('accessory_web')
    .select(
      'accessory_id, web_slug, web_title, web_description_long, web_description_short, web_category_id, web_product_type'
    )
    .eq('tenant_id', tenantId)
    .in('accessory_id', ids)
  const webById = new Map((webRows ?? []).map((r) => [r.accessory_id as string, r]))

  if (!on) {
    const { error } = await ctx.supabase
      .from('accessory_web')
      .update({ sellable_web: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .in('accessory_id', ids)
    if (error) return { ok: false, message: 'Nem sikerült levenni a boltból.' }
    revalidateAdmin(ids)
    await revalidateStorefrontTenant(tenantId, {
      productSlugs: (webRows ?? []).map((r) => r.web_slug as string | null)
    })
    return { ok: true, updated: webById.size, blocked: [] }
  }

  const cores = await loadCore(ctx.supabase, tenantId, ids)
  const blocked: { id: string; name: string; issues: ShopRequirementIssue[] }[] = []
  const slugs: string[] = []
  let updated = 0

  for (const id of ids) {
    const core = cores.get(id)
    if (!core) continue
    const w = webById.get(id)
    const issues = shopRequirementIssues(
      {
        webSlug: (w?.web_slug as string | null) ?? null,
        webTitle: (w?.web_title as string | null) ?? null,
        webDescriptionLong: (w?.web_description_long as string | null) ?? null,
        webDescriptionShort: (w?.web_description_short as string | null) ?? null,
        webCategoryId: (w?.web_category_id as string | null) ?? null,
        webProductType: (w?.web_product_type as string | null) ?? null
      },
      { name: core.name, imageUrl: core.image_url, priceNet: core.price_net, active: core.active }
    )
    if (issues.length > 0) {
      blocked.push({ id, name: core.name, issues })
      continue
    }
    const slug =
      (w?.web_slug as string | null) ||
      (await uniqueSlug(ctx.supabase, tenantId, suggestWebSlug(core.name), id))
    const { error } = await ctx.supabase
      .from('accessory_web')
      .update({ sellable_web: true, web_slug: slug, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('accessory_id', id)
    if (error) {
      console.error('setShopAvailability', error.message)
      blocked.push({
        id,
        name: core.name,
        issues: [{ field: 'webSlug', label: 'Webcím', message: mapDbError(error.message).message }]
      })
      continue
    }
    updated += 1
    slugs.push(slug)
  }

  revalidateAdmin(ids)
  if (slugs.length > 0) await revalidateStorefrontTenant(tenantId, { productSlugs: slugs })
  return { ok: true, updated, blocked }
}

export type VariantCandidate = {
  id: string
  name: string
  sku: string
  image_url: string | null
  group_id: string | null
  slug: string | null
}

/** Változatcsoporthoz: más bolt termékek keresése, hogy a csoportjukhoz lehessen csatlakozni. */
export async function searchVariantCandidates(
  accessoryId: string,
  q: string
): Promise<{ ok: true; items: VariantCandidate[] } | { ok: false; message: string }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const term = q.trim().slice(0, 80).replace(/[%_,()]/g, ' ')
  if (term.length < 2) return { ok: true, items: [] }
  const { data, error } = await ctx.supabase
    .from('storefront_products')
    .select('id, name, sku, image_url, web_group_id, web_slug')
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .neq('id', accessoryId)
    .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
    .order('name', { ascending: true })
    .limit(8)
  if (error) return { ok: false, message: 'A keresés nem sikerült.' }
  return {
    ok: true,
    items: (data ?? []).map((r) => ({
      id: r.id as string,
      name: String(r.name ?? ''),
      sku: String(r.sku ?? ''),
      image_url: (r.image_url as string | null) ?? null,
      group_id: (r.web_group_id as string | null) ?? null,
      slug: (r.web_slug as string | null) ?? null
    }))
  }
}
