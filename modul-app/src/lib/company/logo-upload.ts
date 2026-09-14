import { createClient } from '@/lib/supabase/client'

export const TENANT_COMPANY_LOGOS_BUCKET = 'tenant-company-logos'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 2 * 1024 * 1024

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export type UploadCompanyLogoResult =
  | { ok: true; publicUrl: string; path: string }
  | { ok: false; message: string }

/** Feltöltés: {tenantId}/logo.{ext} (upsert). */
export async function uploadCompanyLogo(
  tenantId: string,
  file: File
): Promise<UploadCompanyLogoResult> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      ok: false,
      message: 'Csak JPG, PNG vagy WebP tölthető fel.'
    }
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: 'A logo legfeljebb 2 MB lehet.' }
  }

  const supabase = createClient()
  if (!supabase) {
    return { ok: false, message: 'A feltöltéshez nincs Supabase kapcsolat.' }
  }

  const ext = extensionForMime(file.type)
  const path = `${tenantId}/logo.${ext}`

  const { error } = await supabase.storage
    .from(TENANT_COMPANY_LOGOS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type
    })

  if (error) {
    console.error('uploadCompanyLogo', error.message)
    return {
      ok: false,
      message:
        'Nem sikerült feltölteni a logót. Ellenőrizd a storage jogosultságot.'
    }
  }

  const { data } = supabase.storage
    .from(TENANT_COMPANY_LOGOS_BUCKET)
    .getPublicUrl(path)

  // cache bust
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`

  return { ok: true, publicUrl, path }
}

export async function removeCompanyLogoByUrl(
  imageUrl: string
): Promise<void> {
  try {
    const supabase = createClient()
    if (!supabase) return

    const marker = `/object/public/${TENANT_COMPANY_LOGOS_BUCKET}/`
    const idx = imageUrl.indexOf(marker)
    if (idx === -1) return
    const pathWithQuery = decodeURIComponent(
      imageUrl.slice(idx + marker.length)
    )
    const path = pathWithQuery.split('?')[0]
    if (!path) return

    await supabase.storage.from(TENANT_COMPANY_LOGOS_BUCKET).remove([path])
  } catch {
    // best-effort
  }
}
