/**
 * Staff (app.) vs Partner (optinova.hu) vs Platform admin (admin.).
 *
 * Partner host: tiszta URL-ek → rewrite /partner/*
 * Platform host: tiszta URL-ek → rewrite /platform/*
 * Localhost staff: partner /platform path-mode; admin.localhost = platform host.
 */

export type AuthSurface = 'staff' | 'partner' | 'platform'

export const STAFF_HOST_LABEL = 'app.optinova.hu'
export const PARTNER_HOST_LABEL = 'optinova.hu'
export const PLATFORM_HOST_LABEL = 'admin.optinova.hu'

export function normalizeHostname(hostHeader: string | null): string {
  if (!hostHeader) return 'localhost'
  return hostHeader.split(':')[0]?.toLowerCase() ?? 'localhost'
}

export function resolveAuthSurface(hostname: string): AuthSurface {
  const override = process.env.MODUL_AUTH_SURFACE?.trim().toLowerCase()
  if (
    override === 'partner' ||
    override === 'staff' ||
    override === 'platform'
  ) {
    return override
  }

  const host = normalizeHostname(hostname)

  if (
    host === 'admin.optinova.hu' ||
    host === 'admin.localhost' ||
    host.endsWith('.admin.localhost')
  ) {
    return 'platform'
  }

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

  // localhost / Vercel preview → staff (partner: /partner/*; platform: /platform)
  return 'staff'
}

export function isPartnerPath(pathname: string): boolean {
  return pathname === '/partner' || pathname.startsWith('/partner/')
}

export function isPlatformPath(pathname: string): boolean {
  return pathname === '/platform' || pathname.startsWith('/platform/')
}

/** Partner auth szabályok: partner host VAGY /partner path. */
export function isPartnerContext(
  hostname: string,
  pathname: string
): boolean {
  return resolveAuthSurface(hostname) === 'partner' || isPartnerPath(pathname)
}

export function isPlatformContext(
  hostname: string,
  pathname: string
): boolean {
  return (
    resolveAuthSurface(hostname) === 'platform' || isPlatformPath(pathname)
  )
}

/** Tiszta publikus pathok (optinova.hu címsáv). */
export const PARTNER_LOGIN_PATH = '/login'
export const PARTNER_REGISTER_PATH = '/register'
export const PARTNER_HOME_PATH = '/home'
export const PARTNER_SETTINGS_PATH = '/beallitasok'
export const PARTNER_SEARCH_PATH = '/kereso'
export const PARTNER_OPTI_PATH = '/opti'
export const PARTNER_QUOTES_PATH = '/ajanlatok'
export const PARTNER_ORDERS_PATH = '/megrendelesek'

/** Belső Next route-ok (app/(partner)/partner/…). */
export const PARTNER_INTERNAL_PREFIX = '/partner'
export const PLATFORM_INTERNAL_PREFIX = '/platform'

const CLEAN_TO_INTERNAL: Record<string, string> = {
  [PARTNER_LOGIN_PATH]: `${PARTNER_INTERNAL_PREFIX}/login`,
  [PARTNER_REGISTER_PATH]: `${PARTNER_INTERNAL_PREFIX}/register`,
  [PARTNER_HOME_PATH]: `${PARTNER_INTERNAL_PREFIX}/home`,
  [PARTNER_SETTINGS_PATH]: `${PARTNER_INTERNAL_PREFIX}/beallitasok`,
  [PARTNER_SEARCH_PATH]: `${PARTNER_INTERNAL_PREFIX}/kereso`,
  [PARTNER_OPTI_PATH]: `${PARTNER_INTERNAL_PREFIX}/opti`,
  [PARTNER_QUOTES_PATH]: `${PARTNER_INTERNAL_PREFIX}/ajanlatok`,
  [PARTNER_ORDERS_PATH]: `${PARTNER_INTERNAL_PREFIX}/megrendelesek`
}

/** Platform host tiszta path → /platform/* */
const PLATFORM_CLEAN_TO_INTERNAL: Record<string, string> = {
  '/': PLATFORM_INTERNAL_PREFIX,
  '/tenants': `${PLATFORM_INTERNAL_PREFIX}/tenants`,
  '/partnerek': `${PLATFORM_INTERNAL_PREFIX}/partnerek`,
  '/csomagok': `${PLATFORM_INTERNAL_PREFIX}/csomagok`,
  '/add-onok': `${PLATFORM_INTERNAL_PREFIX}/add-onok`,
  '/health': `${PLATFORM_INTERNAL_PREFIX}/health`,
  '/kereses': `${PLATFORM_INTERNAL_PREFIX}/kereses`
}

/** Exact clean paths that rewrite to /partner/*. */
export function partnerCleanToInternal(pathname: string): string | null {
  if (CLEAN_TO_INTERNAL[pathname]) return CLEAN_TO_INTERNAL[pathname]

  for (const [clean, internal] of Object.entries(CLEAN_TO_INTERNAL)) {
    if (clean === PARTNER_LOGIN_PATH || clean === PARTNER_REGISTER_PATH) {
      continue
    }
    if (pathname.startsWith(`${clean}/`)) {
      return `${internal}${pathname.slice(clean.length)}`
    }
  }
  return null
}

/** /partner/home → /home (canonical on partner host). */
export function partnerInternalToClean(pathname: string): string | null {
  if (!isPartnerPath(pathname)) return null
  if (pathname === PARTNER_INTERNAL_PREFIX) return PARTNER_HOME_PATH
  const rest = pathname.slice(PARTNER_INTERNAL_PREFIX.length) || '/home'
  return rest.startsWith('/') ? rest : `/${rest}`
}

export function platformCleanToInternal(pathname: string): string | null {
  if (PLATFORM_CLEAN_TO_INTERNAL[pathname]) {
    return PLATFORM_CLEAN_TO_INTERNAL[pathname]
  }
  for (const [clean, internal] of Object.entries(PLATFORM_CLEAN_TO_INTERNAL)) {
    if (clean === '/') continue
    if (pathname.startsWith(`${clean}/`)) {
      return `${internal}${pathname.slice(clean.length)}`
    }
  }
  // Már /platform/* — nincs rewrite
  if (isPlatformPath(pathname)) return null
  return null
}

/** /platform/tenants → /tenants on admin host. */
export function platformInternalToClean(pathname: string): string | null {
  if (!isPlatformPath(pathname)) return null
  if (pathname === PLATFORM_INTERNAL_PREFIX) return '/'
  const rest = pathname.slice(PLATFORM_INTERNAL_PREFIX.length)
  return rest.startsWith('/') ? rest : `/${rest}`
}

/**
 * Link/redirect cél partner UI-hoz.
 * partnerHost / clean URL mode → tiszta path; path-mode (/partner/…) → internal.
 */
export function partnerHref(
  cleanPath: string,
  mode: 'clean' | 'prefixed'
): string {
  const path = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`
  if (mode === 'clean') return path
  if (path.startsWith(PARTNER_INTERNAL_PREFIX)) return path
  return `${PARTNER_INTERNAL_PREFIX}${path}`
}

export function partnerHrefModeFromPathname(
  pathname: string
): 'clean' | 'prefixed' {
  return isPartnerPath(pathname) ? 'prefixed' : 'clean'
}

/** Platform link: admin hoston tiszta, app hoston /platform/*. */
export function platformHref(
  cleanPath: string,
  mode: 'clean' | 'prefixed'
): string {
  const path =
    cleanPath === '' || cleanPath === '/'
      ? '/'
      : cleanPath.startsWith('/')
        ? cleanPath
        : `/${cleanPath}`
  if (mode === 'clean') {
    return path === '/' ? '/' : path
  }
  if (path === '/') return PLATFORM_INTERNAL_PREFIX
  if (path.startsWith(PLATFORM_INTERNAL_PREFIX)) return path
  return `${PLATFORM_INTERNAL_PREFIX}${path}`
}

export function isPartnerPublicPath(pathname: string): boolean {
  return (
    pathname === PARTNER_LOGIN_PATH ||
    pathname === PARTNER_REGISTER_PATH ||
    pathname === `${PARTNER_INTERNAL_PREFIX}/login` ||
    pathname === `${PARTNER_INTERNAL_PREFIX}/register`
  )
}

/** Staff-only pathok — partner hoston ne legyenek elérhetők. */
export function isStaffOnlyPath(pathname: string): boolean {
  return (
    pathname.startsWith('/platform') ||
    pathname.startsWith('/ugyfelek') ||
    pathname.startsWith('/torzsadatok') ||
    pathname === '/no-access' ||
    pathname === '/nincs-hozzaferes'
  )
}

/** Tenant app pathok — platform (admin) hoston ne. */
export function isTenantAppPath(pathname: string): boolean {
  if (isPlatformPath(pathname)) return false
  if (pathname === '/login') return false
  return (
    pathname === '/home' ||
    pathname.startsWith('/home/') ||
    pathname.startsWith('/kereso') ||
    pathname.startsWith('/opti') ||
    pathname.startsWith('/ugyfelek') ||
    pathname.startsWith('/ajanlatok') ||
    pathname.startsWith('/megrendelesek') ||
    pathname.startsWith('/torzsadatok') ||
    pathname.startsWith('/beallitasok') ||
    pathname.startsWith('/felhasznalok') ||
    pathname.startsWith('/partner') ||
    pathname === '/no-access' ||
    pathname === '/nincs-hozzaferes'
  )
}

/** Prod: app./platform → admin. URL (ha be van állítva). */
export function getPlatformPublicOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_PLATFORM_ORIGIN?.trim()
  if (!raw) return null
  return raw.replace(/\/$/, '')
}
