import { createClient } from '@/lib/supabase/client'
import {
  extensionForMime,
  MEDIA_ALLOWED_MIME,
  MEDIA_MAX_BYTES,
  sanitizeStoredFilename,
  TENANT_MEDIA_BUCKET,
  type MediaFileRow
} from '@/lib/media/types'

export type UploadTenantMediaResult =
  | { ok: true; file: MediaFileRow }
  | { ok: false; message: string }

async function uniqueOriginalFilename(
  tenantId: string,
  original: string
): Promise<string> {
  const supabase = createClient()
  if (!supabase) return original

  const { data } = await supabase
    .from('media_files')
    .select('original_filename')
    .eq('tenant_id', tenantId)

  const taken = new Set(
    (data ?? []).map((r) => r.original_filename.toLowerCase())
  )
  if (!taken.has(original.toLowerCase())) return original

  const dot = original.lastIndexOf('.')
  const stem = dot > 0 ? original.slice(0, dot) : original
  const ext = dot > 0 ? original.slice(dot) : ''
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${stem} (${i})${ext}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return `${stem}-${crypto.randomUUID().slice(0, 8)}${ext}`
}

/** Feltöltés tenant-media bucketbe + media_files regisztráció. */
export async function uploadTenantMedia(
  tenantId: string,
  file: File,
  options?: { preferredFilename?: string }
): Promise<UploadTenantMediaResult> {
  const mime =
    file.type ||
    (file.name.toLowerCase().endsWith('.png')
      ? 'image/png'
      : file.name.toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : file.name.toLowerCase().endsWith('.gif')
          ? 'image/gif'
          : file.name.toLowerCase().match(/\.(jpe?g)$/)
            ? 'image/jpeg'
            : '')

  if (!MEDIA_ALLOWED_MIME.has(mime)) {
    return {
      ok: false,
      message: 'Csak JPG, PNG, WebP vagy GIF tölthető fel.'
    }
  }
  if (file.size > MEDIA_MAX_BYTES) {
    return { ok: false, message: 'A kép legfeljebb 2 MB lehet.' }
  }

  const supabase = createClient()
  if (!supabase) {
    return { ok: false, message: 'A feltöltéshez nincs Supabase kapcsolat.' }
  }

  const rawName = (options?.preferredFilename ?? file.name).trim() || 'kep.jpg'
  const baseName = rawName.split(/[/\\]/).pop() ?? rawName
  const originalFilename = await uniqueOriginalFilename(tenantId, baseName)

  const ext = extensionForMime(mime)
  const storedFilename = `${crypto.randomUUID()}_${sanitizeStoredFilename(originalFilename) || `kep.${ext}`}`
  const storagePath = `${tenantId}/${storedFilename}`

  const { error: upErr } = await supabase.storage
    .from(TENANT_MEDIA_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: mime
    })

  if (upErr) {
    console.error('uploadTenantMedia storage', upErr.message)
    return {
      ok: false,
      message:
        upErr.message.includes('Bucket not found') ||
        upErr.message.includes('not found')
          ? 'Hiányzik a tenant-media storage bucket. Futtasd a 20260422 migrációt.'
          : `Feltöltés sikertelen: ${upErr.message}`
    }
  }

  const { data: urlData } = supabase.storage
    .from(TENANT_MEDIA_BUCKET)
    .getPublicUrl(storagePath)

  const {
    data: { user }
  } = await supabase.auth.getUser()

  const { data: row, error: insErr } = await supabase
    .from('media_files')
    .insert({
      tenant_id: tenantId,
      original_filename: originalFilename,
      stored_filename: storedFilename,
      storage_path: storagePath,
      public_url: urlData.publicUrl,
      size_bytes: file.size,
      mime_type: mime,
      created_by: user?.id ?? null
    })
    .select(
      'id, tenant_id, original_filename, stored_filename, storage_path, public_url, size_bytes, mime_type, created_at'
    )
    .single()

  if (insErr || !row) {
    console.error('uploadTenantMedia insert', insErr?.message)
    await supabase.storage.from(TENANT_MEDIA_BUCKET).remove([storagePath])
    return {
      ok: false,
      message:
        insErr?.message?.includes('media_files_tenant_filename')
          ? 'Ez a fájlnév már szerepel a médiában.'
          : insErr?.message
            ? `Nem sikerült rögzíteni: ${insErr.message}`
            : 'Nem sikerült rögzíteni a fájlt.'
    }
  }

  return { ok: true, file: row as MediaFileRow }
}
