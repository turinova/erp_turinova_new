import { createClient } from '@/lib/supabase/client'
import {
  extensionForMime,
  isPdfMime,
  MEDIA_ALLOWED_MIME,
  MEDIA_MAX_BYTES,
  MEDIA_PDF_MAX_BYTES,
  sanitizeStoredFilename,
  TENANT_MEDIA_BUCKET,
  type MediaFileRow
} from '@/lib/media/types'

export type UploadTenantMediaResult =
  | { ok: true; file: MediaFileRow }
  | { ok: false; message: string }

const RETRY_DELAYS_MS = [2000, 5000, 10000, 20000, 40000]

/** Átmeneti szerverhiba (terhelés, hálózat) — érdemes újrapróbálni. */
function isTransient(message: string | undefined): boolean {
  return /too many connections|internal server error|timeout|timed out|fetch failed|failed to fetch|network|rate limit|429|500|502|503|504|gateway/i.test(
    message ?? ''
  )
}

async function withRetry<T extends { error: { message: string } | null }>(
  run: () => PromiseLike<T>
): Promise<T> {
  let result = await run()
  for (const delay of RETRY_DELAYS_MS) {
    if (!result.error || !isTransient(result.error.message)) return result
    await new Promise((r) => setTimeout(r, delay))
    result = await run()
  }
  return result
}

/** A tenant összes médiafájlneve kisbetűvel (tömeges feltöltéshez: a meglévőket kihagyjuk). */
export async function listTenantMediaFilenames(tenantId: string): Promise<Set<string>> {
  const supabase = createClient()
  const out = new Set<string>()
  if (!supabase) return out
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await withRetry(() =>
      supabase
        .from('media_files')
        .select('original_filename')
        .eq('tenant_id', tenantId)
        .order('id', { ascending: true })
        .range(from, from + page - 1)
    )
    if (error) throw new Error(error.message)
    for (const r of data ?? []) out.add((r.original_filename as string).toLowerCase())
    if (!data || data.length < page) return out
  }
}

async function uniqueOriginalFilename(
  tenantId: string,
  original: string,
  known?: Set<string>
): Promise<string> {
  if (known && !known.has(original.toLowerCase())) return original
  const supabase = createClient()
  if (!supabase) return original

  const dot = original.lastIndexOf('.')
  const stem = dot > 0 ? original.slice(0, dot) : original
  const { data } = await supabase
    .from('media_files')
    .select('original_filename')
    .eq('tenant_id', tenantId)
    .ilike('original_filename', `${stem.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
    .limit(1000)

  const taken = new Set(
    (data ?? []).map((r) => r.original_filename.toLowerCase())
  )
  if (!taken.has(original.toLowerCase())) return original

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
  options?: {
    preferredFilename?: string
    /** Előre betöltött fájlnevek (kisbetű) — megspórolja a névütközés-lekérdezést. */
    knownFilenames?: Set<string>
    userId?: string | null
  }
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
            : file.name.toLowerCase().endsWith('.pdf')
              ? 'application/pdf'
              : '')

  if (!MEDIA_ALLOWED_MIME.has(mime)) {
    return {
      ok: false,
      message: 'Csak JPG, PNG, WebP, GIF kép vagy PDF tölthető fel.'
    }
  }
  if (isPdfMime(mime) ? file.size > MEDIA_PDF_MAX_BYTES : file.size > MEDIA_MAX_BYTES) {
    return {
      ok: false,
      message: isPdfMime(mime) ? 'A PDF legfeljebb 10 MB lehet.' : 'A kép legfeljebb 2 MB lehet.'
    }
  }

  const supabase = createClient()
  if (!supabase) {
    return { ok: false, message: 'A feltöltéshez nincs Supabase kapcsolat.' }
  }

  const rawName = (options?.preferredFilename ?? file.name).trim() || 'kep.jpg'
  const baseName = rawName.split(/[/\\]/).pop() ?? rawName
  const originalFilename = await uniqueOriginalFilename(tenantId, baseName, options?.knownFilenames)

  const ext = extensionForMime(mime)
  const storedFilename = `${crypto.randomUUID()}_${sanitizeStoredFilename(originalFilename) || `kep.${ext}`}`
  const storagePath = `${tenantId}/${storedFilename}`

  const upload = await withRetry(() =>
    supabase.storage.from(TENANT_MEDIA_BUCKET).upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: mime
    })
  )
  // Újrapróbáláskor az előző, hibát jelző kísérlet már felírhatta ugyanarra az egyedi útvonalra.
  const upErr = upload.error && /already exists|duplicate/i.test(upload.error.message) ? null : upload.error

  if (upErr) {
    console.warn('uploadTenantMedia storage', upErr.message)
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

  const userId =
    options?.userId !== undefined
      ? options.userId
      : ((await supabase.auth.getUser()).data.user?.id ?? null)

  const { data: row, error: insErr } = await withRetry(() =>
    supabase
      .from('media_files')
      .insert({
        tenant_id: tenantId,
        original_filename: originalFilename,
        stored_filename: storedFilename,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        size_bytes: file.size,
        mime_type: mime,
        created_by: userId
      })
      .select(
        'id, tenant_id, original_filename, stored_filename, storage_path, public_url, size_bytes, mime_type, created_at'
      )
      .single()
  )

  if (insErr || !row) {
    console.warn('uploadTenantMedia insert', insErr?.message)
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
