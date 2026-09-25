/**
 * PDP műszaki adatok: kategória kulcsadatok, egyesített spec lista,
 * variáns-tengelyek a web_group_id családon belül.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  attributeSortValue,
  formatAttributeValue,
  formatSpecNumber,
  resolveCategoryTemplate
} from '@/lib/webshop/key-specs'
import { asValueType, mapAttributeInputRow } from '@/lib/webshop/queries'
import type {
  AttributeInput,
  CategoryAttributeRole,
  CategoryTemplateItem,
  ProductAttributeRow
} from '@/lib/webshop/types'

export type PdpSpecAttr = Pick<
  ProductAttributeRow,
  'id' | 'name' | 'code' | 'valueType' | 'unit' | 'measureHint' | 'sortOrder'
>

export type PdpSpecValue = {
  display: string
  sort: number | null
  valueNum: number | null
}

export type PublicPdpKeySpec = {
  attributeId: string
  name: string
  value: string
  hint: string | null
  valueNum: number | null
  unit: string | null
}

export type PublicPdpSpecRow = {
  name: string
  value: string
  valueNum: number | null
  unit: string | null
}

export type PdpSpecContext = {
  attributes: Map<string, PdpSpecAttr>
  template: {
    items: CategoryTemplateItem[]
    measureImageUrl: string | null
  }
  /** accessoryId → attributeId → érték */
  values: Map<string, Map<string, PdpSpecValue>>
  /** Gyökértől a termék kategóriájáig. */
  categoryPath: string[]
}

export async function loadPdpSpecContext(
  admin: SupabaseClient,
  tenantId: string,
  categoryId: string | null,
  accessoryIds: string[]
): Promise<PdpSpecContext> {
  const ids = [...new Set(accessoryIds)]
  const [attrsRes, catsRes, tplRes, linksRes, inputsRes] = await Promise.all([
    admin
      .from('product_attributes')
      .select('id, name, code, value_type, unit, measure_hint, sort_order')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null),
    categoryId
      ? admin
          .from('web_categories')
          .select('id, name, parent_id, measure_image_url')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
      : Promise.resolve({ data: [], error: null }),
    categoryId
      ? admin
          .from('web_category_attributes')
          .select('category_id, attribute_id, role, sort_order')
          .eq('tenant_id', tenantId)
      : Promise.resolve({ data: [], error: null }),
    ids.length > 0
      ? admin
          .from('accessory_attribute_values')
          .select(
            'accessory_id, attribute_values ( attribute_id, label, sort_order, deleted_at )'
          )
          .eq('tenant_id', tenantId)
          .in('accessory_id', ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length > 0
      ? admin
          .from('accessory_attribute_inputs')
          .select('accessory_id, attribute_id, value_num, value_max, value_bool')
          .eq('tenant_id', tenantId)
          .in('accessory_id', ids)
      : Promise.resolve({ data: [], error: null })
  ])

  for (const [label, res] of [
    ['attrs', attrsRes],
    ['cats', catsRes],
    ['tpl', tplRes],
    ['links', linksRes],
    ['inputs', inputsRes]
  ] as const) {
    if (res.error) console.error(`loadPdpSpecContext ${label}`, res.error.message)
  }

  const attributes = new Map<string, PdpSpecAttr>()
  for (const a of attrsRes.data ?? []) {
    attributes.set(String(a.id), {
      id: String(a.id),
      name: String(a.name),
      code: String(a.code ?? ''),
      valueType: asValueType(a.value_type),
      unit: (a.unit as string | null) ?? null,
      measureHint: (a.measure_hint as string | null) ?? null,
      sortOrder: Number(a.sort_order ?? 100)
    })
  }

  const tplByCat = new Map<string, CategoryTemplateItem[]>()
  for (const t of (tplRes.data ?? []) as Record<string, unknown>[]) {
    const list = tplByCat.get(String(t.category_id)) ?? []
    list.push({
      attributeId: String(t.attribute_id),
      role: (t.role === 'spec' ? 'spec' : 'key') as CategoryAttributeRole,
      sortOrder: Number(t.sort_order ?? 100)
    })
    tplByCat.set(String(t.category_id), list)
  }
  const cats = ((catsRes.data ?? []) as Record<string, unknown>[]).map((c) => ({
    id: String(c.id),
    name: String(c.name),
    parentId: (c.parent_id as string | null) ?? null,
    measureImageUrl: (c.measure_image_url as string | null) ?? null,
    template: tplByCat.get(String(c.id)) ?? []
  }))
  const resolved = resolveCategoryTemplate(cats, categoryId)

  const labels = new Map<string, Map<string, { label: string; sort: number }[]>>()
  for (const row of (linksRes.data ?? []) as Record<string, unknown>[]) {
    const av = Array.isArray(row.attribute_values)
      ? row.attribute_values[0]
      : row.attribute_values
    const v = av as {
      attribute_id?: string
      label?: string
      sort_order?: number
      deleted_at?: string | null
    } | null
    if (!v?.attribute_id || !v.label || v.deleted_at) continue
    const accId = String(row.accessory_id)
    const byAttr = labels.get(accId) ?? new Map()
    const list = byAttr.get(v.attribute_id) ?? []
    list.push({ label: v.label.trim(), sort: Number(v.sort_order ?? 100) })
    byAttr.set(v.attribute_id, list)
    labels.set(accId, byAttr)
  }

  const inputs = new Map<string, Map<string, AttributeInput>>()
  for (const row of (inputsRes.data ?? []) as Record<string, unknown>[]) {
    const accId = String(row.accessory_id)
    const byAttr = inputs.get(accId) ?? new Map()
    const input = mapAttributeInputRow(row)
    byAttr.set(input.attributeId, input)
    inputs.set(accId, byAttr)
  }

  const values = new Map<string, Map<string, PdpSpecValue>>()
  for (const accId of ids) {
    const out = new Map<string, PdpSpecValue>()
    for (const attr of attributes.values()) {
      const lbl = (labels.get(accId)?.get(attr.id) ?? []).sort((a, b) => a.sort - b.sort)
      const input = inputs.get(accId)?.get(attr.id) ?? null
      const display = formatAttributeValue(
        attr,
        input,
        lbl.map((l) => l.label)
      )
      if (!display) continue
      out.set(attr.id, {
        display,
        sort:
          attr.valueType === 'list'
            ? (lbl[0]?.sort ?? null)
            : attributeSortValue(attr, input),
        valueNum: attr.valueType === 'number' ? (input?.valueNum ?? null) : null
      })
    }
    values.set(accId, out)
  }

  const byCat = new Map(cats.map((c) => [c.id, c]))
  const categoryPath: string[] = []
  const seen = new Set<string>()
  let cursor = categoryId ? byCat.get(categoryId) : undefined
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id)
    categoryPath.unshift(cursor.name)
    cursor = cursor.parentId ? byCat.get(cursor.parentId) : undefined
  }

  return {
    attributes,
    template: {
      items: resolved.items.filter((i) => attributes.has(i.attributeId)),
      measureImageUrl: resolved.measureImageUrl
    },
    values,
    categoryPath
  }
}

export function buildKeySpecs(
  ctx: PdpSpecContext,
  accessoryId: string
): PublicPdpKeySpec[] {
  const own = ctx.values.get(accessoryId)
  if (!own) return []
  return ctx.template.items
    .filter((i) => i.role === 'key')
    .map((i) => {
      const attr = ctx.attributes.get(i.attributeId)
      const v = own.get(i.attributeId)
      if (!attr || !v) return null
      return {
        attributeId: attr.id,
        name: attr.name,
        value: v.display,
        hint: attr.measureHint,
        valueNum: v.valueNum,
        unit: attr.unit
      } satisfies PublicPdpKeySpec
    })
    .filter((k): k is PublicPdpKeySpec => k != null)
}

/**
 * Egyesített műszaki lista: sablon „ajánlott” → többi strukturált adat → szabad web_specs
 * → termék nettó méretek. Név szerint duplikáció-szűrt; kulcsadat nem ismétlődik.
 */
export function buildSpecRows(
  ctx: PdpSpecContext,
  accessoryId: string,
  freeSpecs: Record<string, string>,
  dims: {
    lengthCm: number | null
    widthCm: number | null
    heightCm: number | null
    weightKg: number | null
  }
): PublicPdpSpecRow[] {
  const own = ctx.values.get(accessoryId) ?? new Map<string, PdpSpecValue>()
  const keyIds = new Set(
    ctx.template.items.filter((i) => i.role === 'key').map((i) => i.attributeId)
  )
  const specOrder = ctx.template.items
    .filter((i) => i.role === 'spec')
    .map((i) => i.attributeId)

  const rows: PublicPdpSpecRow[] = []
  const seen = new Set<string>()
  const push = (row: PublicPdpSpecRow) => {
    const k = row.name.trim().toLocaleLowerCase('hu')
    if (!k || seen.has(k)) return
    seen.add(k)
    rows.push(row)
  }

  for (const id of keyIds) {
    const a = ctx.attributes.get(id)
    if (a) seen.add(a.name.trim().toLocaleLowerCase('hu'))
  }

  const structured = [...own.keys()]
    .filter((id) => !keyIds.has(id))
    .sort((a, b) => {
      const ia = specOrder.indexOf(a)
      const ib = specOrder.indexOf(b)
      if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
      return (ctx.attributes.get(a)?.sortOrder ?? 100) - (ctx.attributes.get(b)?.sortOrder ?? 100)
    })
  for (const id of structured) {
    const a = ctx.attributes.get(id)
    const v = own.get(id)
    if (!a || !v) continue
    push({ name: a.name, value: v.display, valueNum: v.valueNum, unit: a.unit })
  }

  for (const [k, v] of Object.entries(freeSpecs)) {
    if (!k.trim() || !String(v).trim()) continue
    push({ name: k.trim(), value: String(v).trim(), valueNum: null, unit: null })
  }

  const mm = (cm: number | null) => (cm != null && cm > 0 ? Math.round(cm * 100) / 10 : null)
  const dimRows: [string, number | null, string][] = [
    ['Termék hossz', mm(dims.lengthCm), 'mm'],
    ['Termék szélesség', mm(dims.widthCm), 'mm'],
    ['Termék magasság', mm(dims.heightCm), 'mm']
  ]
  for (const [name, value, unit] of dimRows) {
    if (value != null) {
      push({ name, value: formatSpecNumber(value, unit), valueNum: value, unit })
    }
  }
  if (dims.weightKg != null && dims.weightKg > 0) {
    const grams = dims.weightKg < 1
    const value = grams ? Math.round(dims.weightKg * 1000) : dims.weightKg
    const unit = grams ? 'g' : 'kg'
    push({ name: 'Termék súly', value: formatSpecNumber(value, unit), valueNum: value, unit })
  }

  return rows.slice(0, 24)
}

// ---------------------------------------------------------------------------
// Variáns-tengelyek
// ---------------------------------------------------------------------------

export type PublicPdpVariantAxis = {
  key: string
  name: string
  kind: 'swatch' | 'grid'
}

export type VariantAxisSource = {
  id: string
  webColor: string | null
  webSize: string | null
  /** Kiszerelés (pl. „400 ml”) + rendezési kulcs alap-egységben. */
  pack?: { label: string; sort: number } | null
}

const MAX_AXES = 3

/**
 * Tengely = olyan adat, amiben a család tagjai eltérnek (≥2 különböző érték).
 * Sorrend: szín → sablon kulcsadat → sablon ajánlott → többi. Ha nincs strukturált
 * eltérés, a web_color / web_size mezőkre esik vissza.
 */
export function computeVariantAxes(
  ctx: PdpSpecContext,
  members: VariantAxisSource[],
  /** A csoportnál beállított tengelyek sorrendben (attribútum id / '__pack'). Üres = automatikus. */
  preferred: string[] = []
): {
  axes: PublicPdpVariantAxis[]
  valuesOf: (memberId: string) => Record<string, { label: string; sort: number | null }>
} {
  const distinct = (pick: (m: VariantAxisSource) => string | null) =>
    new Set(
      members
        .map((m) => pick(m)?.trim().toLocaleLowerCase('hu'))
        .filter((v): v is string => Boolean(v))
    ).size

  const tplIndex = new Map(ctx.template.items.map((i, idx) => [i.attributeId, idx]))
  const attrAxes = [...ctx.attributes.values()]
    .filter((a) => distinct((m) => ctx.values.get(m.id)?.get(a.id)?.display ?? null) >= 2)
    .sort((a, b) => {
      const ca = a.code.toLowerCase() === 'color' ? 0 : 1
      const cb = b.code.toLowerCase() === 'color' ? 0 : 1
      if (ca !== cb) return ca - cb
      const ta = tplIndex.get(a.id) ?? 999
      const tb = tplIndex.get(b.id) ?? 999
      if (ta !== tb) return ta - tb
      return a.sortOrder - b.sortOrder
    })

  const axes: PublicPdpVariantAxis[] = []
  const hasColorAttr = attrAxes.some((a) => a.code.toLowerCase() === 'color')
  if (!hasColorAttr && distinct((m) => m.webColor) >= 2) {
    axes.push({ key: '__color', name: 'Szín', kind: 'swatch' })
  }
  for (const a of attrAxes) {
    axes.push({
      key: a.id,
      name: a.name,
      kind: a.code.toLowerCase() === 'color' ? 'swatch' : 'grid'
    })
  }
  if (distinct((m) => m.pack?.label ?? null) >= 2) {
    axes.push({ key: '__pack', name: 'Kiszerelés', kind: 'grid' })
  }
  if (attrAxes.length === 0 && distinct((m) => m.webSize) >= 2) {
    axes.push({ key: '__size', name: 'Méret', kind: 'grid' })
  }

  const byKey = new Map(axes.map((a) => [a.key, a]))
  const chosen = preferred.map((k) => byKey.get(k)).filter((a): a is PublicPdpVariantAxis => a != null)
  const limited = (chosen.length > 0 ? chosen : axes).slice(0, MAX_AXES)
  const byId = new Map(members.map((m) => [m.id, m]))

  return {
    axes: limited,
    valuesOf(memberId) {
      const out: Record<string, { label: string; sort: number | null }> = {}
      const m = byId.get(memberId)
      for (const axis of limited) {
        if (axis.key === '__color') {
          if (m?.webColor?.trim()) out[axis.key] = { label: m.webColor.trim(), sort: null }
        } else if (axis.key === '__pack') {
          if (m?.pack) out[axis.key] = { label: m.pack.label, sort: m.pack.sort }
        } else if (axis.key === '__size') {
          if (m?.webSize?.trim()) {
            const n = Number.parseFloat(m.webSize.replace(',', '.'))
            out[axis.key] = { label: m.webSize.trim(), sort: Number.isFinite(n) ? n : null }
          }
        } else {
          const v = ctx.values.get(memberId)?.get(axis.key)
          if (v) out[axis.key] = { label: v.display, sort: v.sort }
        }
      }
      return out
    }
  }
}
