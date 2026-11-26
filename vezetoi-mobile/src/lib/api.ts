import { supabase } from '@/lib/supabase'

/** Staff webes host — a mobil API és a „Megnyitás a weben” linkek innen mennek. */
export const WEB_ORIGIN = (process.env.EXPO_PUBLIC_API_URL ?? 'https://app.optinova.hu').replace(/\/$/, '')

const TIMEOUT_MS = 15_000

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

async function call(path: string, query: string, token: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${WEB_ORIGIN}/api/m/v1/${path}?${query}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal
    })
  } finally {
    clearTimeout(timer)
  }
}

/** GET a modul-app mobil API-ról a bejelentkezett user tokenjével; 401-nél egyszer frissít. */
export async function apiGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params).toString()
  const { data } = await supabase.auth.getSession()
  let token = data.session?.access_token
  if (!token) throw new ApiError(401, 'Nincs bejelentkezve.')

  let res = await call(path, query, token)
  if (res.status === 401) {
    const refreshed = await supabase.auth.refreshSession()
    token = refreshed.data.session?.access_token
    if (!token) throw new ApiError(401, 'Lejárt a munkamenet.')
    res = await call(path, query, token)
  }
  if (!res.ok) throw new ApiError(res.status, `API ${path}: ${res.status} (${WEB_ORIGIN})`)
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    throw new ApiError(res.status, `API ${path}: nem JSON válasz — rossz EXPO_PUBLIC_API_URL? (${WEB_ORIGIN})`)
  }
  return (await res.json()) as T
}
