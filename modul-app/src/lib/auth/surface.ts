/**
 * Staff (app.*) vs partner (optinova.hu) felület.
 * Local: default staff; MODUL_AUTH_SURFACE=partner vagy /partner/* path.
 */

export type AuthSurface = 'staff' | 'partner'

export function normalizeHostname(hostHeader: string | null): string {
  if (!hostHeader) return 'localhost'
  return hostHeader.split(':')[0]?.toLowerCase() ?? 'localhost'
}

export function resolveAuthSurface(hostname: string): AuthSurface {
  const override = process.env.MODUL_AUTH_SURFACE?.trim().toLowerCase()
  if (override === 'partner' || override === 'staff') {
    return override
  }

  const host = normalizeHostname(hostname)

  if (host === 'app.optinova.hu' || host.startsWith('app.')) {
    return 'staff'
  }

  if (
    host === 'optinova.hu' ||
    host === 'www.optinova.hu' ||
    host === 'partner.localhost' ||
    host.endsWith('.partner.localhost')
  ) {
    return 'partner'
  }

  // localhost / Vercel preview → staff (partner: /partner/* vagy env)
  return 'staff'
}

export function isPartnerPath(pathname: string): boolean {
  return (
    pathname === '/partner' ||
    pathname.startsWith('/partner/')
  )
}

/** Partner auth szabályok: partner host VAGY /partner path. */
export function isPartnerContext(
  hostname: string,
  pathname: string
): boolean {
  return resolveAuthSurface(hostname) === 'partner' || isPartnerPath(pathname)
}

export const PARTNER_LOGIN_PATH = '/partner/login'
export const PARTNER_REGISTER_PATH = '/partner/register'
export const PARTNER_HOME_PATH = '/partner/home'
export const PARTNER_SETTINGS_PATH = '/partner/beallitasok'
export const PARTNER_SEARCH_PATH = '/partner/kereso'
export const PARTNER_OPTI_PATH = '/partner/opti'
export const PARTNER_QUOTES_PATH = '/partner/ajanlatok'
export const PARTNER_ORDERS_PATH = '/partner/megrendelesek'

export function isPartnerPublicPath(pathname: string): boolean {
  return (
    pathname === PARTNER_LOGIN_PATH ||
    pathname === PARTNER_REGISTER_PATH
  )
}
