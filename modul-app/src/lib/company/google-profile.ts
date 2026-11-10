/** Google cégprofil értékelő link — bemenet felismerése és normalizálása (docs/55). */

export type GoogleReviewInputKind =
  | 'empty'
  /** g.page/r/…/review vagy writereview?placeid= — biztosan az űrlap */
  | 'review_form'
  /** maps.app.goo.gl rövid link — lehet űrlap, lehet profil; ki kell próbálni */
  | 'short_unverified'
  /** google.com/maps/place/… — a profil oldala, nem az űrlap */
  | 'profile_page'
  | 'invalid'

export type GoogleReviewInputResult = {
  kind: GoogleReviewInputKind
  /** Mentendő, normalizált link (empty / profile_page / invalid esetén null) */
  reviewUrl: string | null
  placeId: string | null
}

const PLACE_ID_RE = /^ChIJ[A-Za-z0-9_-]{10,}$/
const G_PAGE_PATH_RE = /^\/r\/([A-Za-z0-9_-]+)(?:\/review)?\/?$/

export function googleReviewUrlFromPlaceId(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
}

function toUrl(raw: string): URL | null {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url
  } catch {
    return null
  }
}

function isGoogleMapsHost(host: string, path: string): boolean {
  if (host === 'maps.google.com' || host.startsWith('maps.google.')) return true
  if (/^(www\.)?google\.[a-z.]+$/.test(host) && path.startsWith('/maps')) return true
  if (host === 'goo.gl' && path.startsWith('/maps')) return true
  return false
}

export function parseGoogleReviewInput(raw: string | null | undefined): GoogleReviewInputResult {
  const value = (raw ?? '').trim()
  if (!value) return { kind: 'empty', reviewUrl: null, placeId: null }

  if (PLACE_ID_RE.test(value)) {
    return {
      kind: 'review_form',
      reviewUrl: googleReviewUrlFromPlaceId(value),
      placeId: value
    }
  }

  const url = toUrl(value)
  if (!url || value.length > 500) {
    return { kind: 'invalid', reviewUrl: null, placeId: null }
  }

  const host = url.hostname.toLowerCase()
  const path = url.pathname

  if (host === 'g.page') {
    const match = G_PAGE_PATH_RE.exec(path)
    if (!match) return { kind: 'invalid', reviewUrl: null, placeId: null }
    return {
      kind: 'review_form',
      reviewUrl: `https://g.page/r/${match[1]}/review`,
      placeId: null
    }
  }

  if (host === 'search.google.com' && path.startsWith('/local/writereview')) {
    const placeId = url.searchParams.get('placeid')?.trim() ?? ''
    if (!placeId) return { kind: 'invalid', reviewUrl: null, placeId: null }
    return {
      kind: 'review_form',
      reviewUrl: googleReviewUrlFromPlaceId(placeId),
      placeId
    }
  }

  if (host === 'maps.app.goo.gl') {
    const slug = path.replace(/^\/+|\/+$/g, '')
    if (!slug) return { kind: 'invalid', reviewUrl: null, placeId: null }
    return {
      kind: 'short_unverified',
      reviewUrl: `https://maps.app.goo.gl/${slug}`,
      placeId: null
    }
  }

  if (isGoogleMapsHost(host, path)) {
    return { kind: 'profile_page', reviewUrl: null, placeId: null }
  }

  return { kind: 'invalid', reviewUrl: null, placeId: null }
}

/** Mentést blokkoló hibaüzenet, vagy null ha menthető. */
export function googleReviewInputError(result: GoogleReviewInputResult): string | null {
  if (result.kind === 'profile_page') {
    return 'Ez a cégprofil oldala, nem az értékelő űrlap. Másold ki a „Több értékelés kérése” linket.'
  }
  if (result.kind === 'invalid') {
    return 'Nem Google értékelő link. Formátum: https://g.page/r/…/review'
  }
  return null
}

const CODE_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Rövid link kód — könnyen olvasható karakterekből (nincs 0/O, 1/l/I). */
export function generateGoogleReviewCode(length = 6): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return out
}

export const GOOGLE_REVIEW_CLICK_SOURCES = [
  'direct',
  'sms',
  'partner',
  'qr',
  'email',
  'status',
  'other'
] as const

export type GoogleReviewClickSource = (typeof GOOGLE_REVIEW_CLICK_SOURCES)[number]

export function parseGoogleReviewClickSource(raw: string | null): GoogleReviewClickSource {
  const v = (raw ?? '').trim().toLowerCase()
  return (GOOGLE_REVIEW_CLICK_SOURCES as readonly string[]).includes(v)
    ? (v as GoogleReviewClickSource)
    : v
      ? 'other'
      : 'direct'
}

/** Link-előnézetet kérő botok / üzenetküldők — ezeket nem számoljuk kattintásnak. */
const PREVIEW_BOT_RE =
  /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skypeuri|linkedin|viber|curl|wget|python|headless/i

export function isLinkPreviewAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true
  return PREVIEW_BOT_RE.test(userAgent)
}

export function googleReviewShortPath(code: string): string {
  return `/g/${encodeURIComponent(code)}`
}
