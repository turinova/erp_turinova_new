import type { SupabaseClient } from '@supabase/supabase-js'

import type { MediaFileRow } from '@/lib/media/types'

export async function listMediaFiles(
  supabase: SupabaseClient,
  tenantId: string
): Promise<MediaFileRow[]> {
  const { data, error } = await supabase
    .from('media_files')
    .select(
      'id, tenant_id, original_filename, stored_filename, storage_path, public_url, size_bytes, mime_type, created_at'
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('listMediaFiles', error.message)
    throw new Error('Nem sikerült betölteni a médiát.')
  }

  return (data ?? []) as MediaFileRow[]
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
    .select('public_url, original_filename')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('findMediaUrlByOriginalFilename', error.message)
    return null
  }

  const needle = name.toLowerCase()
  const row = (data ?? []).find(
    (r) => r.original_filename.toLowerCase() === needle
  )
  return row?.public_url ?? null
}

export async function findOriginalFilenameByPublicUrl(
  supabase: SupabaseClient,
  tenantId: string,
  publicUrl: string | null | undefined
): Promise<string | null> {
  if (!publicUrl?.trim()) return null
  const base = publicUrl.split('?')[0]

  const { data, error } = await supabase
    .from('media_files')
    .select('original_filename, public_url')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('findOriginalFilenameByPublicUrl', error.message)
    return null
  }

  const row = (data ?? []).find((r) => r.public_url.split('?')[0] === base)
  return row?.original_filename ?? null
}

export async function mapPublicUrlsToFilenames(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('media_files')
    .select('original_filename, public_url')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('mapPublicUrlsToFilenames', error.message)
    return new Map()
  }

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set(row.public_url.split('?')[0], row.original_filename)
  }
  return map
}

export async function mapFilenamesToPublicUrls(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('media_files')
    .select('original_filename, public_url')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('mapFilenamesToPublicUrls', error.message)
    return new Map()
  }

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set(row.original_filename.toLowerCase(), row.public_url)
  }
  return map
}
