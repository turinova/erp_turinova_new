import type { MetadataRoute } from 'next'

import { storefrontBaseUrl } from '@/lib/storefront/url'

export const revalidate = 3600

/** App/marketing host. A boltok sitemapje a saját hostjukon: /sitemap.xml → /s/[site]/sitemap.xml. */
const MARKETING_PATHS = [
  '/',
  '/arak',
  '/hogyan-mukodik',
  '/lapszabaszat',
  '/egyedi-modulok',
  '/jelenleti-iv',
  '/beleposzamlalo',
  '/a-tortenetunk',
  '/esettanulmany',
  '/kapcsolat'
]

export default function sitemap(): MetadataRoute.Sitemap {
  const base = storefrontBaseUrl()
  return MARKETING_PATHS.map((p) => ({ url: `${base}${p}` }))
}
