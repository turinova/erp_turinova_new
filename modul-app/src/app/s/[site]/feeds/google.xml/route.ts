import { buildFeed, shippingFor } from '@/lib/storefront/feed'
import { getStorefrontShell } from '@/lib/storefront/shell'
import { siteUrl, STOREFRONT_HOME } from '@/lib/storefront/url'

export const revalidate = 3600

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

function tag(name: string, value: string | number | null | undefined): string {
  if (value == null || value === '') return ''
  return `<g:${name}>${esc(String(value))}</g:${name}>`
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ site: string }> }
) {
  const shell = await getStorefrontShell((await params).site)
  if (!shell) return new Response('Not found', { status: 404 })
  const { ctx, items } = await buildFeed(shell)

  const entries = items.map((it) => {
    const ship = shippingFor(ctx, it.priceGross)
    return [
      '<item>',
      tag('id', it.id),
      tag('title', it.title.slice(0, 150)),
      tag('description', it.description.slice(0, 5000)),
      tag('link', it.url),
      tag('image_link', it.imageUrl),
      ...it.additionalImageUrls.map((u) => tag('additional_image_link', u)),
      tag('availability', it.inStock ? 'in_stock' : 'out_of_stock'),
      tag('price', `${it.priceGross} HUF`),
      tag('condition', 'new'),
      tag('brand', it.brand),
      tag('gtin', it.gtin),
      tag('mpn', it.mpn),
      it.identifierExists ? '' : tag('identifier_exists', 'no'),
      it.hasVariations ? tag('item_group_id', it.groupId) : '',
      tag('color', it.color),
      tag('size', it.size),
      tag('material', it.material),
      tag('google_product_category', it.googleCategory),
      tag('product_type', it.productCategory),
      it.dimensionsCm ? tag('product_length', `${it.dimensionsCm.length} cm`) : '',
      it.dimensionsCm ? tag('product_width', `${it.dimensionsCm.width} cm`) : '',
      it.dimensionsCm ? tag('product_height', `${it.dimensionsCm.height} cm`) : '',
      tag('product_weight', it.weightKg ? `${it.weightKg} kg` : null),
      tag('shipping_weight', it.shippingWeightKg ? `${it.shippingWeightKg} kg` : null),
      ship != null
        ? `<g:shipping>${tag('country', 'HU')}${tag('price', `${ship} HUF`)}</g:shipping>`
        : '',
      '</item>'
    ]
      .filter(Boolean)
      .join('')
  })

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '<channel>',
    `<title>${esc(ctx.sellerName)}</title>`,
    `<link>${esc(siteUrl(shell.tenant.base, STOREFRONT_HOME))}</link>`,
    `<description>${esc(`${ctx.sellerName} termékfeed`)}</description>`,
    ...entries,
    '</channel>',
    '</rss>'
  ].join('\n')

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
