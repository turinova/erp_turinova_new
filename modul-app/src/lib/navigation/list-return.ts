/**
 * Lista → detail → vissza: `q` / `page` / `active` megőrzése a detail URL-en,
 * majd visszaépítés a listára (ne dobjon az 1. oldalra).
 */

export const LIST_RETURN_KEYS = ['q', 'page', 'active'] as const

type SearchLike = {
  get: (key: string) => string | null
  toString?: () => string
}

/** Aktuális lista query (csak a visszatéréshez tartozó kulcsok). */
export function pickListReturnParams(searchParams: SearchLike): URLSearchParams {
  const next = new URLSearchParams()
  for (const key of LIST_RETURN_KEYS) {
    const value = searchParams.get(key)?.trim()
    if (value) next.set(key, value)
  }
  return next
}

export function hrefWithListReturn(
  detailPath: string,
  listSearchParams: SearchLike
): string {
  const qs = pickListReturnParams(listSearchParams).toString()
  return qs ? `${detailPath}?${qs}` : detailPath
}

/** Detail searchParams → lista path + query. */
export function listHrefFromReturn(
  listPath: string,
  detailSearchParams: SearchLike
): string {
  const qs = pickListReturnParams(detailSearchParams).toString()
  return qs ? `${listPath}?${qs}` : listPath
}
