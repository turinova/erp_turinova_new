import { createClient } from '@/lib/supabase/client'

export const SHEET_MATERIALS_BUCKET = 'sheet-materials'

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

export type UploadSheetImageResult =
  | { ok: true; publicUrl: string; path: string }
  | { ok: false; message: string }

/** Feltöltés: {tenantId}/{uuid}.{ext} */
export async function uploadSheetMaterialImage(
  tenantId: string,
  file: File
): Promise<UploadSheetImageResult> {
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
    .from(SHEET_MATERIALS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    })

  if (error) {
    console.error('uploadSheetMaterialImage', error.message)
    return {
      ok: false,
      message:
        'Nem sikerült feltölteni a képet. Ellenőrizd a storage jogosultságot.'
    }
  }

  const { data } = supabase.storage
    .from(SHEET_MATERIALS_BUCKET)
    .getPublicUrl(path)

  return { ok: true, publicUrl: data.publicUrl, path }
}

/** Opcionális törlés a storage-ból (ha a URL a mi bucketünkből jön). */
export async function removeSheetMaterialImageByUrl(
  imageUrl: string
): Promise<void> {
  try {
    const supabase = createClient()
    if (!supabase) return

    const marker = `/object/public/${SHEET_MATERIALS_BUCKET}/`
    const idx = imageUrl.indexOf(marker)
    if (idx === -1) return
    const path = decodeURIComponent(imageUrl.slice(idx + marker.length))
    if (!path) return

    await supabase.storage.from(SHEET_MATERIALS_BUCKET).remove([path])
  } catch {
    // best-effort
  }
}

export type RotateDegrees = 90 | -90 | 180

/**
 * Betölti a képet, canvasen elforgatja, File-ként adja vissza (JPEG).
 * GIF animáció elveszik — állóképpé mentjük.
 */
export async function rotateImageUrlToFile(
  imageUrl: string,
  degrees: RotateDegrees
): Promise<{ ok: true; file: File } | { ok: false; message: string }> {
  try {
    const image = await loadImage(imageUrl)
    const rad = (degrees * Math.PI) / 180
    const swap = Math.abs(degrees) === 90
    const outW = swap ? image.naturalHeight : image.naturalWidth
    const outH = swap ? image.naturalWidth : image.naturalHeight

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return {
        ok: false,
        message: 'A kép forgatása nem támogatott ebben a böngészőben.'
      }
    }

    ctx.translate(outW / 2, outH / 2)
    ctx.rotate(rad)
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    )
    if (!blob) {
      return { ok: false, message: 'Nem sikerült a forgatott képet előállítani.' }
    }
    if (blob.size > MAX_BYTES) {
      return {
        ok: false,
        message: 'A forgatott kép túl nagy (max. 2 MB). Tölts fel kisebbet.'
      }
    }

    const file = new File([blob], `rotated-${Date.now()}.jpg`, {
      type: 'image/jpeg'
    })
    return { ok: true, file }
  } catch {
    return {
      ok: false,
      message:
        'Nem sikerült betölteni a képet forgatáshoz. Próbáld újra, vagy töltsd fel újra a fájlt.'
    }
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = url
  })
}
