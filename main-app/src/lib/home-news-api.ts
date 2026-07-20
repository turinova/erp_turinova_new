import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export const HOME_NEWS_PIN_ENV = 'HOME_NEWS_PIN'
export const HOME_NEWS_TITLE_MAX = 120
export const HOME_NEWS_BODY_MAX = 800
export const HOME_NEWS_LINK_URL_MAX = 300
export const HOME_NEWS_LINK_LABEL_MAX = 80

export function getHomeNewsPin(): string {
  return process.env[HOME_NEWS_PIN_ENV]?.trim() || '3245'
}

export function isValidHomeNewsPin(pin: unknown): boolean {
  if (typeof pin !== 'string') return false
  const normalized = pin.trim()
  if (!/^\d{4}$/.test(normalized)) return false
  return normalized === getHomeNewsPin()
}

export async function requireHomeNewsUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {}
      }
    }
  )

  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
}

export function pinErrorResponse() {
  return NextResponse.json({ error: 'Hibás kód' }, { status: 403 })
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/** Internal path (/opti) or https URL. Rejects javascript:/data: etc. */
export function normalizeHomeNewsLinkUrl(raw: unknown): { linkUrl: string | null; error?: string } {
  if (raw == null || raw === '') return { linkUrl: null }
  const value = String(raw).trim()
  if (!value) return { linkUrl: null }
  if (value.length > HOME_NEWS_LINK_URL_MAX) {
    return { linkUrl: null, error: `A link legfeljebb ${HOME_NEWS_LINK_URL_MAX} karakter lehet` }
  }

  if (value.startsWith('/')) {
    if (value.startsWith('//')) {
      return { linkUrl: null, error: 'Érvénytelen belső link' }
    }
    if (!/^\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]*$/.test(value)) {
      return { linkUrl: null, error: 'Érvénytelen belső útvonal (pl. /opti)' }
    }
    return { linkUrl: value }
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return { linkUrl: null, error: 'Csak http(s) vagy belső /útvonal engedélyezett' }
    }
    return { linkUrl: url.toString() }
  } catch {
    return { linkUrl: null, error: 'Érvénytelen link (pl. /opti vagy https://…)' }
  }
}

export function normalizeHomeNewsFields(body: Record<string, unknown>) {
  const title = String(body.title ?? '').trim()
  const textBody = body.body == null || body.body === '' ? null : String(body.body).trim()
  const linkLabelRaw =
    body.link_label == null || body.link_label === '' ? null : String(body.link_label).trim()
  const { linkUrl, error: linkError } = normalizeHomeNewsLinkUrl(body.link_url)
  const kindRaw = String(body.kind ?? 'news').trim()
  const kind = kindRaw === 'task' ? 'task' : kindRaw === 'news' ? 'news' : null
  const errors: string[] = []

  if (!title) errors.push('A cím kötelező')
  if (title.length > HOME_NEWS_TITLE_MAX) {
    errors.push(`A cím legfeljebb ${HOME_NEWS_TITLE_MAX} karakter lehet`)
  }
  if (textBody && textBody.length > HOME_NEWS_BODY_MAX) {
    errors.push(`A szöveg legfeljebb ${HOME_NEWS_BODY_MAX} karakter lehet`)
  }
  if (!kind) errors.push('A típus Hír vagy Feladat legyen')
  if (linkError) errors.push(linkError)
  if (linkLabelRaw && linkLabelRaw.length > HOME_NEWS_LINK_LABEL_MAX) {
    errors.push(`A link felirat legfeljebb ${HOME_NEWS_LINK_LABEL_MAX} karakter lehet`)
  }
  if (linkLabelRaw && !linkUrl) {
    errors.push('Link felirathoz add meg a linket is (pl. /opti)')
  }

  const link_label = linkUrl ? linkLabelRaw || 'Megnyitás' : null

  return {
    title,
    body: textBody,
    kind: kind ?? 'news',
    link_url: linkUrl,
    link_label,
    errors
  }
}
