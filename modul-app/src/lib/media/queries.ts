import type { SupabaseClient } from '@supabase/supabase-js'

import type { MediaFileRow } from '@/lib/media/types'

export type MediaKindFilter = 'all' | 'image' | 'pdf'

export const MEDIA_LIST_LIMIT = 200

export async function listMediaFiles(
  supabase: SupabaseClient,
  tenantId: string,
  kind: MediaKindFilter = 'all'
): Promise<MediaFileRow[]> {
  let q = supabase
    .from('media_files')
    .select(
      'id, tenant_id, original_filename, stored_filename, storage_path, public_url, size_bytes, mime_type, created_at'
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(MEDIA_LIST_LIMIT)
  if (kind === 'image') q = q.like('mime_type', 'image/%')
  if (kind === 'pdf') q = q.eq('mime_type', 'application/pdf')
  const { data, error } = await q

  if (error) {
    console.error('listMediaFiles', error.message)
    throw new Error('Nem sikerült betölteni a médiát.')
  }

  return (data ?? []) as MediaFileRow[]
}

const PAGE = 1000

/** PostgREST 1000 soros válaszkorlát miatt lapozva olvas. */
async function fetchAllMedia(
  supabase: SupabaseClient,
  tenantId: string,
  onlyImages: boolean
): Promise<{ original_filename: string; public_url: string }[]> {
  const out: { original_filename: string; public_url: string }[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from('media_files')
      .select('original_filename, public_url')
      .eq('tenant_id', tenantId)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (onlyImages) q = q.like('mime_type', 'image/%')
    const { data, error } = await q
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as { original_filename: string; public_url: string }[]))
    if (!data || data.length < PAGE) return out
  }
}

function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export async function findMediaUrlByOriginalFilename(
  supabase: SupabaseClient,
  tenantId: string,
  originalFilename: string
): Promise<string | null> {
  const name = originalFilename.trim()
  if (!name) return null

  const { data, error } = await supabase
    .from('media_files')
    .select('public_url')
    .eq('tenant_id', tenantId)
    .like('mime_type', 'image/%')
    .ilike('original_filename', escapeLike(name))
    .limit(1)

  if (error) {
    console.error('findMediaUrlByOriginalFilename', error.message)
    return null
  }
  return (data?.[0]?.public_url as string | undefined) ?? null
}

export async function findOriginalFilenameByPublicUrl(
  supabase: SupabaseClient,
  tenantId: string,
  publicUrl: string | null | undefined
): Promise<string | null> {
  if (!publicUrl?.trim()) return null
  const base = publicUrl.trim().split('?')[0]

  const { data, error } = await supabase
    .from('media_files')
    .select('original_filename')
    .eq('tenant_id', tenantId)
    .in('public_url', [...new Set([base, publicUrl.trim()])])
    .limit(1)

  if (error) {
    console.error('findOriginalFilenameByPublicUrl', error.message)
    return null
  }
  return (data?.[0]?.original_filename as string | undefined) ?? null
}

export async function mapPublicUrlsToFilenames(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Map<string, string>> {
  try {
    const rows = await fetchAllMedia(supabase, tenantId, false)
    return new Map(rows.map((r) => [r.public_url.split('?')[0], r.original_filename]))
  } catch (e) {
    console.error('mapPublicUrlsToFilenames', e)
    return new Map()
  }
}

/** Csak képek — a Kep_fajlnev oszlop nem hivatkozhat PDF-re. */
export async function mapFilenamesToPublicUrls(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Map<string, string>> {
  try {
    const rows = await fetchAllMedia(supabase, tenantId, true)
    return new Map(rows.map((r) => [r.original_filename.toLowerCase(), r.public_url]))
  } catch (e) {
    console.error('mapFilenamesToPublicUrls', e)
    return new Map()
  }
}
