'use server'

import { revalidatePath } from 'next/cache'

import { mediaFilenameStem, TENANT_MEDIA_BUCKET } from '@/lib/media/types'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

const LINK_MAX_ROWS = 50000
const LINK_CONCURRENCY = 10

export type LinkProductsResult = {
  ok: boolean
  message: string
  linked?: number
  skippedHasImage?: number
  unmatched?: number
  ambiguousSheets?: number
}

type MediaLite = {
  id: string
  original_filename: string
  public_url: string
}

export async function linkMediaToProducts(options?: {
  overwrite?: boolean
}): Promise<LinkProductsResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const overwrite = options?.overwrite === true
  const { supabase, user } = ctx
  const tenantId = user.tenantId!

  const { data: mediaRows, error: mediaErr } = await fetchAllPages<MediaLite>(
    (from, to) =>
      supabase
        .from('media_files')
        .select('id, original_filename, public_url')
        .eq('tenant_id', tenantId)
        .like('mime_type', 'image/%')
        .order('id', { ascending: true })
        .range(from, to),
    LINK_MAX_ROWS
  )

  if (mediaErr) {
    return { ok: false, message: 'Nem sikerült betölteni a médiát.' }
  }

  const byStem = new Map<string, MediaLite[]>()
  for (const row of mediaRows) {
    const key = mediaFilenameStem(row.original_filename)
    if (!key) continue
    const list = byStem.get(key) ?? []
    list.push(row)
    byStem.set(key, list)
  }

  let linked = 0
  let skippedHasImage = 0
  let unmatched = 0
  let ambiguousSheets = 0

  const { data: accessories, error: accErr } = await fetchAllPages<{
    id: string
    sku: string
    barcode: string | null
    barcode_internal: string | null
    image_url: string | null
  }>(
    (from, to) =>
      supabase
        .from('accessories')
        .select('id, sku, barcode, barcode_internal, image_url')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .range(from, to),
    LINK_MAX_ROWS
  )

  if (accErr) {
    return { ok: false, message: 'Nem sikerült betölteni a termékeket.' }
  }

  const accessoryUpdates: { id: string; url: string }[] = []
  for (const acc of accessories) {
    const candidates = [acc.sku, acc.barcode, acc.barcode_internal]
      .map((v) => (v ? String(v).trim().toLowerCase() : ''))
      .filter(Boolean)

    let media: MediaLite | null = null
    for (const c of candidates) {
      const hits = byStem.get(c)
      if (hits && hits.length === 1) {
        media = hits[0]
        break
      }
    }
    if (!media) {
      unmatched += 1
      continue
    }
    if (acc.image_url && !overwrite) {
      skippedHasImage += 1
      continue
    }
    if (acc.image_url === media.public_url) continue
    accessoryUpdates.push({ id: acc.id, url: media.public_url })
  }

  // Több ezer terméknél egyesével túl lassú lenne: 10 párhuzamos frissítés.
  const now = new Date().toISOString()
  for (let i = 0; i < accessoryUpdates.length; i += LINK_CONCURRENCY) {
    const results = await Promise.all(
      accessoryUpdates.slice(i, i + LINK_CONCURRENCY).map((u) =>
        supabase
          .from('accessories')
          .update({ image_url: u.url, updated_at: now })
          .eq('id', u.id)
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
      )
    )
    linked += results.filter((r) => !r.error).length
  }

  const { data: sheets, error: sheetErr } = await supabase
    .from('sheet_materials')
    .select('id, machine_code, image_url')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('machine_code', 'is', null)

  if (sheetErr) {
    return { ok: false, message: 'Nem sikerült betölteni a táblás anyagokat.' }
  }

  const codeCounts = new Map<string, number>()
  for (const s of sheets ?? []) {
    const code = (s.machine_code ?? '').trim().toLowerCase()
    if (!code) continue
    codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1)
  }

  for (const s of sheets ?? []) {
    const code = (s.machine_code ?? '').trim().toLowerCase()
    if (!code) continue
    if ((codeCounts.get(code) ?? 0) !== 1) {
      ambiguousSheets += 1
      continue
    }
    const hits = byStem.get(code)
    if (!hits || hits.length !== 1) {
      unmatched += 1
      continue
    }
    const media = hits[0]
    if (s.image_url && !overwrite) {
      skippedHasImage += 1
      continue
    }
    if (s.image_url === media.public_url) continue

    const { error } = await supabase
      .from('sheet_materials')
      .update({
        image_url: media.public_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', s.id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)

    if (!error) linked += 1
  }

  revalidatePath('/torzsadatok/rendszer/media')
  revalidatePath('/torzsadatok/alapanyagok/termekek')
  revalidatePath('/torzsadatok/alapanyagok/tablas-anyagok')

  return {
    ok: true,
    message: `Összekapcsolva: ${linked}. Már volt kép: ${skippedHasImage}. Nincs egyezés: ${unmatched}. Több táblás ugyanazzal a gépi kóddal (kihagyva): ${ambiguousSheets}.`,
    linked,
    skippedHasImage,
    unmatched,
    ambiguousSheets
  }
}

export async function deleteMediaFile(
  id: string
): Promise<{ ok: boolean; message: string }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { supabase, user } = ctx
  const tenantId = user.tenantId!

  const { data: row, error: loadErr } = await supabase
    .from('media_files')
    .select('id, storage_path')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (loadErr || !row) {
    return { ok: false, message: 'A fájl nem található.' }
  }

  await supabase.storage.from(TENANT_MEDIA_BUCKET).remove([row.storage_path])

  const { error: delErr } = await supabase
    .from('media_files')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (delErr) {
    return { ok: false, message: 'Nem sikerült törölni a fájlt.' }
  }

  revalidatePath('/torzsadatok/rendszer/media')
  return { ok: true, message: 'Fájl törölve.' }
}
