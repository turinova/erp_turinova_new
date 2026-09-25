/**
 * PDP JSON-LD @graph: Organization + (ProductGroup | Product) + BreadcrumbList + FAQPage.
 * Variánsoldalanként ugyanaz a ProductGroup ismétlődik (Google variáns irányelv).
 */

import { DOCUMENT_KIND_LABEL } from '@/lib/accessories/document-kinds'
import type { RelatedCards, StorefrontCard } from '@/lib/storefront/catalog'
import type { PublicPdpPayload } from '@/lib/storefront/pdp'
import {
  breadcrumbNode,
  graph,
  orgId,
  organizationNode,
  returnPolicyNode
} from '@/lib/storefront/structured-data'
import { productPath, siteUrl, type SiteBase } from '@/lib/storefront/url'
import { NET_UNIT_LABEL, schemaReferenceQuantity, unCodeFor } from '@/lib/storefront/unit-price'
import { youtubeIdOf, youtubeThumbnailUrl } from '@/lib/storefront/youtube'
import { unitCodeFor } from '@/lib/webshop/key-specs'

type Node = Record<string, unknown>

/** Szöveges PropertyValue-nál a hosszú mező (összetevők) ne fújja fel a HTML-t. */
const TEXT_PROP_MAX = 1000

function availability(inStock: boolean, expectedArrival?: string | null): string {
  if (inStock) return 'https://schema.org/InStock'
  return expectedArrival ? 'https://schema.org/BackOrder' : 'https://schema.org/OutOfStock'
}

function cardRef(base: SiteBase, c: StorefrontCard): Node {
  return { '@type': 'Product', name: c.title, url: siteUrl(base, productPath(c.slug)) }
}

function textProp(name: string, value: string | null): Node | null {
  const v = value?.trim()
  if (!v) return null
  return {
    '@type': 'PropertyValue',
    name,
    value: v.length > TEXT_PROP_MAX ? `${v.slice(0, TEXT_PROP_MAX - 1)}…` : v
  }
}

function quantity(value: number | null, unitCode: string): Node | null {
  return value != null && value > 0
    ? { '@type': 'QuantitativeValue', value, unitCode }
    : null
}

function shippingDetails(payload: PublicPdpPayload): Node | null {
  const { settings, product } = payload
  if (settings.shippingFeeGross == null) return null
  const free =
    settings.shippingFeeGross === 0 ||
    (settings.freeShippingThresholdGross != null &&
      product.priceGross >= settings.freeShippingThresholdGross)
  const node: Node = {
    '@type': 'OfferShippingDetails',
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'HU' },
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: free ? 0 : settings.shippingFeeGross,
      currency: 'HUF'
    }
  }
  if (settings.deliveryDaysMin != null || settings.deliveryDaysMax != null) {
    const min = settings.deliveryDaysMin ?? settings.deliveryDaysMax ?? 0
    const max = settings.deliveryDaysMax ?? min
    node.deliveryTime = {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: min, maxValue: max, unitCode: 'DAY' }
    }
  }
  return node
}

function mainOffer(payload: PublicPdpPayload, pageUrl: string, base: SiteBase): Node {
  const { product, settings } = payload
  const referenceQuantity = schemaReferenceQuantity(product.netContent)
  const priceSpecification: Node[] = [
    {
      '@type': 'UnitPriceSpecification',
      price: product.priceGross,
      priceCurrency: 'HUF',
      valueAddedTaxIncluded: true,
      ...(referenceQuantity ? { referenceQuantity } : {})
    }
  ]
  if (product.referencePriceGross != null) {
    priceSpecification.push({
      '@type': 'UnitPriceSpecification',
      priceType: 'https://schema.org/StrikethroughPrice',
      price: product.referencePriceGross,
      priceCurrency: 'HUF',
      valueAddedTaxIncluded: true
    })
  }
  for (const t of product.priceTiers) {
    priceSpecification.push({
      '@type': 'UnitPriceSpecification',
      price: t.unitGross,
      priceCurrency: 'HUF',
      valueAddedTaxIncluded: true,
      eligibleQuantity: { '@type': 'QuantitativeValue', minValue: t.minQty, unitCode: 'C62' }
    })
  }
  const offer: Node = {
    '@type': 'Offer',
    url: pageUrl,
    price: product.priceGross,
    priceCurrency: 'HUF',
    priceSpecification,
    availability: availability(product.inStock, product.expectedArrival),
    ...(!product.inStock && product.expectedArrival
      ? { availabilityStarts: product.expectedArrival }
      : {}),
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@id': orgId(base) },
    hasMerchantReturnPolicy: returnPolicyNode(settings)
  }
  const ship = shippingDetails(payload)
  if (ship) offer.shippingDetails = ship
  return offer
}

function productNode(
  payload: PublicPdpPayload,
  pageUrl: string,
  opts: {
    base: SiteBase
    groupId: string | null
    related: RelatedCards
    similar: StorefrontCard[]
  }
): Node {
  const { product, reviews } = payload
  const images = product.gallery.length > 0
    ? product.gallery
    : product.imageUrl
      ? [product.imageUrl]
      : []

  const node: Node = {
    '@type': 'Product',
    '@id': `${pageUrl}#product`,
    name: product.title,
    description: product.descriptionLong || product.descriptionShort || product.title,
    sku: product.sku,
    url: pageUrl,
    offers: mainOffer(payload, pageUrl, opts.base)
  }

  if (images.length > 0) {
    node.image = images.map((url) => {
      const caption = product.imageAlts[url]
      return caption ? { '@type': 'ImageObject', url, caption } : url
    })
  }
  if (product.brand) node.brand = { '@type': 'Brand', name: product.brand }
  if (product.gtin && /^\d{8,14}$/.test(product.gtin)) node.gtin = product.gtin
  if (product.mpn) node.mpn = product.mpn
  if (product.manufacturer) {
    node.manufacturer = { '@type': 'Organization', name: product.manufacturer.name }
  }
  if (product.color) node.color = product.color
  if (product.material) node.material = product.material
  if (product.size) node.size = product.size
  const category = product.categoryPath.join(' > ') || product.productType
  if (category) node.category = category

  const d = product.dimensions
  const depth = quantity(d.lengthCm, 'CMT')
  const width = quantity(d.widthCm, 'CMT')
  const height = quantity(d.heightCm, 'CMT')
  const weight = quantity(d.weightKg, 'KGM')
  if (depth) node.depth = depth
  if (width) node.width = width
  if (height) node.height = height
  if (weight) node.weight = weight

  if (product.countryOfOrigin) {
    node.countryOfOrigin = { '@type': 'Country', name: product.countryOfOrigin }
  }

  const props: Node[] = [...product.keySpecs, ...product.specRows].slice(0, 20).map((p) => {
    const unitCode = unitCodeFor(p.unit)
    return {
      '@type': 'PropertyValue',
      name: p.name,
      value: p.valueNum ?? p.value,
      ...(p.valueNum != null && unitCode ? { unitCode } : {}),
      ...(p.valueNum != null && p.unit ? { unitText: p.unit } : {})
    }
  })
  if (product.netContent && product.netContent.unit !== 'db') {
    props.push({
      '@type': 'PropertyValue',
      name: 'Nettó tartalom',
      value: product.netContent.quantity,
      unitCode: unCodeFor(product.netContent),
      unitText: NET_UNIT_LABEL[product.netContent.unit]
    })
  }
  if (product.multipack != null) {
    props.push({
      '@type': 'PropertyValue',
      name: 'Kiszerelés',
      value: product.multipack,
      unitCode: 'C62',
      unitText: 'db'
    })
  }
  if (product.isBundle) {
    props.push({ '@type': 'PropertyValue', name: 'Csomagajánlat', value: true })
  }
  for (const extra of [
    textProp('Összetevők', product.ingredients),
    textProp('Használat', product.usage),
    textProp('Figyelmeztetés', product.safetyInfo)
  ]) {
    if (extra) props.push(extra)
  }
  if (props.length > 0) node.additionalProperty = props

  const subjectOf: Node[] = []
  if (product.measureImageUrl) {
    subjectOf.push({
      '@type': 'ImageObject',
      url: product.measureImageUrl,
      caption: `${product.title} — méretek`
    })
  }
  const videoId = youtubeIdOf(product.videoUrl)
  if (videoId) {
    subjectOf.push({
      '@type': 'VideoObject',
      name: `${product.title} — videó`,
      description: product.descriptionShort || product.title,
      thumbnailUrl: youtubeThumbnailUrl(videoId),
      embedUrl: `https://www.youtube.com/embed/${videoId}`
    })
  }
  for (const d of product.documents) {
    subjectOf.push({
      '@type': 'DigitalDocument',
      name: d.title,
      url: d.url,
      encodingFormat: 'application/pdf',
      inLanguage: d.language,
      additionalType: DOCUMENT_KIND_LABEL[d.kind]
    })
  }
  if (subjectOf.length > 0) node.subjectOf = subjectOf.length === 1 ? subjectOf[0] : subjectOf

  const { related } = opts
  const relatedTo = [...related.required, ...related.accessory, ...related.largerPack]
  if (relatedTo.length > 0) node.isRelatedTo = relatedTo.map((c) => cardRef(opts.base, c))
  if (related.accessoryOf.length > 0) {
    node.isAccessoryOrSparePartFor = related.accessoryOf.map((c) => cardRef(opts.base, c))
  }
  const seen = new Set<string>()
  const similarTo = [...related.alternative, ...opts.similar].filter((c) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })
  if (similarTo.length > 0) node.isSimilarTo = similarTo.map((c) => cardRef(opts.base, c))

  if (opts.groupId) node.inProductGroupWithID = opts.groupId

  if (reviews.enabled && reviews.count > 0) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviews.average,
      reviewCount: reviews.count
    }
    node.review = reviews.items.slice(0, 3).map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.authorName },
      datePublished: r.createdAt.slice(0, 10),
      reviewRating: { '@type': 'Rating', ratingValue: r.rating },
      reviewBody: r.body
    }))
  }
  return node
}

const VARIES_PROP: Record<string, string> = {
  'https://schema.org/color': 'color',
  'https://schema.org/material': 'material',
  'https://schema.org/pattern': 'pattern',
  'https://schema.org/size': 'size'
}

function variesByFor(axis: { key: string; name: string }): string {
  const name = axis.name.toLowerCase()
  if (axis.key === '__color' || /sz[ií]n|colou?r/.test(name)) return 'https://schema.org/color'
  if (/anyag|material/.test(name)) return 'https://schema.org/material'
  if (/minta|pattern/.test(name)) return 'https://schema.org/pattern'
  return 'https://schema.org/size'
}

export function buildPdpJsonLd(
  payload: PublicPdpPayload,
  opts: {
    base: SiteBase
    pageUrl: string
    crumbs: { name: string; path: string | null }[]
    related: RelatedCards
    similar: StorefrontCard[]
  }
): Node {
  const { product, seller, settings } = payload
  const isGroup = Boolean(product.groupId) && product.variants.length > 1
  const current = productNode(payload, opts.pageUrl, {
    base: opts.base,
    groupId: isGroup ? product.groupId : null,
    related: opts.related,
    similar: opts.similar
  })

  const nodes: Node[] = [organizationNode(seller, settings, opts.base)]

  if (isGroup && product.groupId) {
    const groupId = siteUrl(opts.base, `/bolt#group-${encodeURIComponent(product.groupId)}`)
    current.isVariantOf = { '@id': groupId }
    const variesBy = [
      ...new Set(
        product.variantAxes.map(variesByFor)
      )
    ]
    const axisProps = (v: (typeof product.variants)[number]): Node => {
      const out: Node = {}
      for (const a of product.variantAxes) {
        const prop = VARIES_PROP[variesByFor(a)]
        const label = v.values[a.key]?.label
        if (!prop || !label) continue
        out[prop] = out[prop] ? `${String(out[prop])} / ${label}` : label
      }
      return out
    }
    const currentVariant = product.variants.find((v) => v.current)
    if (currentVariant) Object.assign(current, axisProps(currentVariant))
    const siblings = product.variants
      .filter((v) => !v.current)
      .map((v) => {
        const url = siteUrl(opts.base, productPath(v.slug))
        return {
          '@type': 'Product',
          '@id': `${url}#product`,
          name: v.title,
          url,
          ...(v.sku ? { sku: v.sku } : {}),
          ...(v.gtin && /^\d{8,14}$/.test(v.gtin) ? { gtin: v.gtin } : {}),
          ...axisProps(v),
          ...(v.imageUrl ? { image: v.imageUrl } : {}),
          inProductGroupWithID: product.groupId,
          offers: {
            '@type': 'Offer',
            url,
            price: v.priceGross,
            priceCurrency: 'HUF',
            availability: availability(v.inStock),
            itemCondition: 'https://schema.org/NewCondition'
          }
        }
      })
    nodes.push({
      '@type': 'ProductGroup',
      '@id': groupId,
      name: product.productType || product.title,
      url: opts.pageUrl,
      description: product.descriptionShort || product.descriptionLong || product.title,
      productGroupID: product.groupId,
      variesBy,
      ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
      hasVariant: [{ '@id': current['@id'] }, ...siblings]
    })
  }

  nodes.push(current)
  nodes.push(breadcrumbNode(opts.crumbs, opts.base))

  if (product.faq.length > 0) {
    nodes.push({
      '@type': 'FAQPage',
      '@id': `${opts.pageUrl}#faq`,
      mainEntity: product.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    })
  }

  return graph(nodes)
}
