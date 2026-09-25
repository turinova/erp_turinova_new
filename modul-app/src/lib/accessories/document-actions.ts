'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import {
  DOCUMENT_KINDS,
  DOCUMENT_TITLE_MAX,
  MAX_DOCUMENTS_PER_PRODUCT,
  type DocumentKind
} from '@/lib/accessories/document-kinds'
import { revalidateStorefrontTenant } from '@/lib/storefront/revalidate'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type AccessoryDocument = {
  id: string
  mediaId: string
  kind: DocumentKind
  title: string
  language: string
  url: string
  filename: string
  sizeBytes: number
}

export type DocumentActionResult =
  | { ok: true; items: AccessoryDocument[] }
  | { ok: false; message: string }

const uuid = z.string().uuid()

const patchSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS).optional(),
  title: z
    .string()
    .trim()
    .min(1, 'A cím nem lehet üres.')
    .max(DOCUMENT_TITLE_MAX, `A cím legfeljebb ${DOCUMENT_TITLE_MAX} karakter.`)
    .optional(),
  language: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2}$/, 'Érvénytelen nyelvkód.')
    .optional()
})

async function listDocuments(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<AccessoryDocument[]> {
  const { data } = await supabase
    .from('accessory_documents')
    .select(
      'id, media_id, kind, title, language, sort_order, media_files ( public_url, original_filename, size_bytes )'
    )
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(MAX_DOCUMENTS_PER_PRODUCT)
  const out: AccessoryDocument[] = []
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const m = (Array.isArray(r.media_files) ? r.media_files[0] : r.media_files) as
      | Record<string, unknown>
      | null
    if (!m) continue
    out.push({
      id: String(r.id),
      mediaId: String(r.media_id),
      kind: r.kind as DocumentKind,
      title: String(r.title ?? ''),
      language: String(r.language ?? 'hu'),
      url: String(m.public_url),
      filename: String(m.original_filename),
      sizeBytes: Number(m.size_bytes ?? 0)
    })
  }
  return out
}

async function ownsAccessory(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('accessories')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', accessoryId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

export async function getAccessoryDocuments(accessoryId: string): Promise<DocumentActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!uuid.safeParse(accessoryId).success) return { ok: false, message: 'Érvénytelen termék.' }
  return { ok: true, items: await listDocuments(ctx.supabase, ctx.user.tenantId!, accessoryId) }
}

export async function attachAccessoryDocument(
  accessoryId: string,
  mediaId: string
): Promise<DocumentActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!uuid.safeParse(accessoryId).success || !uuid.safeParse(mediaId).success) {
    return { ok: false, message: 'Érvénytelen adat.' }
  }
  const tenantId = ctx.user.tenantId!
  if (!(await ownsAccessory(ctx.supabase, tenantId, accessoryId))) {
    return { ok: false, message: 'A termék nem található.' }
  }
  const { data: media } = await ctx.supabase
    .from('media_files')
    .select('id, original_filename, mime_type')
    .eq('tenant_id', tenantId)
    .eq('id', mediaId)
    .maybeSingle()
  if (!media) return { ok: false, message: 'A fájl nem található a médiában.' }
  if (media.mime_type !== 'application/pdf') {
    return { ok: false, message: 'Dokumentumként csak PDF csatolható.' }
  }

  const current = await listDocuments(ctx.supabase, tenantId, accessoryId)
  if (current.some((d) => d.mediaId === mediaId)) {
    return { ok: false, message: 'Ez a dokumentum már csatolva van.' }
  }
  if (current.length >= MAX_DOCUMENTS_PER_PRODUCT) {
    return {
      ok: false,
      message: `Legfeljebb ${MAX_DOCUMENTS_PER_PRODUCT} dokumentum csatolható egy termékhez.`
    }
  }

  const title = String(media.original_filename)
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .slice(0, DOCUMENT_TITLE_MAX)
  const { error } = await ctx.supabase.from('accessory_documents').insert({
    tenant_id: tenantId,
    accessory_id: accessoryId,
    media_id: mediaId,
    kind: 'manual',
    title: title || 'Dokumentum',
    language: 'hu',
    sort_order: current.length
  })
  if (error) return { ok: false, message: 'Nem sikerült csatolni.' }

  await revalidateStorefrontTenant(tenantId)
  return { ok: true, items: await listDocuments(ctx.supabase, tenantId, accessoryId) }
}

export async function updateAccessoryDocument(
  accessoryId: string,
  documentId: string,
  patch: { kind?: DocumentKind; title?: string; language?: string }
): Promise<DocumentActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!uuid.safeParse(accessoryId).success || !uuid.safeParse(documentId).success) {
    return { ok: false, message: 'Érvénytelen adat.' }
  }
  const parsed = patchSchema.safeParse(patch)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Érvénytelen adat.' }
  }
  if (Object.keys(parsed.data).length === 0) return getAccessoryDocuments(accessoryId)
  const tenantId = ctx.user.tenantId!
  const { error } = await ctx.supabase
    .from('accessory_documents')
    .update(parsed.data)
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
    .eq('id', documentId)
  if (error) return { ok: false, message: 'Nem sikerült menteni.' }
  await revalidateStorefrontTenant(tenantId)
  return { ok: true, items: await listDocuments(ctx.supabase, tenantId, accessoryId) }
}

export async function removeAccessoryDocument(
  accessoryId: string,
  documentId: string
): Promise<DocumentActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!uuid.safeParse(accessoryId).success || !uuid.safeParse(documentId).success) {
    return { ok: false, message: 'Érvénytelen adat.' }
  }
  const tenantId = ctx.user.tenantId!
  const { error } = await ctx.supabase
    .from('accessory_documents')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
    .eq('id', documentId)
  if (error) return { ok: false, message: 'Nem sikerült eltávolítani.' }
  await revalidateStorefrontTenant(tenantId)
  return { ok: true, items: await listDocuments(ctx.supabase, tenantId, accessoryId) }
}

export async function moveAccessoryDocument(
  accessoryId: string,
  documentId: string,
  direction: 'up' | 'down'
): Promise<DocumentActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!uuid.safeParse(accessoryId).success || !uuid.safeParse(documentId).success) {
    return { ok: false, message: 'Érvénytelen adat.' }
  }
  const tenantId = ctx.user.tenantId!
  const items = await listDocuments(ctx.supabase, tenantId, accessoryId)
  const from = items.findIndex((d) => d.id === documentId)
  const to = direction === 'up' ? from - 1 : from + 1
  if (from < 0 || to < 0 || to >= items.length) return { ok: true, items }
  const next = [...items]
  ;[next[from], next[to]] = [next[to], next[from]]
  const results = await Promise.all(
    next.map((d, i) =>
      ctx.supabase
        .from('accessory_documents')
        .update({ sort_order: i })
        .eq('tenant_id', tenantId)
        .eq('id', d.id)
    )
  )
  if (results.some((r) => r.error)) return { ok: false, message: 'Nem sikerült átrendezni.' }
  await revalidateStorefrontTenant(tenantId)
  return { ok: true, items: await listDocuments(ctx.supabase, tenantId, accessoryId) }
}
