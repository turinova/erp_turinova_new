/**
 * Közös schema.org csomópontok a storefronthoz (JSON-LD @graph).
 */

import type { StorefrontCard } from '@/lib/storefront/catalog'
import type { StorefrontSeller } from '@/lib/storefront/shell'
import {
  categoryPath,
  productPath,
  siteUrl,
  STOREFRONT_HOME,
  STOREFRONT_SEARCH,
  type SiteBase
} from '@/lib/storefront/url'
import { STATUTORY_RETURN_DAYS, type StorefrontSettings } from '@/lib/webshop/settings'

export function orgId(base: SiteBase): string {
  return siteUrl(base, `${STOREFRONT_HOME}#org`)
}

export function websiteId(base: SiteBase): string {
  return siteUrl(base, `${STOREFRONT_HOME}#website`)
}

export function returnPolicyNode(settings: StorefrontSettings): Record<string, unknown> {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'HU',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: Math.max(
      settings.returnDays ?? STATUTORY_RETURN_DAYS,
      STATUTORY_RETURN_DAYS
    ),
    returnMethod: 'https://schema.org/ReturnByMail',
    ...(settings.termsUrl ? { merchantReturnLink: settings.termsUrl } : {})
  }
}

export function organizationNode(
  seller: StorefrontSeller,
  settings: StorefrontSettings,
  base: SiteBase
): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@type': 'OnlineStore',
    '@id': orgId(base),
    name: seller.name,
    url: siteUrl(base, STOREFRONT_HOME),
    hasMerchantReturnPolicy: returnPolicyNode(settings)
  }
  if (seller.logoUrl) node.logo = seller.logoUrl
  if (seller.email) node.email = seller.email
  if (seller.phone) node.telephone = seller.phone
  if (seller.vatId) node.vatID = seller.vatId
  if (seller.taxNumber) node.taxID = seller.taxNumber
  if (seller.address) {
    node.address = {
      '@type': 'PostalAddress',
      streetAddress: seller.address,
      addressCountry: 'HU'
    }
  }
  if (seller.email || seller.phone) {
    node.contactPoint = {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: 'hu',
      ...(seller.email ? { email: seller.email } : {}),
      ...(seller.phone ? { telephone: seller.phone } : {})
    }
  }
  return node
}

export function websiteNode(
  seller: StorefrontSeller,
  base: SiteBase
): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': websiteId(base),
    name: seller.name,
    url: siteUrl(base, STOREFRONT_HOME),
    inLanguage: 'hu-HU',
    publisher: { '@id': orgId(base) },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl(base, STOREFRONT_SEARCH)}?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  }
}

export function breadcrumbNode(
  items: { name: string; path: string | null }[],
  base: SiteBase
): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.path ? { item: siteUrl(base, it.path) } : {})
    }))
  }
}

export function itemListNode(
  items: StorefrontCard[],
  base: SiteBase,
  offset = 0
): Record<string, unknown> {
  return {
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: offset + i + 1,
      url: siteUrl(base, productPath(c.slug)),
      name: c.title
    }))
  }
}

export function categoryCrumbs(
  sellerName: string,
  chain: { name: string; slug: string }[]
): { name: string; path: string | null }[] {
  return [
    { name: sellerName, path: STOREFRONT_HOME },
    ...chain.map((c) => ({ name: c.name, path: categoryPath(c.slug) }))
  ]
}

export function graph(nodes: Record<string, unknown>[]): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@graph': nodes }
}

/** `</script>` injekció ellen. */
export function jsonLdString(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
