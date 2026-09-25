/**
 * Publikus PDP adat + JSON-LD (doc 38 fázis B).
 * Variant siblings: web_group_id — tengely = amiben a tagok eltérnek (pdp-specs).
 * Kulcsadatok: kategória sablon.
 * Bizalom: tenant_webshop_settings, értékelés, valós eladás (RPC).
 */

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  effectiveWebBrand,
  effectiveWebTitle,
  mapAccessoryWebFields,
  WEB_SELECT_COLUMNS
} from '@/lib/accessories/web-shop'
import { grossFromNet } from '@/lib/sheet-materials/parse'
import { getTenantCompany } from '@/lib/company/queries'
import { getAccessoriesOnHandMap } from '@/lib/stock/queries'
import {
  buildKeySpecs,
  buildSpecRows,
  computeVariantAxes,
  loadPdpSpecContext,
  type PublicPdpKeySpec,
  type PublicPdpSpecRow,
  type PublicPdpVariantAxis
} from '@/lib/storefront/pdp-specs'
import type { StorefrontTenant } from '@/lib/storefront/resolve-tenant'
import {
  baseQuantity,
  netContentLabel,
  netContentOf,
  type NetContent
} from '@/lib/storefront/unit-price'
import { loadExpectedArrivals } from '@/lib/storefront/expected-arrival'
import { buildSeller, type StorefrontSeller } from '@/lib/storefront/shell'
import { loadVariantGroupPrefs } from '@/lib/storefront/variant-groups'
import type { DocumentKind } from '@/lib/accessories/document-kinds'
import {
  getStorefrontSettings,
  type StorefrontSettings
} from '@/lib/webshop/settings'

const PDP_SELECT = `
  id,
  name,
  sku,
  barcode,
  image_url,
  price_net,
  active,
  sellable_web,
  web_category_id,
  updated_at,
  ${WEB_SELECT_COLUMNS},
  manufacturers ( name, legal_name, postal_address, email, website, eu_rep_name, eu_rep_address, eu_rep_email ),
  tax_rates ( rate_percent )
`

const CARD_SELECT = `
  id,
  sku,
  barcode,
  web_gtin,
  image_url,
  price_net,
  web_slug,
  web_color,
  web_size,
  web_title,
  web_net_quantity,
  web_net_unit,
  web_multipack,
  name,
  tax_rates ( rate_percent )
`

/** Social proof csak e felett — kis szám inkább gyengít. */
const SOLD_COUNT_MIN = 5
const REVIEWS_ON_PAGE = 6

export type { PublicPdpKeySpec, PublicPdpSpecRow, PublicPdpVariantAxis }

export type PublicPdpVariant = {
  id: string
  slug: string
  /** tengely kulcs → érték */
  values: Record<string, { label: string; sort: number | null }>
  imageUrl: string | null
  title: string
  priceGross: number
  netContent: NetContent | null
  inStock: boolean
  current: boolean
  sku: string
  gtin: string | null
}

export type PublicPdpCard = {
  id: string
  slug: string
  title: string
  imageUrl: string | null
  priceGross: number
}

export type PublicPdpPriceTier = {
  minQty: number
  unitGross: number
}

export type PublicPdpReview = {
  id: string
  authorName: string
  rating: number
  title: string | null
  body: string
  variantLabel: string | null
  sellerReply: string | null
  createdAt: string
}

export type PublicPdpReviews = {
  enabled: boolean
  count: number
  average: number
  /** index 0 = 5 csillag … index 4 = 1 csillag */
  distribution: [number, number, number, number, number]
  items: PublicPdpReview[]
}

export type PublicPdpProduct = {
  id: string
  slug: string
  title: string
  descriptionShort: string | null
  descriptionLong: string | null
  brand: string | null
  sku: string
  gtin: string | null
  mpn: string | null
  imageUrl: string | null
  gallery: string[]
  priceNet: number
  priceGross: number
  /** Előző 30 nap legalacsonyabb bruttó ára — csak ha magasabb a mostaninál. */
  referencePriceGross: number | null
  vatPercent: number
  inStock: boolean
  onHand: number
  productType: string | null
  color: string | null
  size: string | null
  material: string | null
  groupId: string | null
  /** Kulcsadat-kártyák — csak kitöltött érték. */
  keySpecs: PublicPdpKeySpec[]
  specRows: PublicPdpSpecRow[]
  /** Termék méretrajza, vagy (ha van kulcsadat) a kategória mérési ábrája. */
  measureImageUrl: string | null
  faq: { q: string; a: string }[]
  useCases: string[]
  compatibility: string[]
  boxContents: string[]
  priceTiers: PublicPdpPriceTier[]
  variantAxes: PublicPdpVariantAxis[]
  variants: PublicPdpVariant[]
  /** Aktuális variáns tengely-értékei (értékeléshez, sticky sávhoz). */
  variantLabel: string | null
  /** Webkategória útvonal, gyökértől. */
  categoryPath: string[]
  categoryId: string | null
  googleCategory: string | null
  /** Kép URL → leírás. */
  imageAlts: Record<string, string>
  identifierExists: boolean
  /** Termék (nem csomag) méretei. */
  dimensions: {
    lengthCm: number | null
    widthCm: number | null
    heightCm: number | null
    weightKg: number | null
  }
  updatedAt: string | null
  manufacturer: PublicPdpManufacturer | null
  safetyInfo: string | null
  netContent: NetContent | null
  ingredients: string | null
  usage: string | null
  videoUrl: string | null
  /** Legkorábbi nyitott beszállítói rendelés várható napja (YYYY-MM-DD), csak ha nincs készlet. */
  expectedArrival: string | null
  /** ISO 3166-1 alpha-2. */
  countryOfOrigin: string | null
  /** Egy vásárlási egységben lévő azonos darabok száma (≥2). */
  multipack: number | null
  isBundle: boolean
  documents: PublicPdpDocument[]
}

export type PublicPdpDocument = {
  id: string
  kind: DocumentKind
  title: string
  language: string
  url: string
  sizeBytes: number
}

export type PublicPdpManufacturer = {
  name: string
  address: string | null
  email: string | null
  website: string | null
  euRepName: string | null
  euRepAddress: string | null
  euRepEmail: string | null
}

export type PublicPdpSeller = StorefrontSeller

export type PublicPdpPayload = {
  tenant: StorefrontTenant
  seller: PublicPdpSeller
  settings: StorefrontSettings
  product: PublicPdpProduct
  soldLast30Days: number | null
  reviews: PublicPdpReviews
  boughtTogether: PublicPdpCard[]
}

function asGallery(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter(Boolean)
}

function vatOf(row: Record<string, unknown>): number {
  const tax = Array.isArray(row.tax_rates) ? row.tax_rates[0] : row.tax_rates
  return Number((tax as { rate_percent?: number } | null)?.rate_percent ?? 0)
}

function trimOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function toCard(row: Record<string, unknown>): PublicPdpCard | null {
  const slug =
    typeof row.web_slug === 'string' ? row.web_slug.trim().toLowerCase() : ''
  if (!slug) return null
  return {
    id: String(row.id),
    slug,
    title: effectiveWebTitle({
      web_title: typeof row.web_title === 'string' ? row.web_title : null,
      name: String(row.name ?? '')
    }),
    imageUrl: trimOrNull(row.image_url),
    priceGross: grossFromNet(Number(row.price_net), vatOf(row))
  }
}

type SiblingRow = {
  card: PublicPdpCard
  sku: string
  gtin: string | null
  webColor: string | null
  webSize: string | null
  netContent: NetContent | null
  inStock: boolean
}

async function loadVariantSiblings(
  admin: SupabaseClient,
  tenantId: string,
  groupId: string | null
): Promise<SiblingRow[]> {
  if (!groupId) return []

  const { data, error } = await admin
    .from('storefront_products')
    .select(CARD_SELECT)
    .eq('tenant_id', tenantId)
    .eq('web_group_id', groupId)
    .eq('sellable_web', true)
    .eq('active', true)
    .is('deleted_at', null)
    .not('web_slug', 'is', null)
    .limit(48)

  if (error) {
    console.error('loadVariantSiblings', error.message)
    return []
  }

  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  let stock = new Map<string, number>()
  try {
    stock = await getAccessoriesOnHandMap(
      admin,
      tenantId,
      rows.map((r) => String(r.id))
    )
  } catch (e) {
    console.error('loadVariantSiblings stock', e)
  }

  return rows
    .map((row) => {
      const card = toCard(row)
      if (!card) return null
      return {
        card,
        sku: String(row.sku ?? ''),
        gtin: trimOrNull(row.web_gtin) ?? trimOrNull(row.barcode),
        webColor: trimOrNull(row.web_color),
        webSize: trimOrNull(row.web_size),
        netContent: netContentOf(row.web_net_quantity, row.web_net_unit, row.web_multipack),
        inStock: (stock.get(card.id) ?? 0) > 0
      } satisfies SiblingRow
    })
    .filter((v): v is SiblingRow => v != null)
}

/** Azonos tengely-kombinációból csak egy (az aktuális, különben az első). */
function dedupeVariants(
  variants: PublicPdpVariant[],
  axes: PublicPdpVariantAxis[]
): PublicPdpVariant[] {
  const sig = (v: PublicPdpVariant) =>
    axes.map((a) => (v.values[a.key]?.label ?? '').toLocaleLowerCase('hu')).join('|')
  const bySig = new Map<string, PublicPdpVariant>()
  for (const v of variants) {
    const k = sig(v)
    const prev = bySig.get(k)
    if (!prev) {
      bySig.set(k, v)
    } else {
      console.warn('PDP variant collision', k, prev.id, v.id)
      if (v.current) bySig.set(k, v)
    }
  }
  return [...bySig.values()]
}

const DOCUMENTS_ON_PAGE = 20

async function loadDocuments(
  admin: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<PublicPdpDocument[]> {
  const { data, error } = await admin
    .from('accessory_documents')
    .select('id, kind, title, language, media_files ( public_url, size_bytes, mime_type )')
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(DOCUMENTS_ON_PAGE)
  if (error) {
    // 20260547 előtt a tábla még nem létezik — a PDP ettől még működjön.
    console.error('loadDocuments', error.message)
    return []
  }
  const out: PublicPdpDocument[] = []
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const m = (Array.isArray(r.media_files) ? r.media_files[0] : r.media_files) as
      | { public_url?: string; size_bytes?: number; mime_type?: string }
      | null
    if (!m?.public_url || m.mime_type !== 'application/pdf') continue
    out.push({
      id: String(r.id),
      kind: r.kind as DocumentKind,
      title: String(r.title ?? ''),
      language: String(r.language ?? 'hu'),
      url: m.public_url,
      sizeBytes: Number(m.size_bytes ?? 0)
    })
  }
  return out
}

async function loadSoldLast30(
  admin: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<number | null> {
  const { data, error } = await admin.rpc('storefront_sold_quantity', {
    p_tenant_id: tenantId,
    p_accessory_id: accessoryId,
    p_days: 30
  })
  if (error) {
    console.error('loadSoldLast30', error.message)
    return null
  }
  const n = Math.floor(Number(data ?? 0))
  return Number.isFinite(n) && n >= SOLD_COUNT_MIN ? n : null
}

async function loadReferencePriceNet(
  admin: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<number | null> {
  const { data, error } = await admin.rpc('storefront_reference_price', {
    p_tenant_id: tenantId,
    p_accessory_id: accessoryId
  })
  if (error) {
    console.error('loadReferencePriceNet', error.message)
    return null
  }
  const n = data == null ? NaN : Number(data)
  return Number.isFinite(n) && n > 0 ? n : null
}

function toManufacturer(value: unknown): PublicPdpManufacturer | null {
  const m = (Array.isArray(value) ? value[0] : value) as Record<
    string,
    unknown
  > | null
  const name = trimOrNull(m?.legal_name) ?? trimOrNull(m?.name)
  if (!m || !name) return null
  return {
    name,
    address: trimOrNull(m.postal_address),
    email: trimOrNull(m.email),
    website: trimOrNull(m.website),
    euRepName: trimOrNull(m.eu_rep_name),
    euRepAddress: trimOrNull(m.eu_rep_address),
    euRepEmail: trimOrNull(m.eu_rep_email)
  }
}

async function loadBoughtTogether(
  admin: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<PublicPdpCard[]> {
  const { data, error } = await admin.rpc('storefront_bought_together', {
    p_tenant_id: tenantId,
    p_accessory_id: accessoryId,
    p_limit: 4
  })
  if (error) {
    console.error('loadBoughtTogether', error.message)
    return []
  }
  const ids = ((data ?? []) as { accessory_id: string }[]).map((r) => r.accessory_id)
  if (ids.length === 0) return []

  const { data: rows, error: rowsError } = await admin
    .from('storefront_products')
    .select(CARD_SELECT)
    .eq('tenant_id', tenantId)
    .in('id', ids)
    .eq('sellable_web', true)
    .eq('active', true)
    .is('deleted_at', null)

  if (rowsError) {
    console.error('loadBoughtTogether rows', rowsError.message)
    return []
  }

  const byId = new Map(
    ((rows ?? []) as unknown as Record<string, unknown>[])
      .map((r) => toCard(r))
      .filter((c): c is PublicPdpCard => c != null)
      .map((c) => [c.id, c])
  )
  return ids.map((id) => byId.get(id)).filter((c): c is PublicPdpCard => c != null)
}

const EMPTY_REVIEWS: PublicPdpReviews = {
  enabled: false,
  count: 0,
  average: 0,
  distribution: [0, 0, 0, 0, 0],
  items: []
}

async function loadReviews(
  admin: SupabaseClient,
  tenantId: string,
  accessoryId: string,
  enabled: boolean
): Promise<PublicPdpReviews> {
  if (!enabled) return EMPTY_REVIEWS

  const [ratings, latest] = await Promise.all([
    admin
      .from('product_reviews')
      .select('rating')
      .eq('tenant_id', tenantId)
      .eq('accessory_id', accessoryId)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .limit(2000),
    admin
      .from('product_reviews')
      .select(
        'id, author_name, rating, title, body, variant_label, seller_reply, created_at'
      )
      .eq('tenant_id', tenantId)
      .eq('accessory_id', accessoryId)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(REVIEWS_ON_PAGE)
  ])

  if (ratings.error || latest.error) {
    console.error(
      'loadReviews',
      ratings.error?.message ?? latest.error?.message
    )
    return { ...EMPTY_REVIEWS, enabled: true }
  }

  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  let sum = 0
  for (const r of ratings.data ?? []) {
    const rating = Number(r.rating)
    if (rating < 1 || rating > 5) continue
    distribution[5 - rating] += 1
    sum += rating
  }
  const count = distribution.reduce((a, b) => a + b, 0)

  return {
    enabled: true,
    count,
    average: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
    distribution,
    items: (latest.data ?? []).map((r) => ({
      id: String(r.id),
      authorName: String(r.author_name ?? ''),
      rating: Number(r.rating),
      title: (r.title as string | null) ?? null,
      body: String(r.body ?? ''),
      variantLabel: (r.variant_label as string | null) ?? null,
      sellerReply: (r.seller_reply as string | null) ?? null,
      createdAt: String(r.created_at)
    }))
  }
}

export const getPublicPdpBySlugCached = cache(
  (admin: SupabaseClient, tenant: StorefrontTenant, slug: string) =>
    getPublicPdpBySlug(admin, tenant, slug)
)

export async function getPublicPdpBySlug(
  admin: SupabaseClient,
  tenant: StorefrontTenant,
  slug: string
): Promise<PublicPdpPayload | null> {
  const normalized = slug.trim().toLowerCase()
  if (!normalized) return null

  const { data, error } = await admin
    .from('storefront_products')
    .select(PDP_SELECT)
    .eq('tenant_id', tenant.id)
    .ilike('web_slug', normalized)
    .eq('sellable_web', true)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getPublicPdpBySlug', error.message)
    return null
  }
  if (!data) return null

  const row = data as unknown as Record<string, unknown>
  const id = String(row.id)
  const web = mapAccessoryWebFields(row)
  const manufacturer = Array.isArray(row.manufacturers)
    ? row.manufacturers[0]
    : row.manufacturers
  const vatPercent = vatOf(row)
  const priceNet = Number(row.price_net)
  const priceGross = grossFromNet(priceNet, vatPercent)
  const manufacturerName =
    (manufacturer as { name?: string } | null)?.name ?? null

  const title = effectiveWebTitle({
    web_title: web.web_title,
    name: String(row.name ?? '')
  })
  const brand = effectiveWebBrand({
    web_brand: web.web_brand,
    manufacturer_name: manufacturerName
  })

  const primary = trimOrNull(row.image_url)
  const galleryExtra = asGallery(web.web_gallery).filter((u) => u !== primary)
  const gallery = primary ? [primary, ...galleryExtra] : galleryExtra

  const settings = await getStorefrontSettings(admin, tenant.id)

  const [
    stockMap,
    company,
    siblingData,
    soldLast30Days,
    reviews,
    boughtTogether,
    referenceNet,
    arrivals,
    documents
  ] = await Promise.all([
      getAccessoriesOnHandMap(admin, tenant.id, [id]).catch((e) => {
        console.error('getPublicPdpBySlug stock', e)
        return new Map<string, number>()
      }),
      getTenantCompany(admin, tenant.id).catch(() => null),
      loadVariantSiblings(admin, tenant.id, web.web_group_id).then(async (list) => ({
        list,
        prefs: list.length > 0 && web.web_group_id
          ? (await loadVariantGroupPrefs(admin, tenant.id, [web.web_group_id])).get(web.web_group_id.trim().toLowerCase()) ?? null
          : null
      })),
      settings.showSoldCount
        ? loadSoldLast30(admin, tenant.id, id)
        : Promise.resolve(null),
      loadReviews(admin, tenant.id, id, settings.reviewsEnabled),
      loadBoughtTogether(admin, tenant.id, id),
      loadReferencePriceNet(admin, tenant.id, id),
      loadExpectedArrivals(admin, tenant.id, [id]),
      loadDocuments(admin, tenant.id, id)
    ])

  const onHand = stockMap.get(id) ?? 0
  const { list: siblings, prefs: groupPrefs } = siblingData

  const members = siblings.some((s) => s.card.id === id)
    ? siblings
    : [
        {
          card: {
            id,
            slug: web.web_slug || normalized,
            title,
            imageUrl: primary,
            priceGross
          },
          sku: String(row.sku ?? ''),
          gtin: web.web_gtin || (row.barcode as string | null) || null,
          webColor: web.web_color,
          webSize: web.web_size,
          netContent: netContentOf(web.web_net_quantity, web.web_net_unit, web.web_multipack),
          inStock: onHand > 0
        },
        ...siblings
      ]

  const specCtx = await loadPdpSpecContext(
    admin,
    tenant.id,
    (row.web_category_id as string | null) ?? null,
    members.map((m) => m.card.id)
  )
  const keySpecs = buildKeySpecs(specCtx, id)
  const specRows = buildSpecRows(specCtx, id, web.web_specs ?? {}, {
    lengthCm: web.product_length_cm,
    widthCm: web.product_width_cm,
    heightCm: web.product_height_cm,
    weightKg: web.product_weight_kg
  })

  const axisSources = members.map((m) => ({
    id: m.card.id,
    webColor: m.webColor,
    webSize: m.webSize,
    pack: m.netContent
      ? { label: netContentLabel(m.netContent), sort: baseQuantity(m.netContent) }
      : null
  }))
  const { axes: variantAxes, valuesOf } =
    members.length > 1
      ? computeVariantAxes(specCtx, axisSources, groupPrefs?.axes ?? [])
      : { axes: [] as PublicPdpVariantAxis[], valuesOf: () => ({}) }

  const variants =
    variantAxes.length > 0
      ? dedupeVariants(
          members.map((m) => ({
            id: m.card.id,
            slug: m.card.slug,
            values: valuesOf(m.card.id),
            imageUrl: m.card.imageUrl,
            title: m.card.title,
            priceGross: m.card.priceGross,
            netContent: m.netContent,
            inStock: m.card.id === id ? onHand > 0 : m.inStock,
            current: m.card.id === id,
            sku: m.sku,
            gtin: m.gtin
          })),
          variantAxes
        )
      : []

  const currentValues = variants.find((v) => v.current)?.values ?? {}
  const variantLabel =
    variantAxes
      .map((a) => currentValues[a.key]?.label)
      .filter(Boolean)
      .join(' · ') ||
    [web.web_color, web.web_size].filter(Boolean).join(' · ') ||
    null

  const measureImageUrl =
    web.web_dimension_image_url ||
    (keySpecs.length > 0 ? specCtx.template.measureImageUrl : null)

  const seller = buildSeller(company, tenant)

  const referenceGross =
    referenceNet != null ? grossFromNet(referenceNet, vatPercent) : null
  const referencePriceGross =
    referenceGross != null && referenceGross > priceGross ? referenceGross : null

  const priceTiers = web.web_price_tiers
    .filter((t) => t.price_net < priceNet)
    .map((t) => ({
      minQty: t.min_qty,
      unitGross: grossFromNet(t.price_net, vatPercent)
    }))

  return {
    tenant,
    seller,
    settings,
    soldLast30Days,
    reviews,
    boughtTogether,
    product: {
      id,
      slug: web.web_slug || normalized,
      title,
      descriptionShort: web.web_description_short,
      descriptionLong: web.web_description_long,
      brand: brand || null,
      sku: String(row.sku ?? ''),
      gtin: web.web_gtin || (row.barcode as string | null) || null,
      mpn: web.web_mpn,
      imageUrl: primary,
      gallery,
      priceNet,
      priceGross,
      referencePriceGross,
      vatPercent,
      inStock: onHand > 0,
      onHand,
      productType: web.web_product_type,
      color: web.web_color,
      size: web.web_size,
      material: web.web_material,
      groupId: web.web_group_id,
      keySpecs,
      specRows,
      measureImageUrl,
      faq: web.web_faq ?? [],
      useCases: web.web_use_cases,
      compatibility: web.web_compatibility,
      boxContents: web.web_box_contents,
      priceTiers,
      variantAxes,
      variants,
      variantLabel,
      categoryPath: specCtx.categoryPath,
      categoryId: (row.web_category_id as string | null) ?? null,
      googleCategory: web.web_google_category,
      imageAlts: web.web_image_alts,
      identifierExists: web.web_identifier_exists,
      dimensions: {
        lengthCm: web.product_length_cm,
        widthCm: web.product_width_cm,
        heightCm: web.product_height_cm,
        weightKg: web.product_weight_kg
      },
      updatedAt: (row.updated_at as string | null) ?? null,
      manufacturer: toManufacturer(row.manufacturers),
      safetyInfo: web.web_safety_info,
      netContent: netContentOf(web.web_net_quantity, web.web_net_unit, web.web_multipack),
      ingredients: web.web_ingredients,
      usage: web.web_usage,
      videoUrl: web.web_video_url,
      expectedArrival: onHand > 0 ? null : (arrivals.get(id) ?? null),
      countryOfOrigin: web.web_country_of_origin,
      multipack: web.web_multipack,
      isBundle: web.web_is_bundle,
      documents
    }
  }
}
