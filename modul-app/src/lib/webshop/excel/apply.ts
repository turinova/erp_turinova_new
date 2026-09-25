import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import { revalidateStorefrontTenant } from '@/lib/storefront/revalidate'
import { enrichWebProductFields } from '@/lib/webshop/enrich'
import { resolveGoogleTaxonomyId } from '@/lib/webshop/google-taxonomy'
import { getTenantWebshopSettings } from '@/lib/webshop/settings'

import { foldKey, loadShopXContext, type ShopXContext } from '@/lib/webshop/excel/context'
import {
  buildShopImportPlan,
  PLACEHOLDER,
  webRowOf,
  type ShopXAttributeCreate,
  type ShopXCatalogOp,
  type ShopXCreation,
  type ShopXMappingWrite,
  type ShopXPlan,
  type ShopXWrite
} from '@/lib/webshop/excel/plan'
import type { ShopXWorkbook } from '@/lib/webshop/excel/read'
import { backupPathFor, IMPORT_BUCKET } from '@/lib/webshop/excel/source'
import type {
  ShopXDecisions,
  ShopXProblem,
  ShopXRunSummary,
  ShopXSource,
  ShopXStepResult
} from '@/lib/webshop/excel/types'
import { buildShopWorkbook } from '@/lib/webshop/excel/write'

/** Egy RPC hívás ennyi terméket ír (a 8 s-os statement timeout alatt marad). */
const RPC_CHUNK = 100
/** Egy lépés legfeljebb ennyi terméket dolgoz fel, és legfeljebb ennyi ideig fut. */
const STEP_MAX_ITEMS = 3000
const STEP_BUDGET_MS = 200_000
const LOCK_MINUTES = 10
const INSERT_CHUNK = 500

export const BULK_NOT_READY =
  'A tömeges mentéshez egy adatbázis frissítés kell (20260549). Szólj a rendszergazdának.'

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export async function planShopImport(
  supabase: SupabaseClient,
  tenantId: string,
  wb: ShopXWorkbook,
  decisions: ShopXDecisions,
  ctx?: ShopXContext
): Promise<{ plan: ShopXPlan; ctx: ShopXContext }> {
  const context = ctx ?? (await loadShopXContext(supabase, tenantId))
  return { plan: buildShopImportPlan(context, wb, decisions), ctx: context }
}

// ---------------------------------------------------------------------------
// Katalógus: jellemzők, értékek, kategóriák, sablonok, csoportok, párosítások
// ---------------------------------------------------------------------------

type CatalogResult = { attributes: number; values: number; categories: number; failed: string[] }

function attributeCode(name: string, taken: Set<string>): string {
  const base =
    foldKey(name)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'jellemzo'
  let code = base
  for (let i = 2; taken.has(code); i++) code = `${base}_${i}`
  taken.add(code)
  return code
}

async function applyCatalog(
  supabase: SupabaseClient,
  tenantId: string,
  ctx: ShopXContext,
  creations: ShopXCreation[],
  ops: ShopXCatalogOp[],
  mappings: ShopXMappingWrite[]
): Promise<CatalogResult> {
  const failed: string[] = []
  const idMap = new Map<string, string>()
  const resolve = (id: string) => (id.startsWith(PLACEHOLDER) ? (idMap.get(id) ?? null) : id)
  let attributes = 0
  let values = 0
  let categories = 0

  // 1) Új jellemzők
  const newAttrs = creations.filter((c): c is ShopXAttributeCreate => c.kind === 'attribute')
  if (newAttrs.length > 0) {
    const taken = new Set(ctx.attributes.map((a) => a.code.toLowerCase()))
    const rows = newAttrs.map((a) => ({
      tenant_id: tenantId,
      name: a.name,
      code: attributeCode(a.name, taken),
      value_type: a.valueType,
      unit: a.valueType === 'list' || a.valueType === 'boolean' ? null : a.unit,
      allow_multiple: a.valueType === 'list' && a.allowMultiple,
      is_variant_axis: a.isVariantAxis,
      active: a.active,
      sort_order: 100
    }))
    const { data, error } = await supabase.from('product_attributes').insert(rows).select('id, name')
    if (error || !data) {
      console.error('shop import create attributes', error?.message)
      failed.push(`Nem sikerült létrehozni a jellemzőket (${newAttrs.map((a) => a.name).join(', ')}).`)
    } else {
      attributes = data.length
      const byName = new Map(data.map((d) => [foldKey(String(d.name)), d.id as string]))
      for (const a of newAttrs) {
        const id = byName.get(foldKey(a.name))
        if (id) idMap.set(`${PLACEHOLDER}${a.key}`, id)
      }
    }
  }

  // 2) Jellemző módosítások
  for (const op of ops) {
    if (op.kind !== 'attributeUpdate') continue
    const { error } = await supabase
      .from('product_attributes')
      .update({ ...op.patch, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', op.attributeId)
    if (error) {
      console.error('shop import update attribute', error.message)
      failed.push(`Nem sikerült módosítani: ${op.name}`)
    }
  }

  // 3) Új értékek
  const newValues = creations.filter((c): c is Extract<ShopXCreation, { kind: 'value' }> => c.kind === 'value')
  const valueRows = newValues
    .map((v) => ({ attribute_id: resolve(v.attributeId), label: v.label }))
    .filter((v): v is { attribute_id: string; label: string } => Boolean(v.attribute_id))
    .map((v) => ({ tenant_id: tenantId, ...v, sort_order: 100 }))
  for (const part of chunks(valueRows, INSERT_CHUNK)) {
    const { error } = await supabase.from('attribute_values').insert(part)
    if (!error) {
      values += part.length
      continue
    }
    for (const row of part) {
      const { error: one } = await supabase.from('attribute_values').insert(row)
      if (one && !one.message.includes('duplicate')) {
        console.error('shop import create value', one.message)
        failed.push(`Nem sikerült létrehozni az értéket: ${row.label}`)
      } else if (!one) values++
    }
  }

  // 4) Új kategóriák szintenként
  type Node = { id: string; tax: string | null }
  const known = new Map<string, Node>(ctx.categories.map((c) => [foldKey(c.path), { id: c.id, tax: c.googleTaxonomyId }]))
  const newCats = creations.filter((c): c is Extract<ShopXCreation, { kind: 'category' }> => c.kind === 'category')
  const maxDepth = Math.max(0, ...newCats.map((c) => c.parts.length))
  for (let depth = 1; depth <= maxDepth; depth++) {
    const level = new Map<string, { name: string; parentKey: string | null }>()
    for (const c of newCats) {
      if (c.parts.length < depth) continue
      const prefix = c.parts.slice(0, depth).map(foldKey).join(' > ')
      if (known.has(prefix) || level.has(prefix)) continue
      level.set(prefix, {
        name: c.parts[depth - 1].slice(0, 120),
        parentKey: depth > 1 ? c.parts.slice(0, depth - 1).map(foldKey).join(' > ') : null
      })
    }
    const entries = [...level].filter(([, n]) => n.parentKey == null || known.has(n.parentKey))
    for (const part of chunks(entries, INSERT_CHUNK)) {
      const rows = part.map(([, n]) => {
        const parent = n.parentKey ? known.get(n.parentKey)! : null
        return {
          tenant_id: tenantId,
          name: n.name,
          parent_id: parent?.id ?? null,
          google_taxonomy_id: resolveGoogleTaxonomyId({ categoryName: n.name, parentTaxonomyId: parent?.tax ?? null }),
          sort_order: 100,
          active: true
        }
      })
      const { data, error } = await supabase.from('web_categories').insert(rows).select('id, name, parent_id, google_taxonomy_id')
      if (error || !data) {
        console.error('shop import create categories', error?.message)
        failed.push(`Nem sikerült létrehozni ${part.length} kategóriát (pl. ${part[0][1].name}).`)
        continue
      }
      categories += data.length
      for (const [prefix, n] of part) {
        const parentId = n.parentKey ? known.get(n.parentKey)!.id : null
        const hit = data.find((d) => foldKey(String(d.name)) === foldKey(n.name) && (d.parent_id ?? null) === parentId)
        if (hit) known.set(prefix, { id: hit.id as string, tax: (hit.google_taxonomy_id as string | null) ?? null })
      }
    }
  }
  for (const c of newCats) {
    const node = known.get(c.parts.map(foldKey).join(' > '))
    if (node) idMap.set(`${PLACEHOLDER}${c.key}`, node.id)
  }

  // 5) Kategória módosítások + jellemző-sablon
  for (const op of ops) {
    if (op.kind !== 'categoryUpdate') continue
    const id = resolve(op.categoryId)
    if (!id) continue
    if (Object.keys(op.patch).length > 0) {
      const { error } = await supabase
        .from('web_categories')
        .update({ ...op.patch, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('id', id)
      if (error) {
        console.error('shop import update category', error.message)
        failed.push(`Nem sikerült módosítani a kategóriát: ${op.path}`)
      }
    }
    for (const [role, list] of [
      ['key', op.keyAttrs],
      ['spec', op.specAttrs]
    ] as const) {
      if (list === undefined) continue
      const ids = list.map(resolve).filter((x): x is string => Boolean(x))
      const { error: delError } = await supabase
        .from('web_category_attributes')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('category_id', id)
        .eq('role', role)
      const { error: insError } =
        ids.length > 0
          ? await supabase.from('web_category_attributes').upsert(
              ids.map((attribute_id, i) => ({
                tenant_id: tenantId,
                category_id: id,
                attribute_id,
                role,
                sort_order: (i + 1) * 10
              })),
              { onConflict: 'category_id,attribute_id' }
            )
          : { error: null }
      if (delError || insError) {
        console.error('shop import category template', delError?.message ?? insError?.message)
        failed.push(`Nem sikerült menteni a kategória jellemzőit: ${op.path}`)
      }
    }
  }

  // 6) Változatcsoportok
  for (const op of ops) {
    if (op.kind !== 'group') continue
    const existing = ctx.groups.get(foldKey(op.code))
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (op.name !== undefined) patch.name = op.name
    if (op.mainAccessoryId !== undefined) patch.main_accessory_id = op.mainAccessoryId
    if (op.axes !== undefined) patch.axes = op.axes.map(resolve).filter(Boolean)
    const { error } = existing
      ? await supabase.from('web_variant_groups').update(patch).eq('tenant_id', tenantId).eq('id', existing.id)
      : await supabase.from('web_variant_groups').insert({ tenant_id: tenantId, code: op.code, ...patch })
    if (error) {
      console.error('shop import variant group', error.message)
      failed.push(`Nem sikerült menteni a változatcsoportot: ${op.code}`)
    }
  }

  // 7) Megjegyzett párosítások
  if (mappings.length > 0) {
    const now = new Date().toISOString()
    for (const part of chunks(mappings, INSERT_CHUNK)) {
      const { error } = await supabase.from('webshop_import_mappings').upsert(
        part.map((m) => ({
          tenant_id: tenantId,
          kind: m.kind,
          source_key: m.sourceKey.slice(0, 400),
          target_id: m.targetId,
          updated_at: now
        })),
        { onConflict: 'tenant_id,kind,source_key' }
      )
      if (error) console.error('shop import mappings', error.message)
    }
  }

  return { attributes, values, categories, failed }
}

// ---------------------------------------------------------------------------
// Futás: előkészítés → lépések → zárás
// ---------------------------------------------------------------------------

type RunStats = {
  total: number
  done: number
  updated: number
  wentLive: number
  wentOff: number
  failed: number
  createdCategories: number
  createdAttributes: number
  createdValues: number
  notices: string[]
}

const emptyStats = (total: number): RunStats => ({
  total,
  done: 0,
  updated: 0,
  wentLive: 0,
  wentOff: 0,
  failed: 0,
  createdCategories: 0,
  createdAttributes: 0,
  createdValues: 0,
  notices: []
})

async function activeRun(supabase: SupabaseClient, tenantId: string): Promise<{ id: string; file_name: string } | null> {
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString()
  const { data } = await supabase
    .from('webshop_import_runs')
    .select('id, file_name')
    .eq('tenant_id', tenantId)
    .eq('status', 'running')
    .gt('updated_at', since)
    .limit(1)
  return (data?.[0] as { id: string; file_name: string } | undefined) ?? null
}

export type PrepareResult =
  | { ok: true; runId: string; total: number; notices: string[]; createdCategories: number; createdAttributes: number; createdValues: number }
  | { ok: false; message: string }

/**
 * Első lépés: katalógus (jellemzők, kategóriák, csoportok) létrehozása, mentés előtti állapot
 * elmentése a visszavonáshoz, futás rekord (zár). A termékeket a lépések írják.
 */
export async function prepareShopImport(
  supabase: SupabaseClient,
  tenantId: string,
  wb: ShopXWorkbook,
  decisions: ShopXDecisions,
  source: ShopXSource,
  opts: { restoresRunId?: string | null } = {}
): Promise<PrepareResult> {
  const { plan, ctx } = await planShopImport(supabase, tenantId, wb, decisions)
  if (!ctx.bulkReady) return { ok: false, message: BULK_NOT_READY }
  const running = await activeRun(supabase, tenantId)
  if (running) {
    return {
      ok: false,
      message: `Már fut egy mentés („${running.file_name}”). Várd meg, amíg végez — vagy próbáld újra ${LOCK_MINUTES} perc múlva.`
    }
  }
  if (plan.writes.length === 0 && plan.creations.length === 0 && plan.catalogOps.length === 0) {
    return { ok: false, message: 'Nincs mit menteni: a fájl szerint minden naprakész.' }
  }

  const runId = crypto.randomUUID()
  const restore = Boolean(opts.restoresRunId)
  let backupPath: string | null = null
  if (!restore && plan.writes.length > 0) {
    const ids = new Set<string>()
    for (const w of plan.writes) {
      ids.add(w.accessoryId)
      for (const id of [...w.altAdd, ...w.altRemove]) ids.add(id)
    }
    const products = [...ids].map((id) => ctx.byId.get(id)).filter((p) => p != null)
    const buffer = await buildShopWorkbook(ctx, products, 'snapshot')
    backupPath = backupPathFor(tenantId, runId)
    const { error } = await supabase.storage.from(IMPORT_BUCKET).upload(backupPath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true
    })
    if (error) {
      console.error('shop import backup upload', error.message)
      return { ok: false, message: 'Nem sikerült elmenteni a mostani állapotot, ezért nem kezdtük el. Próbáld újra.' }
    }
  }

  const stats = emptyStats(plan.order.length)
  const { error: runError } = await supabase.from('webshop_import_runs').insert({
    id: runId,
    tenant_id: tenantId,
    file_name: source.name.slice(0, 200),
    source_path: source.kind === 'storage' ? source.path : null,
    backup_path: backupPath,
    kind: restore ? 'restore' : 'import',
    status: 'running',
    stats,
    restores_run_id: opts.restoresRunId ?? null
  })
  if (runError) {
    console.error('shop import run insert', runError.message)
    return { ok: false, message: 'Nem sikerült elindítani a mentést. Próbáld újra.' }
  }

  const catalog = await applyCatalog(supabase, tenantId, ctx, plan.creations, plan.catalogOps, plan.mappings)
  stats.createdAttributes = catalog.attributes
  stats.createdCategories = catalog.categories
  stats.createdValues = catalog.values
  stats.notices = catalog.failed
  await supabase.from('webshop_import_runs').update({ stats, updated_at: new Date().toISOString() }).eq('id', runId)
  if (catalog.categories > 0) revalidatePath('/webshop/kategoriak')
  if (catalog.attributes > 0 || catalog.values > 0) revalidatePath('/webshop/tulajdonsagok')

  return {
    ok: true,
    runId,
    total: plan.order.length,
    notices: catalog.failed,
    createdAttributes: catalog.attributes,
    createdCategories: catalog.categories,
    createdValues: catalog.values
  }
}

function hasPlaceholder(w: ShopXWrite): boolean {
  return (
    Boolean(w.values.webCategoryId?.startsWith(PLACEHOLDER)) ||
    w.values.attributeValueIds.some((id) => id.startsWith(PLACEHOLDER)) ||
    w.values.attributeInputs.some((i) => i.attributeId.startsWith(PLACEHOLDER)) ||
    w.touchedAttributes.some((id) => id.startsWith(PLACEHOLDER))
  )
}

function rpcItem(ctx: ShopXContext, w: ShopXWrite): Record<string, unknown> {
  const item: Record<string, unknown> = { accessory_id: w.accessoryId }
  if (w.webChanged) item.web = webRowOf(w.values)
  if (w.touchedAttributes.length > 0) {
    const listAttrs = w.touchedAttributes.filter((id) => ctx.attributeById.get(id)?.valueType === 'list')
    const inputAttrs = w.touchedAttributes.filter((id) => {
      const t = ctx.attributeById.get(id)?.valueType
      return t != null && t !== 'list'
    })
    if (listAttrs.length > 0) {
      const own = new Set(listAttrs)
      item.attr_list = listAttrs
      item.value_ids = w.values.attributeValueIds.filter((id) => own.has(ctx.valueOwner.get(id)?.id ?? ''))
    }
    if (inputAttrs.length > 0) {
      const own = new Set(inputAttrs)
      item.attr_input = inputAttrs
      item.inputs = w.values.attributeInputs
        .filter((i) => own.has(i.attributeId))
        .map((i) => ({ attribute_id: i.attributeId, value_num: i.valueNum, value_max: i.valueMax, value_bool: i.valueBool }))
    }
  }
  if (w.related) {
    item.related_kinds = w.related.kinds
    item.related = w.related.list.map((r) => ({ related_id: r.relatedId, kind: r.kind, sort_order: r.sortOrder }))
  }
  if (w.altAdd.length > 0) item.alt_reverse_add = w.altAdd
  if (w.altRemove.length > 0) item.alt_reverse_remove = w.altRemove
  if (w.documents) {
    item.documents = w.documents.map((d) => ({
      media_id: d.mediaId,
      kind: d.kind,
      title: d.title,
      language: d.language,
      sort_order: d.sortOrder
    }))
  }
  return item
}

function problemFor(plan: ShopXPlan, accessoryId: string, message: string): ShopXProblem | null {
  const item = plan.items.find((i) => i.accessoryId === accessoryId)
  const ref = item?.rows.find((r) => r.sheet === 'products') ?? item?.rows[0]
  return ref ? { sheet: ref.sheet, rowNumber: ref.rowNumber, messages: [message] } : null
}

export type StepInput = {
  runId: string
  cursor: number
  wb: ShopXWorkbook
  decisions: ShopXDecisions
}

/**
 * Egy lépés: újratervez (a már mentett termékek így „nem változik”-ká válnak), majd a
 * `order[cursor…]` szeletet írja kötegenként egy tranzakcióban. Megszakítás után ugyanonnan folytatható.
 */
export async function stepShopImport(
  supabase: SupabaseClient,
  tenantId: string,
  input: StepInput
): Promise<{ ok: true; result: ShopXStepResult } | { ok: false; message: string }> {
  const started = Date.now()
  const { data: run, error: runError } = await supabase
    .from('webshop_import_runs')
    .select('id, status, stats, kind, restores_run_id')
    .eq('tenant_id', tenantId)
    .eq('id', input.runId)
    .maybeSingle()
  if (runError || !run) return { ok: false, message: 'Ez a mentés nem található. Kezdd újra a feltöltést.' }
  if (run.status !== 'running') return { ok: false, message: 'Ez a mentés már lezárult.' }
  const stats: RunStats = { ...emptyStats(0), ...(run.stats as Partial<RunStats>) }

  const { plan, ctx } = await planShopImport(supabase, tenantId, input.wb, input.decisions)
  const writeById = new Map(plan.writes.map((w) => [w.accessoryId, w]))
  const total = plan.order.length
  const shipping = await getTenantWebshopSettings(supabase, tenantId)
  const problems: ShopXProblem[] = []
  const notices: string[] = []
  const slugs: (string | null)[] = []
  let cursor = Math.max(0, Math.min(input.cursor, total))
  let updated = 0
  let wentLive = 0
  let wentOff = 0
  let failed = 0

  while (cursor < total && cursor - input.cursor < STEP_MAX_ITEMS && Date.now() - started < STEP_BUDGET_MS) {
    const sliceIds = plan.order.slice(cursor, cursor + RPC_CHUNK)
    const batch: ShopXWrite[] = []
    for (const id of sliceIds) {
      const w = writeById.get(id)
      if (!w) continue
      if (hasPlaceholder(w)) {
        failed++
        const p = problemFor(plan, id, 'Nem mentettük: a hozzá kért új kategória / jellemző nem jött létre. Töltsd fel újra.')
        if (p) problems.push(p)
        continue
      }
      if (w.values.sellableWeb) {
        const enriched = { ...w.values, ...enrichWebProductFields(w.values, { productName: w.name, sku: w.sku, shippingDefaults: shipping }) }
        if (JSON.stringify(webRowOf(enriched)) !== JSON.stringify(webRowOf(w.values))) w.webChanged = true
        w.values = enriched
      }
      batch.push(w)
    }
    const ok: ShopXWrite[] = []
    if (batch.length > 0) {
      const { error } = await supabase.rpc('webshop_import_apply', {
        p_tenant: tenantId,
        p_items: batch.map((w) => rpcItem(ctx, w))
      })
      if (!error) ok.push(...batch)
      else {
        console.error('shop import rpc chunk', error.message)
        if (error.message.includes('webshop_import_apply') && error.message.includes('does not exist')) {
          return { ok: false, message: BULK_NOT_READY }
        }
        for (const w of batch) {
          const { error: one } = await supabase.rpc('webshop_import_apply', { p_tenant: tenantId, p_items: [rpcItem(ctx, w)] })
          if (!one) {
            ok.push(w)
            continue
          }
          console.error('shop import rpc item', w.sku, one.message)
          failed++
          const reason = one.message.includes('web_slug')
            ? 'a webcím közben foglalt lett'
            : one.message.includes('check constraint')
              ? 'egy érték nem felel meg a szabályoknak'
              : 'adatbázis hiba'
          const p = problemFor(plan, w.accessoryId, `Nem sikerült menteni (${reason}). Töltsd fel újra ezt a sort.`)
          if (p) problems.push(p)
        }
      }
    }
    for (const w of ok) {
      updated++
      if (!w.wasLive && w.values.sellableWeb) wentLive++
      if (w.wasLive && !w.values.sellableWeb) wentOff++
      if (w.wasLive || w.values.sellableWeb) slugs.push(w.values.webSlug, w.previousSlug)
    }
    cursor += sliceIds.length
  }

  stats.total = total
  stats.done = cursor
  stats.updated += updated
  stats.wentLive += wentLive
  stats.wentOff += wentOff
  stats.failed += failed
  const finished = cursor >= total
  const now = new Date().toISOString()
  await supabase
    .from('webshop_import_runs')
    .update({ stats, updated_at: now, ...(finished ? { status: 'done', finished_at: now } : {}) })
    .eq('id', input.runId)
  if (finished && run.kind === 'restore' && run.restores_run_id) {
    await supabase
      .from('webshop_import_runs')
      .update({ status: 'undone', updated_at: now })
      .eq('tenant_id', tenantId)
      .eq('id', run.restores_run_id)
  }

  if (updated > 0) {
    revalidatePath('/webshop')
    revalidatePath('/webshop/katalogus')
    revalidatePath('/webshop/katalogus/[id]', 'page')
    revalidatePath('/torzsadatok/alapanyagok/termekek')
    revalidatePath('/torzsadatok/alapanyagok/termekek/[id]', 'page')
    await revalidateStorefrontTenant(tenantId, { productSlugs: slugs.slice(0, 400) })
  }

  return {
    ok: true,
    result: {
      runId: input.runId,
      next: finished ? null : cursor,
      total,
      done: cursor,
      updated,
      wentLive,
      wentOff,
      failed,
      problems,
      notices
    }
  }
}

/** Futás megszakítása (pl. a felhasználó bezárta): a zár feloldása, a már mentett rész marad. */
export async function failShopImport(supabase: SupabaseClient, tenantId: string, runId: string): Promise<void> {
  await supabase
    .from('webshop_import_runs')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', runId)
    .eq('status', 'running')
}

export async function listShopImportRuns(supabase: SupabaseClient, tenantId: string): Promise<ShopXRunSummary[]> {
  const { data, error } = await supabase
    .from('webshop_import_runs')
    .select('id, file_name, kind, status, created_at, backup_path, stats')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(8)
  if (error) return []
  return (data ?? []).map((r) => ({
    id: r.id as string,
    fileName: String(r.file_name ?? ''),
    kind: r.kind === 'restore' ? 'restore' : 'import',
    status: r.status as ShopXRunSummary['status'],
    createdAt: String(r.created_at ?? ''),
    updated: Number((r.stats as Partial<RunStats> | null)?.updated ?? 0),
    canUndo: r.kind === 'import' && (r.status === 'done' || r.status === 'failed') && Boolean(r.backup_path)
  }))
}

/** Visszavonás forrása: a futás mentés előtti állapota (pillanatkép). */
export async function undoSourceFor(
  supabase: SupabaseClient,
  tenantId: string,
  runId: string
): Promise<{ ok: true; source: Extract<ShopXSource, { kind: 'storage' }> } | { ok: false; message: string }> {
  const { data } = await supabase
    .from('webshop_import_runs')
    .select('id, kind, status, backup_path, file_name')
    .eq('tenant_id', tenantId)
    .eq('id', runId)
    .maybeSingle()
  if (!data) return { ok: false, message: 'Ez a mentés nem található.' }
  if (data.kind !== 'import' || !data.backup_path) return { ok: false, message: 'Ez a mentés nem vonható vissza.' }
  if (data.status === 'undone') return { ok: false, message: 'Ezt a mentést már visszavontad.' }
  if (data.status === 'running') return { ok: false, message: 'Ez a mentés még fut — várd meg a végét.' }
  return {
    ok: true,
    source: { kind: 'storage', path: String(data.backup_path), name: `Visszavonás: ${String(data.file_name ?? '')}`.slice(0, 200) }
  }
}
