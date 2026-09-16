export const TENANT_MEDIA_BUCKET = 'tenant-media'

export const MEDIA_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
])

export const MEDIA_MAX_BYTES = 2 * 1024 * 1024

export type MediaFileRow = {
  id: string
  tenant_id: string
  original_filename: string
  stored_filename: string
  storage_path: string
  public_url: string
  size_bytes: number
  mime_type: string
  created_at: string
}

/** Fájlnév stem matchhez: „RIEX-EA60.jpg” → „riex-ea60” */
export function mediaFilenameStem(filename: string): string {
  const base = filename.trim().split(/[/\\]/).pop() ?? filename
  const withoutExt = base.replace(/\.[^.]+$/, '')
  return withoutExt.trim().toLowerCase()
}

export function sanitizeStoredFilename(original: string): string {
  return original.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

export function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'jpg'
}
