import { buildFeed, shippingFor } from '@/lib/storefront/feed'
import { getStorefrontShell } from '@/lib/storefront/shell'

export const revalidate = 3600

/** OpenAI (ChatGPT shopping) termékfeed — egy JSON objektum soronként. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ site: string }> }
) {
  const shell = await getStorefrontShell((await params).site)
  if (!shell) return new Response('Not found', { status: 404 })
  const { ctx, items } = await buildFeed(shell)

  const lines = items.map((it) => {
    const ship = shippingFor(ctx, it.priceGross)
    const variant: Record<string, string> = {}
    if (it.color) variant.color = it.color
    if (it.size) variant.size = it.size
    const rec: Record<string, unknown> = {
      item_id: it.id,
      title: it.title.slice(0, 150),
      description: it.description.slice(0, 5000),
      url: it.url,
      brand: it.brand,
      seller_name: ctx.sellerName,
      seller_url: ctx.sellerUrl,
      image_url: it.imageUrl,
      availability: it.inStock ? 'in_stock' : 'out_of_stock',
      price: `${it.priceGross} HUF`,
      condition: 'new',
      enable_search: true,
      enable_checkout: false,
      accepts_returns: true,
      return_deadline_in_days: ctx.returnDays
    }
    if (it.additionalImageUrls.length) rec.additional_image_urls = it.additionalImageUrls
    if (it.gtin) rec.gtin = it.gtin
    if (it.mpn) rec.mpn = it.mpn
    if (!it.identifierExists) rec.identifier_exists = false
    if (it.hasVariations && it.groupId) {
      rec.group_id = it.groupId
      rec.listing_has_variations = true
      if (Object.keys(variant).length) rec.variant_dict = variant
    }
    if (it.productCategory) rec.product_category = it.productCategory
    if (it.color) rec.color = it.color
    if (it.size) rec.size = it.size
    if (it.material) rec.material = it.material
    if (it.dimensionsCm) rec.dimensions = { ...it.dimensionsCm, unit: 'cm' }
    if (it.weightKg) {
      rec.weight = it.weightKg
      rec.item_weight_unit = 'kg'
    }
    if (ship != null) rec.shipping_price = `${ship} HUF`
    if (ctx.termsUrl) {
      rec.return_policy = ctx.termsUrl
      rec.seller_tos = ctx.termsUrl
    }
    if (ctx.privacyUrl) rec.seller_privacy_policy = ctx.privacyUrl
    if (it.reviewCount > 0 && it.starRating != null) {
      rec.review_count = it.reviewCount
      rec.star_rating = it.starRating
    }
    return JSON.stringify(rec)
  })

  return new Response(lines.join('\n') + (lines.length ? '\n' : ''), {
    headers: {
      'Content-Type': 'application/jsonl; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
