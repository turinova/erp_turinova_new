'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { resolveGoogleTaxonomyId } from '@/lib/webshop/google-taxonomy'
import {
  KEY_SPEC_PRESETS,
  MAX_KEY_SPECS,
  MAX_TEMPLATE_ITEMS,
  UNIT_OPTIONS
} from '@/lib/webshop/key-specs'
import type {
  AttributeValueType,
  CategoryAttributeRole
} from '@/lib/webshop/types'

const VALUE_TYPES: AttributeValueType[] = ['list', 'number', 'range', 'boolean']

function normalizeUnit(v: string | null | undefined): string | null {
  const t = v?.trim() ?? ''
  if (!t) return null
  return (UNIT_OPTIONS as readonly string[]).includes(t) ? t : t.slice(0, 12)
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export type WebshopActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

async function requireWebshopTenant() {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return ctx
  const entitled = await tenantHasWebshop(ctx.supabase, ctx.user.tenantId!)
  if (!entitled) {
    return {
      ok: false as const,
      message: 'A Webshop add-on nincs bekapcsolva.'
    }
  }
  return ctx
}

async function parentTaxonomyId(
  supabase: SupabaseClient,
  tenantId: string,
  parentId: string | null | undefined
): Promise<string | null> {
  if (!parentId) return null
  const { data } = await supabase
    .from('web_categories')
    .select('google_taxonomy_id')
    .eq('tenant_id', tenantId)
    .eq('id', parentId)
    .is('deleted_at', null)
    .maybeSingle()
  return emptyToNull(
    (data?.google_taxonomy_id as string | null | undefined) ?? null
  )
}

export async function createWebCategory(input: {
  name: string
  parentId?: string | null
  googleTaxonomyId?: string | null
  sortOrder?: number
  active?: boolean
}): Promise<WebshopActionResult> {
  const ctx = await requireWebshopTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const name = input.name.trim()
  if (!name) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: { name: 'A név kötelező.' }
    }
  }

  const parentId = input.parentId || null
  const parentTax = await parentTaxonomyId(
    ctx.supabase,
    ctx.user.tenantId!,
    parentId
  )
  const googleTaxonomyId = resolveGoogleTaxonomyId({
    explicit: input.googleTaxonomyId,
    categoryName: name,
    parentTaxonomyId: parentTax
  })

  const { data, error } = await ctx.supabase
    .from('web_categories')
    .insert({
      tenant_id: ctx.user.tenantId!,
      name,
      parent_id: parentId,
      google_taxonomy_id: googleTaxonomyId,
      sort_order: input.sortOrder ?? 100,
      active: input.active ?? true
    })
    .select('id')
    .single()

  if (error) {
    return { ok: false, message: 'Nem sikerült létrehozni a kategóriát.' }
  }

  revalidatePath('/webshop/kategoriak')
  revalidatePath('/webshop')
  return { ok: true, id: data.id }
}

export async function updateWebCategory(input: {
  id: string
  name: string
  parentId?: string | null
  googleTaxonomyId?: string | null
  sortOrder?: number
  active?: boolean
}): Promise<WebshopActionResult> {
  const ctx = await requireWebshopTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const name = input.name.trim()
  if (!name) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: { name: 'A név kötelező.' }
    }
  }

  if (input.parentId && input.parentId === input.id) {
    return {
      ok: false,
      message: 'A kategória nem lehet saját szülője.',
      fieldErrors: { parentId: 'Érvénytelen szülő.' }
    }
  }

  const parentId = input.parentId || null
  if (parentId) {
    const { data: all } = await ctx.supabase
      .from('web_categories')
      .select('id, parent_id')
      .eq('tenant_id', ctx.user.tenantId!)
      .is('deleted_at', null)
    const parentOf = new Map(
      (all ?? []).map((r) => [r.id as string, (r.parent_id as string | null) ?? null])
    )
    let cursor: string | null = parentId
    const seen = new Set<string>()
    while (cursor && !seen.has(cursor)) {
      if (cursor === input.id) {
        return {
          ok: false,
          message: 'A kategória nem kerülhet a saját alkategóriája alá.',
          fieldErrors: { parentId: 'Érvénytelen szülő.' }
        }
      }
      seen.add(cursor)
      cursor = parentOf.get(cursor) ?? null
    }
  }
  const parentTax = await parentTaxonomyId(
    ctx.supabase,
    ctx.user.tenantId!,
    parentId
  )
  const googleTaxonomyId = resolveGoogleTaxonomyId({
    explicit: input.googleTaxonomyId,
    categoryName: name,
    parentTaxonomyId: parentTax
  })

  const { data, error } = await ctx.supabase
    .from('web_categories')
    .update({
      name,
      parent_id: parentId,
      google_taxonomy_id: googleTaxonomyId,
      sort_order: input.sortOrder ?? 100,
      active: input.active ?? true,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült menteni a kategóriát.' }
  }
  if (!data) return { ok: false, message: 'A kategória nem található.' }

  revalidatePath('/webshop/kategoriak')
  return { ok: true, id: data.id }
}

export async function softDeleteWebCategory(
  id: string
): Promise<WebshopActionResult> {
  const ctx = await requireWebshopTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { count } = await ctx.supabase
    .from('storefront_products')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', ctx.user.tenantId!)
    .eq('web_category_id', id)
    .is('deleted_at', null)

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: 'Van termék ebben a kategóriában — előbb helyezd át őket.'
    }
  }

  const { count: childCount } = await ctx.supabase
    .from('web_categories')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', ctx.user.tenantId!)
    .eq('parent_id', id)
    .is('deleted_at', null)

  if ((childCount ?? 0) > 0) {
    return {
      ok: false,
      message:
        'Van alkategóriája — előbb helyezd át őket, különben elveszítenék az örökölt kulcsadatokat.'
    }
  }

  const { data, error } = await ctx.supabase
    .from('web_categories')
    .update({
      deleted_at: new Date().toISOString(),
      active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült törölni a kategóriát.' }
  }
  if (!data) return { ok: false, message: 'A kategória nem található.' }

  revalidatePath('/webshop/kategoriak')
  return { ok: true, id: data.id }
}

export type ProductAttributeInput = {
  name: string
  code: string
  sortOrder?: number
  valueType?: AttributeValueType
  unit?: string | null
  measureHint?: string | null
  allowMultiple?: boolean
}

export async function createProductAttribute(
  input: ProductAttributeInput
): Promise<WebshopActionResult> {
  const ctx = await requireWebshopTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const name = input.name.trim()
  const code = input.code.trim().toLowerCase().replace(/\s+/g, '_')
  if (!name || !code) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: {
        ...(name ? {} : { name: 'A név kötelező.' }),
        ...(code ? {} : { code: 'A kód kötelező.' })
      }
    }
  }
  const valueType = VALUE_TYPES.includes(input.valueType ?? 'list')
    ? (input.valueType ?? 'list')
    : 'list'

  const { data, error } = await ctx.supabase
    .from('product_attributes')
    .insert({
      tenant_id: ctx.user.tenantId!,
      name,
      code,
      sort_order: input.sortOrder ?? 100,
      value_type: valueType,
      unit: valueType === 'list' || valueType === 'boolean' ? null : normalizeUnit(input.unit),
      measure_hint: emptyToNull(input.measureHint)?.slice(0, 300) ?? null,
      allow_multiple: valueType === 'list' && input.allowMultiple === true
    })
    .select('id')
    .single()

  if (error) {
    if (error.message.includes('product_attributes_tenant_code')) {
      return {
        ok: false,
        message: 'Ez a kód már foglalt.',
        fieldErrors: { code: 'Ez a kód már foglalt.' }
      }
    }
    return { ok: false, message: 'Nem sikerült létrehozni a tulajdonságot.' }
  }

  revalidatePath('/webshop/tulajdonsagok')
  return { ok: true, id: data.id }
}

async function attributeHasProductData(
  supabase: SupabaseClient,
  tenantId: string,
  attributeId: string
): Promise<boolean> {
  const { count: inputCount } = await supabase
    .from('accessory_attribute_inputs')
    .select('accessory_id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('attribute_id', attributeId)
  if ((inputCount ?? 0) > 0) return true

  const { data: values } = await supabase
    .from('attribute_values')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('attribute_id', attributeId)
  const ids = (values ?? []).map((v) => v.id as string)
  if (ids.length === 0) return false
  const { count: linkCount } = await supabase
    .from('accessory_attribute_values')
    .select('accessory_id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('attribute_value_id', ids)
  return (linkCount ?? 0) > 0
}

export async function updateProductAttribute(
  input: Omit<ProductAttributeInput, 'code'> & { id: string }
): Promise<WebshopActionResult> {
  const ctx = await requireWebshopTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!

  const name = input.name.trim()
  if (!name) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: { name: 'A név kötelező.' }
    }
  }

  const { data: current } = await ctx.supabase
    .from('product_attributes')
    .select('id, value_type')
    .eq('tenant_id', tenantId)
    .eq('id', input.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!current) return { ok: false, message: 'A jellemző nem található.' }

  const valueType = VALUE_TYPES.includes(input.valueType ?? 'list')
    ? (input.valueType ?? 'list')
    : 'list'
  if (valueType !== current.value_type) {
    const used = await attributeHasProductData(ctx.supabase, tenantId, input.id)
    if (used) {
      return {
        ok: false,
        message:
          'A típus nem váltható, mert már van terméken érték — különben elveszne az adat.',
        fieldErrors: { valueType: 'Már használatban.' }
      }
    }
  }

  const { data, error } = await ctx.supabase
    .from('product_attributes')
    .update({
      name,
      value_type: valueType,
      unit: valueType === 'list' || valueType === 'boolean' ? null : normalizeUnit(input.unit),
      measure_hint: emptyToNull(input.measureHint)?.slice(0, 300) ?? null,
      allow_multiple: valueType === 'list' && input.allowMultiple === true,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült menteni a jellemzőt.' }
  }
  if (!data) return { ok: false, message: 'A jellemző nem található.' }

  revalidatePath('/webshop/tulajdonsagok')
  revalidatePath('/webshop/kategoriak')
  return { ok: true, id: data.id }
}

export async function saveCategoryTemplate(input: {
  categoryId: string
  items: { attributeId: string; role: CategoryAttributeRole }[]
  measureImageUrl?: string | null
}): Promise<WebshopActionResult> {
  const ctx = await requireWebshopTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!

  const seen = new Set<string>()
  const items = input.items.filter((i) => {
    if (!i.attributeId || seen.has(i.attributeId)) return false
    seen.add(i.attributeId)
    return i.role === 'key' || i.role === 'spec'
  })
  if (items.length > MAX_TEMPLATE_ITEMS) {
    return {
      ok: false,
      message: `Legfeljebb ${MAX_TEMPLATE_ITEMS} adat lehet egy kategóriában.`
    }
  }
  if (items.filter((i) => i.role === 'key').length > MAX_KEY_SPECS) {
    return {
      ok: false,
      message: `Legfeljebb ${MAX_KEY_SPECS} kulcsadat lehet — a vásárló ennyit tud egy pillantással összevetni.`
    }
  }

  const measureImageUrl = emptyToNull(input.measureImageUrl)
  if (measureImageUrl && (!isHttpUrl(measureImageUrl) || measureImageUrl.length > 2000)) {
    return {
      ok: false,
      message: 'Érvényes kép URL kell (https://…).',
      fieldErrors: { measureImageUrl: 'Érvénytelen URL.' }
    }
  }

  const { data: cat } = await ctx.supabase
    .from('web_categories')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', input.categoryId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!cat) return { ok: false, message: 'A kategória nem található.' }

  if (items.length > 0) {
    const { data: attrs } = await ctx.supabase
      .from('product_attributes')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in(
        'id',
        items.map((i) => i.attributeId)
      )
    const valid = new Set((attrs ?? []).map((a) => a.id as string))
    if (items.some((i) => !valid.has(i.attributeId))) {
      return { ok: false, message: 'Egy kiválasztott jellemző már nem létezik.' }
    }
  }

  const { error: delError } = await ctx.supabase
    .from('web_category_attributes')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('category_id', input.categoryId)
  if (delError) {
    return { ok: false, message: 'Nem sikerült menteni a kulcsadatokat.' }
  }

  if (items.length > 0) {
    const { error: insError } = await ctx.supabase
      .from('web_category_attributes')
      .insert(
        items.map((i, index) => ({
          tenant_id: tenantId,
          category_id: input.categoryId,
          attribute_id: i.attributeId,
          role: i.role,
          sort_order: (index + 1) * 10
        }))
      )
    if (insError) {
      return { ok: false, message: 'Nem sikerült menteni a kulcsadatokat.' }
    }
  }

  const { error: catError } = await ctx.supabase
    .from('web_categories')
    .update({
      measure_image_url: measureImageUrl,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .eq('id', input.categoryId)
  if (catError) {
    return { ok: false, message: 'Nem sikerült menteni a mérési ábrát.' }
  }

  revalidatePath('/webshop/kategoriak')
  return { ok: true, id: input.categoryId }
}

/**
 * Sablonjavaslat: hiányzó műszaki adatokat létrehozza (meglévő kódot újrahasznál),
 * és a kategória saját sablonjává teszi. Nem seed — csak kérésre.
 */
export async function applyKeySpecPreset(input: {
  categoryId: string
  presetId: string
}): Promise<WebshopActionResult> {
  const ctx = await requireWebshopTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!

  const preset = KEY_SPEC_PRESETS.find((p) => p.id === input.presetId)
  if (!preset) return { ok: false, message: 'Ismeretlen sablon.' }

  const { data: cat } = await ctx.supabase
    .from('web_categories')
    .select('id, measure_image_url')
    .eq('tenant_id', tenantId)
    .eq('id', input.categoryId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!cat) return { ok: false, message: 'A kategória nem található.' }

  const codes = preset.attributes.map((a) => a.code)
  const { data: existing } = await ctx.supabase
    .from('product_attributes')
    .select('id, code')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .in('code', codes)
  const byCode = new Map(
    (existing ?? []).map((a) => [String(a.code).toLowerCase(), a.id as string])
  )

  const items: { attributeId: string; role: CategoryAttributeRole }[] = []
  for (const [index, a] of preset.attributes.entries()) {
    let id = byCode.get(a.code)
    if (!id) {
      const { data: created, error } = await ctx.supabase
        .from('product_attributes')
        .insert({
          tenant_id: tenantId,
          name: a.name,
          code: a.code,
          sort_order: 100 + index,
          value_type: a.valueType,
          unit: a.unit,
          measure_hint: a.measureHint,
          allow_multiple: a.allowMultiple === true
        })
        .select('id')
        .single()
      if (error || !created) {
        console.error('applyKeySpecPreset attr', error?.message)
        return { ok: false, message: `Nem sikerült létrehozni: ${a.name}.` }
      }
      id = created.id as string
      if (a.values && a.values.length > 0) {
        await ctx.supabase.from('attribute_values').insert(
          a.values.map((label, i) => ({
            tenant_id: tenantId,
            attribute_id: id,
            label,
            sort_order: (i + 1) * 10
          }))
        )
      }
    }
    items.push({ attributeId: id, role: a.role })
  }

  const saved = await saveCategoryTemplate({
    categoryId: input.categoryId,
    items,
    measureImageUrl: (cat.measure_image_url as string | null) ?? null
  })
  if (!saved.ok) return saved

  revalidatePath('/webshop/tulajdonsagok')
  return { ok: true, id: input.categoryId }
}

export async function createAttributeValue(input: {
  attributeId: string
  label: string
  sortOrder?: number
}): Promise<WebshopActionResult> {
  const ctx = await requireWebshopTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const label = input.label.trim()
  if (!label) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: { label: 'Az érték kötelező.' }
    }
  }

  const { data, error } = await ctx.supabase
    .from('attribute_values')
    .insert({
      tenant_id: ctx.user.tenantId!,
      attribute_id: input.attributeId,
      label,
      sort_order: input.sortOrder ?? 100
    })
    .select('id')
    .single()

  if (error) {
    return { ok: false, message: 'Nem sikerült hozzáadni az értéket.' }
  }

  revalidatePath('/webshop/tulajdonsagok')
  return { ok: true, id: data.id }
}

export async function softDeleteAttributeValue(
  id: string
): Promise<WebshopActionResult> {
  const ctx = await requireWebshopTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('attribute_values')
    .update({
      deleted_at: new Date().toISOString(),
      active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült törölni az értéket.' }
  }
  if (!data) return { ok: false, message: 'Az érték nem található.' }

  await ctx.supabase
    .from('accessory_attribute_values')
    .delete()
    .eq('tenant_id', ctx.user.tenantId!)
    .eq('attribute_value_id', id)

  revalidatePath('/webshop/tulajdonsagok')
  return { ok: true, id: data.id }
}

export async function softDeleteProductAttribute(
  id: string
): Promise<WebshopActionResult> {
  const ctx = await requireWebshopTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data: values } = await ctx.supabase
    .from('attribute_values')
    .select('id')
    .eq('tenant_id', ctx.user.tenantId!)
    .eq('attribute_id', id)
    .is('deleted_at', null)

  await Promise.all([
    ctx.supabase
      .from('accessory_attribute_inputs')
      .delete()
      .eq('tenant_id', ctx.user.tenantId!)
      .eq('attribute_id', id),
    ctx.supabase
      .from('web_category_attributes')
      .delete()
      .eq('tenant_id', ctx.user.tenantId!)
      .eq('attribute_id', id)
  ])

  const valueIds = (values ?? []).map((v) => v.id as string)
  if (valueIds.length > 0) {
    await ctx.supabase
      .from('accessory_attribute_values')
      .delete()
      .eq('tenant_id', ctx.user.tenantId!)
      .in('attribute_value_id', valueIds)

    await ctx.supabase
      .from('attribute_values')
      .update({
        deleted_at: new Date().toISOString(),
        active: false,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', ctx.user.tenantId!)
      .eq('attribute_id', id)
      .is('deleted_at', null)
  }

  const { data, error } = await ctx.supabase
    .from('product_attributes')
    .update({
      deleted_at: new Date().toISOString(),
      active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült törölni a tulajdonságot.' }
  }
  if (!data) return { ok: false, message: 'A tulajdonság nem található.' }

  revalidatePath('/webshop/tulajdonsagok')
  revalidatePath('/webshop/kategoriak')
  return { ok: true, id: data.id }
}
