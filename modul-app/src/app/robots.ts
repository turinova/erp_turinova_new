import type { MetadataRoute } from 'next'

import { storefrontRootDomain } from '@/lib/storefront/site'
import { storefrontBaseUrl } from '@/lib/storefront/url'

/** App/marketing host. A boltok robots.txt-je a saját hostjukon: /s/[site]/robots.txt. */
const PRIVATE = ['/api/', '/login', '/auth/', '/partner/', '/platform/']
/** Saját hostos boltnál az app hoston futó path-mód másolat ne indexelődjön. */
const STORE_COPY = ['/bolt/', '/p/', '/feeds/']

export default function robots(): MetadataRoute.Robots {
  const disallow = storefrontRootDomain() ? [...PRIVATE, ...STORE_COPY] : PRIVATE
  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: `${storefrontBaseUrl()}/sitemap.xml`
  }
}
