/** Publikus weblap URL-slug (hirosablak.hu). */
export function normalizePublicSlug(raw: string): string {
  const folded = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
  return folded.slice(0, 80)
}

export function slugOrNull(raw: string): string | null {
  const s = normalizePublicSlug(raw)
  return s || null
}
