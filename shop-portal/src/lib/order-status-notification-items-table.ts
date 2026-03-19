/**
 * Server-built HTML table for order line items (e-mail safe: escaped text, http(s) images only).
 */

export type OrderItemRowForEmail = {
  product_name: string
  product_sku: string
  quantity: number
  line_total_gross: number | string | null
  product_image_url: string | null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  const t = url.trim()
  if (t.startsWith('https://') || t.startsWith('http://')) return escapeHtml(t)
  return null
}

export function formatOrderMoney(amount: number, currencyCode: string): string {
  const code = (currencyCode || 'HUF').trim().toUpperCase() || 'HUF'
  const n = Number.isFinite(amount) ? amount : 0
  try {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(n)
  } catch {
    return `${Math.round(n)} ${code}`
  }
}

/** Class for the product-image column; hidden on narrow viewports (progressive enhancement). */
const IMG_COL_CLASS = 'order-items-col-img'

const ORDER_ITEMS_TABLE_RESPONSIVE_STYLE = `<style type="text/css">
@media only screen and (max-width: 600px) {
  .${IMG_COL_CLASS} {
    display: none !important;
    width: 0 !important;
    max-width: 0 !important;
    padding: 0 !important;
    border: none !important;
    overflow: hidden !important;
    font-size: 0 !important;
    line-height: 0 !important;
    visibility: hidden !important;
  }
}
</style>`

/**
 * Minimal Notion/Figma-adjacent styling (inline for e-mail clients).
 */
export function buildOrderItemsTableHtml(
  items: OrderItemRowForEmail[],
  orderTotalFormatted: string,
  currencyCode: string
): string {
  const cur = (currencyCode || 'HUF').trim().toUpperCase() || 'HUF'

  if (!items.length) {
    return `<p style="margin:12px 0;font-size:14px;color:#787774;">Nincs megjeleníthető tétel.</p>`
  }

  const rows = items.map((item) => {
    const name = escapeHtml((item.product_name || '—').trim())
    const sku = escapeHtml((item.product_sku || '—').trim())
    const qty = Math.max(0, Math.floor(Number(item.quantity) || 0))
    const lineGross =
      item.line_total_gross != null && item.line_total_gross !== ''
        ? Number(item.line_total_gross)
        : 0
    const lineFmt = formatOrderMoney(lineGross, cur)
    const imgUrl = safeImageUrl(item.product_image_url)
    const imgCell = imgUrl
      ? `<img src="${imgUrl}" alt="" width="44" height="44" style="display:block;border-radius:8px;object-fit:cover;border:1px solid #E9E9E7;" />`
      : `<div style="width:44px;height:44px;border-radius:8px;background:#F7F6F3;border:1px solid #E9E9E7;"></div>`

    return `<tr>
<td class="${IMG_COL_CLASS}" style="width:52px;vertical-align:middle;padding:10px 8px;border-bottom:1px solid #ECECEA;">${imgCell}</td>
<td style="vertical-align:middle;padding:10px 8px;border-bottom:1px solid #ECECEA;color:#37352F;">${name}</td>
<td style="vertical-align:middle;padding:10px 8px;border-bottom:1px solid #ECECEA;color:#787774;font-size:13px;">${sku}</td>
<td style="vertical-align:middle;text-align:right;padding:10px 8px;border-bottom:1px solid #ECECEA;color:#37352F;">${qty}</td>
<td style="vertical-align:middle;text-align:right;padding:10px 8px;border-bottom:1px solid #ECECEA;color:#37352F;font-weight:500;">${escapeHtml(lineFmt)}</td>
</tr>`
  })

  const totalCell = escapeHtml(orderTotalFormatted)

  return `${ORDER_ITEMS_TABLE_RESPONSIVE_STYLE}
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;border-collapse:collapse;margin:16px 0;font-size:14px;line-height:1.45;color:#37352F;">
<thead>
<tr>
<th class="${IMG_COL_CLASS}" style="text-align:left;padding:8px 8px 8px 8px;border-bottom:1px solid #E0E0DE;font-weight:600;font-size:12px;color:#787774;text-transform:uppercase;letter-spacing:0.02em;"></th>
<th style="text-align:left;padding:8px 8px 8px 8px;border-bottom:1px solid #E0E0DE;font-weight:600;font-size:12px;color:#787774;text-transform:uppercase;letter-spacing:0.02em;">Termék</th>
<th style="text-align:left;padding:8px 8px 8px 8px;border-bottom:1px solid #E0E0DE;font-weight:600;font-size:12px;color:#787774;text-transform:uppercase;letter-spacing:0.02em;">Cikkszám</th>
<th style="text-align:right;padding:8px 8px 8px 8px;border-bottom:1px solid #E0E0DE;font-weight:600;font-size:12px;color:#787774;text-transform:uppercase;letter-spacing:0.02em;">Menny.</th>
<th style="text-align:right;padding:8px 8px 8px 8px;border-bottom:1px solid #E0E0DE;font-weight:600;font-size:12px;color:#787774;text-transform:uppercase;letter-spacing:0.02em;">Összeg</th>
</tr>
</thead>
<tbody>
${rows.join('')}
</tbody>
<tfoot>
<tr>
<td colspan="4" style="text-align:right;padding:12px 8px 8px 8px;border-top:1px solid #E0E0DE;font-weight:600;color:#37352F;">Összesen (bruttó)</td>
<td style="text-align:right;padding:12px 8px 8px 8px;border-top:1px solid #E0E0DE;font-weight:600;color:#37352F;">${totalCell}</td>
</tr>
</tfoot>
</table>`
}

/** Demo table for test e-mail and UI understanding. */
export function buildSampleOrderItemsTableHtml(): string {
  return buildOrderItemsTableHtml(
    [
      {
        product_name: 'Minta termék A',
        product_sku: 'SKU-001',
        quantity: 2,
        line_total_gross: 5990,
        product_image_url: null
      },
      {
        product_name: 'Minta termék B',
        product_sku: 'SKU-002',
        quantity: 1,
        line_total_gross: 6999,
        product_image_url: null
      }
    ],
    '12 990 Ft',
    'HUF'
  )
}
