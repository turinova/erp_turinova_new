import type { SupabaseClient } from '@supabase/supabase-js'

import {
  NEW_MANUFACTURER_PREFIX,
  type AccessoryImportPlan,
  type PlannedWrite
} from '@/lib/accessories/import-plan'
import type { AccessoryImportFailure, AccessoryImportResult } from '@/lib/accessories/import-types'

/** Egy kérés = egy tranzakció; 500 sor bőven a Supabase 8 mp-es utasításkorlátja alatt. */
const CHUNK = 500
const SUB_CHUNK = 50
/** A Vercel 300 mp-es futásideje előtt megállunk, hogy a válasz még kimenjen. */
const TIME_BUDGET_MS = 240_000

type DbError = { code?: string; message: string; details?: string | null }

export function humanizeWriteError(err: DbError): string {
  const text = `${err.message} ${err.details ?? ''}`
  if (err.code === '23505') {
    if (text.includes('barcode_internal')) return 'A belső vonalkód már foglalt (közben valaki használni kezdte?).'
    if (text.includes('barcode')) return 'A vonalkód már foglalt (közben valaki használni kezdte?).'
    if (text.includes('sku')) return 'A SKU már foglalt (közben valaki létrehozta ezt a terméket?).'
    return 'Ütközés egy meglévő termékkel.'
  }
  if (err.code === '23503') return 'A hivatkozott gyártó, adónem vagy egység közben törlődött.'
  if (err.code === '42501') return 'Nincs jogosultságod a mentéshez.'
  if (err.code === '57014') return 'Az adatbázis túl sokáig dolgozott. Töltsd fel újra ugyanezt a fájlt.'
  return `Nem sikerült menteni: ${err.message}`
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function createManufacturers(
  supabase: SupabaseClient,
  tenantId: string,
  list: { key: string; name: string }[]
): Promise<{ ids: Map<string, string>; created: number; failed: Set<string> }> {
  const ids = new Map<string, string>()
  const failed = new Set<string>()
  let created = 0
  for (const m of list) {
    const { data, error } = await supabase
      .from('manufacturers')
      .insert({ tenant_id: tenantId, name: m.name })
      .select('id')
      .single()
    if (!error && data) {
      ids.set(m.key, data.id as string)
      created += 1
      continue
    }
    // Közben valaki létrehozta ugyanezt a nevet: azt használjuk.
    const { data: existing } = await supabase
      .from('manufacturers')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .ilike('name', m.name.replace(/[\\%_]/g, (c) => `\\${c}`))
      .limit(1)
      .maybeSingle()
    if (existing) ids.set(m.key, existing.id as string)
    else {
      console.error('accessories import manufacturer', m.name, error?.message)
      failed.add(m.key)
    }
  }
  return { ids, created, failed }
}

function payloadOf(w: PlannedWrite, tenantId: string, now: string): Record<string, unknown> {
  return {
    ...(w.kind === 'update' ? { id: w.id } : {}),
    tenant_id: tenantId,
    ...w.row,
    updated_at: now
  }
}

async function writeBatch(
  supabase: SupabaseClient,
  kind: 'create' | 'update',
  payload: Record<string, unknown>[]
): Promise<DbError | null> {
  const { error } =
    kind === 'create'
      ? await supabase.from('accessories').insert(payload)
      : await supabase.from('accessories').upsert(payload, { onConflict: 'id' })
  return error
}

/**
 * Csomagokban ír: egy 500-as csomag egyben sikerül vagy egyben visszaáll. Hibánál
 * 50-esekre, majd soronként bont — így csak a ténylegesen hibás sor marad ki.
 */
async function writeAll(
  supabase: SupabaseClient,
  tenantId: string,
  kind: 'create' | 'update',
  writes: PlannedWrite[],
  deadline: number,
  failed: AccessoryImportFailure[]
): Promise<number> {
  const now = new Date().toISOString()
  let saved = 0

  const attempt = async (group: PlannedWrite[], level: 0 | 1 | 2): Promise<void> => {
    if (Date.now() > deadline) {
      for (const w of group) {
        failed.push({
          rowNumber: w.rowNumber,
          message: 'Kifutottunk az időből. Töltsd fel újra ugyanezt a fájlt — a már mentett sorok nem duplázódnak.'
        })
      }
      return
    }
    const error = await writeBatch(supabase, kind, group.map((w) => payloadOf(w, tenantId, now)))
    if (!error) {
      saved += group.length
      return
    }
    if (level === 2 || group.length === 1) {
      console.error('accessories import write', kind, group[0]?.rowNumber, error.message)
      for (const w of group) failed.push({ rowNumber: w.rowNumber, message: humanizeWriteError(error) })
      return
    }
    const size = level === 0 ? SUB_CHUNK : 1
    for (const part of chunks(group, size)) await attempt(part, level === 0 ? 1 : 2)
  }

  for (const group of chunks(writes, CHUNK)) await attempt(group, 0)
  return saved
}

export async function applyAccessoryImport(
  supabase: SupabaseClient,
  tenantId: string,
  plan: AccessoryImportPlan
): Promise<AccessoryImportResult> {
  const deadline = Date.now() + TIME_BUDGET_MS
  const failed: AccessoryImportFailure[] = []

  const mfr = await createManufacturers(supabase, tenantId, plan.manufacturersToCreate)
  const ready: PlannedWrite[] = []
  for (const w of plan.writes) {
    const mId = w.row.manufacturer_id
    if (!mId.startsWith(NEW_MANUFACTURER_PREFIX)) {
      ready.push(w)
      continue
    }
    const key = mId.slice(NEW_MANUFACTURER_PREFIX.length)
    const id = mfr.ids.get(key)
    if (id) ready.push({ ...w, row: { ...w.row, manufacturer_id: id } })
    else failed.push({ rowNumber: w.rowNumber, message: 'Az új gyártót nem sikerült létrehozni.' })
  }

  const creates = ready.filter((w) => w.kind === 'create')
  const updates = ready.filter((w) => w.kind === 'update')
  const created = await writeAll(supabase, tenantId, 'create', creates, deadline, failed)
  const updated = await writeAll(supabase, tenantId, 'update', updates, deadline, failed)

  const problemRows = new Set([...plan.problems.keys(), ...failed.map((f) => f.rowNumber)])
  return {
    created,
    updated,
    unchanged: plan.preview.stats.unchanged,
    skipped: plan.preview.stats.error,
    failed: failed.sort((a, b) => a.rowNumber - b.rowNumber),
    createdManufacturers: mfr.created,
    problemCount: problemRows.size
  }
}
