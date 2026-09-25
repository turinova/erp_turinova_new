/**
 * Vercel projekt-domain API (REST). Env: VERCEL_API_TOKEN, VERCEL_PROJECT_ID, opcionális VERCEL_TEAM_ID.
 * Env nélkül (helyi fejlesztés) configured=false — a DNS-ellenőrzés ettől még fut.
 */

const API = 'https://api.vercel.com'

export const VERCEL_DEFAULT_A = '76.76.21.21'
export const VERCEL_DEFAULT_CNAME = 'cname.vercel-dns.com'

export type VercelVerification = { type: string; domain: string; value: string; reason?: string }

type VercelEnv = { token: string; projectId: string; teamId: string | null }

function env(): VercelEnv | null {
  const token = process.env.VERCEL_API_TOKEN?.trim()
  const projectId = process.env.VERCEL_PROJECT_ID?.trim()
  if (!token || !projectId) return null
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID?.trim() || null }
}

export function vercelConfigured(): boolean {
  return env() !== null
}

async function call<T>(
  e: VercelEnv,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: true; data: T } | { ok: false; status: number; code: string; message: string }> {
  const url = new URL(`${API}${path}`)
  if (e.teamId) url.searchParams.set('teamId', e.teamId)
  try {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${e.token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    })
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const err = (json.error ?? {}) as { code?: string; message?: string }
      return { ok: false, status: res.status, code: err.code ?? 'unknown', message: err.message ?? res.statusText }
    }
    return { ok: true, data: json as T }
  } catch (err) {
    return { ok: false, status: 0, code: 'network', message: err instanceof Error ? err.message : 'network' }
  }
}

type ProjectDomain = { name: string; verified: boolean; verification?: VercelVerification[] }

export type VercelDomainState = {
  configured: boolean
  verified: boolean | null
  misconfigured: boolean | null
  verification: VercelVerification[]
  recommendedA: string
  recommendedCname: string
  error: { code: string; message: string } | null
}

export async function addVercelDomain(
  name: string,
  redirectTo?: string
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const e = env()
  if (!e) return { ok: true }
  const res = await call<ProjectDomain>(e, 'POST', `/v10/projects/${e.projectId}/domains`, {
    name,
    ...(redirectTo ? { redirect: redirectTo, redirectStatusCode: 308 } : {})
  })
  if (res.ok) return { ok: true }
  if (res.status === 409) {
    const mine = await call<ProjectDomain>(
      e,
      'GET',
      `/v9/projects/${e.projectId}/domains/${encodeURIComponent(name)}`
    )
    if (mine.ok) return { ok: true }
  }
  return { ok: false, code: res.code, message: res.message }
}

export async function removeVercelDomain(name: string): Promise<void> {
  const e = env()
  if (!e) return
  const res = await call(e, 'DELETE', `/v9/projects/${e.projectId}/domains/${encodeURIComponent(name)}`)
  if (!res.ok && res.status !== 404) console.error('removeVercelDomain', name, res.code, res.message)
}

function firstRecommended(list: unknown, fallback: string): string {
  if (!Array.isArray(list)) return fallback
  const sorted = [...list].sort(
    (a, b) => Number((a as { rank?: number }).rank ?? 99) - Number((b as { rank?: number }).rank ?? 99)
  )
  const value = (sorted[0] as { value?: unknown } | undefined)?.value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  if (typeof value === 'string') return value.replace(/\.$/, '')
  return fallback
}

/** Ellenőrzés + ajánlott DNS-értékek. A verify hívás csak ha a DNS már jónak tűnik. */
export async function vercelDomainState(name: string, opts: { verify: boolean }): Promise<VercelDomainState> {
  const e = env()
  const base: VercelDomainState = {
    configured: Boolean(e),
    verified: null,
    misconfigured: null,
    verification: [],
    recommendedA: VERCEL_DEFAULT_A,
    recommendedCname: VERCEL_DEFAULT_CNAME,
    error: null
  }
  if (!e) return base

  const enc = encodeURIComponent(name)
  const [domain, config] = await Promise.all([
    opts.verify
      ? call<ProjectDomain>(e, 'POST', `/v9/projects/${e.projectId}/domains/${enc}/verify`)
      : call<ProjectDomain>(e, 'GET', `/v9/projects/${e.projectId}/domains/${enc}`),
    call<Record<string, unknown>>(e, 'GET', `/v6/domains/${enc}/config`)
  ])

  let verified: boolean | null = null
  let verification: VercelVerification[] = []
  let error: VercelDomainState['error'] = null
  if (domain.ok) {
    verified = domain.data.verified
    verification = domain.data.verification ?? []
  } else if (opts.verify) {
    const again = await call<ProjectDomain>(e, 'GET', `/v9/projects/${e.projectId}/domains/${enc}`)
    if (again.ok) {
      verified = again.data.verified
      verification = again.data.verification ?? []
    } else {
      error = { code: again.code, message: again.message }
    }
  } else {
    error = { code: domain.code, message: domain.message }
  }

  return {
    ...base,
    verified,
    verification,
    misconfigured: config.ok ? Boolean(config.data.misconfigured) : null,
    recommendedA: config.ok ? firstRecommended(config.data.recommendedIPv4, VERCEL_DEFAULT_A) : VERCEL_DEFAULT_A,
    recommendedCname: config.ok
      ? firstRecommended(config.data.recommendedCNAME, VERCEL_DEFAULT_CNAME)
      : VERCEL_DEFAULT_CNAME,
    error
  }
}
