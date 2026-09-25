import { NextResponse, type NextRequest } from 'next/server'

import {
  demoSiteSlug,
  internalStorefrontPath,
  isStorefrontPublicPath,
  isStorefrontRootFile,
  resolveStorefrontHost,
  storefrontOriginForHost,
  STOREFRONT_INTERNAL_PREFIX,
  STOREFRONT_SITE_HEADER
} from '@/lib/storefront/site'

function withSite(request: NextRequest, site: string, rewritePath?: string) {
  const headers = new Headers(request.headers)
  headers.set(STOREFRONT_SITE_HEADER, site)
  if (rewritePath) {
    const url = request.nextUrl.clone()
    url.pathname = rewritePath
    return NextResponse.rewrite(url, { request: { headers } })
  }
  return NextResponse.next({ request: { headers } })
}

function isInternalPath(pathname: string): boolean {
  return pathname === STOREFRONT_INTERNAL_PREFIX || pathname.startsWith(`${STOREFRONT_INTERNAL_PREFIX}/`)
}

/**
 * Storefront kérések: saját host (aldomain / saját domain) vagy path-mód az app hoston.
 * null → nem bolt kérés, az app middleware fut tovább.
 */
export async function handleStorefrontRequest(
  request: NextRequest,
  hostname: string
): Promise<NextResponse | null> {
  const { pathname, search } = request.nextUrl

  if (isInternalPath(pathname)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const resolved = await resolveStorefrontHost(hostname)
  if (resolved) {
    const { site, primaryHost } = resolved
    const method = request.method
    if (
      hostname !== primaryHost &&
      (method === 'GET' || method === 'HEAD') &&
      !pathname.startsWith('/api/') &&
      !pathname.startsWith('/_next/')
    ) {
      return NextResponse.redirect(
        `${storefrontOriginForHost(primaryHost)}${pathname}${search}`,
        301
      )
    }

    if (pathname === '/' || isStorefrontPublicPath(pathname) || isStorefrontRootFile(pathname)) {
      return withSite(request, site, internalStorefrontPath(site, pathname))
    }
    if (
      pathname.startsWith('/api/storefront/') ||
      pathname.startsWith('/_next/') ||
      pathname.includes('.')
    ) {
      return withSite(request, site)
    }
    return withSite(request, site, internalStorefrontPath(site, '/bolt/__nincs'))
  }

  if (isStorefrontPublicPath(pathname)) {
    const site = demoSiteSlug()
    return withSite(request, site, internalStorefrontPath(site, pathname))
  }
  if (pathname.startsWith('/api/storefront/')) {
    return withSite(request, demoSiteSlug())
  }
  return null
}
