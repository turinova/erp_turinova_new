import { createClient } from '@/lib/supabase/client'
import {
  rotateImageUrlToFile,
  type RotateDegrees,
  type UploadSheetImageResult
} from '@/lib/sheet-materials/image-upload'

export const LINEAR_MATERIALS_BUCKET = 'linear-materials'
export { rotateImageUrlToFile }
export type { RotateDegrees }

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
])

const MAX_BYTES = 2 * 1024 * 1024

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'jpg'
}

export type UploadLinearImageResult = UploadSheetImageResult

export async function uploadLinearMaterialImage(
  tenantId: string,
  file: File
): Promise<UploadLinearImageResult> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      ok: false,
      message: 'Csak JPG, PNG, WebP vagy GIF tölthető fel.'
    }
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: 'A kép legfeljebb 2 MB lehet.' }
  }

  const supabase = createClient()
  if (!supabase) {
    return { ok: false, message: 'A feltöltéshez nincs Supabase kapcsolat.' }
  }

  const ext = extensionForMime(file.type)
  const path = `${tenantId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from(LINEAR_MATERIALS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    })

  if (error) {
    console.error('uploadLinearMaterialImage', error.message)
    return {
      ok: false,
      message:
        'Nem sikerült feltölteni a képet. Ellenőrizd a storage jogosultságot.'
    }
  }

  const { data } = supabase.storage
    .from(LINEAR_MATERIALS_BUCKET)
    .getPublicUrl(path)

  return { ok: true, publicUrl: data.publicUrl, path }
}

export async function removeLinearMaterialImageByUrl(
  imageUrl: string
): Promise<void> {
  try {
    const supabase = createClient()
    if (!supabase) return

    const marker = `/object/public/${LINEAR_MATERIALS_BUCKET}/`
    const idx = imageUrl.indexOf(marker)
    if (idx === -1) return
    const path = decodeURIComponent(imageUrl.slice(idx + marker.length))
    if (!path) return

    await supabase.storage.from(LINEAR_MATERIALS_BUCKET).remove([path])
  } catch {
    // best-effort
  }
}
