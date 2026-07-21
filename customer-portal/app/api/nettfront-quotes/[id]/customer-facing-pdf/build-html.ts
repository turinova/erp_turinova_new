import { readFile } from 'fs/promises'
import { join } from 'path'
import { getPortalNettfrontQuoteById } from '@/lib/supabase-server'
import generateNettfrontCustomerFacingPdfHtml from './pdf-template'

export type CustomerFacingBody = {
  preparedBy?: string
  /** YYYY-MM-DD */
  validUntil?: string
  buyer?: {
    name?: string
    phone?: string
    email?: string
    postalCode?: string
    city?: string
    street?: string
    taxNumber?: string
  }
  pricing?: {
    markupPercent?: number
    lineDisplay?: string
    roundTo?: number
  }
  manualLines?: Array<{
    type?: string
    title?: string
    quantity?: number
    unit?: string
    unitPriceGross?: number
  }>
}

export type BuildHtmlResult =
  | {
      ok: true
      html: string
      quoteNumber: string
      portalCustomerId: string
      quoteStatus: string | null
    }
  | { ok: false; status: number; error: string }

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function applyRounding(n: number, roundTo: number): number {
  const rounded = Math.round(n)
  if (!roundTo || roundTo <= 0) return rounded
  return Math.round(rounded / roundTo) * roundTo
}

function resolveValidUntilDisplay(validUntil: string | undefined, createdAt: string): string {
  const raw = String(validUntil || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-')
    return `${y}.${m}.${d}.`
  }
  const date = new Date(createdAt)
  date.setDate(date.getDate() + 14)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}.${m}.${d}.`
}

export async function buildNettfrontCustomerFacingHtml(
  quoteId: string,
  body: CustomerFacingBody,
  options?: { preview?: boolean }
): Promise<BuildHtmlResult> {
  const preview = Boolean(options?.preview)
  const preparedByRaw = String(body.preparedBy || '').trim()
  const buyerBody = body.buyer || {}
  const pricingBody = body.pricing || {}
  const markupPercent = Math.max(0, Math.min(500, Number(pricingBody.markupPercent) || 0))
  const lineDisplay: 'collapsed' | 'detailed' =
    pricingBody.lineDisplay === 'detailed' ? 'detailed' : 'collapsed'
  const roundToRaw = Number(pricingBody.roundTo) || 0
  const roundTo = roundToRaw === 100 || roundToRaw === 1000 ? roundToRaw : 0

  const buyerNameRaw = String(buyerBody.name || '').trim()
  if (!preview && !buyerNameRaw) {
    return { ok: false, status: 400, error: 'A vevő neve kötelező' }
  }
  if (!preview && !preparedByRaw) {
    return { ok: false, status: 400, error: 'A „Készítette” mező kötelező' }
  }

  const buyerName = buyerNameRaw || (preview ? 'Vevő neve' : '')
  const preparedBy = preparedByRaw || (preview ? '—' : '')

  const manualLines = (Array.isArray(body.manualLines) ? body.manualLines : [])
    .map(line => ({
      type: String(line.type || 'other'),
      title: String(line.title || '').trim(),
      quantity: Number(line.quantity) || 0,
      unit: String(line.unit || 'db').trim() || 'db',
      unitPriceGross: Number(line.unitPriceGross) || 0
    }))
    .filter(line => line.title && line.quantity > 0)
    .slice(0, 15)

  const quote = await getPortalNettfrontQuoteById(quoteId)
  if (!quote) {
    return { ok: false, status: 404, error: 'Árajánlat nem található' }
  }

  const seller = quote.portal_customers
  if (!seller) {
    return { ok: false, status: 500, error: 'Ajánlat adó (profil) nem található' }
  }

  const sellerName = String(seller.billing_name || seller.name || '').trim()
  if (!sellerName) {
    return { ok: false, status: 400, error: 'Hiányzik az ajánlat adó cégnév a profilból' }
  }

  const lines = quote.lines || []

  const bySku = new Map<
    string,
    {
      id: string
      display_name: string
      finish: string | null
      front_type: string
      panels_db: number
      total_sqm: number
      sell_net_per_sqm: number
      net: number
      vat: number
      gross: number
    }
  >()

  for (const line of lines) {
    const key = `${line.front_type || 'inomat'}:${line.sku_code || line.display_name}`
    const prev = bySku.get(key)
    const area = Number(line.area_sqm) || 0
    if (!prev) {
      bySku.set(key, {
        id: key,
        display_name: line.display_name,
        finish: line.finish,
        front_type: line.front_type || 'inomat',
        panels_db: Number(line.quantity) || 0,
        total_sqm: area,
        sell_net_per_sqm: Number(line.sell_net_per_sqm) || 0,
        net: Number(line.line_net) || 0,
        vat: Number(line.line_vat) || 0,
        gross: Number(line.line_gross) || 0
      })
    } else {
      prev.panels_db += Number(line.quantity) || 0
      prev.total_sqm = round2(prev.total_sqm + area)
      prev.net = round2(prev.net + Number(line.line_net))
      prev.vat = round2(prev.vat + Number(line.line_vat))
      prev.gross = round2(prev.gross + Number(line.line_gross))
    }
  }

  const sku_summary = Array.from(bySku.values())

  const totalHoles = lines.reduce((s: number, l: any) => s + (Number(l.panthely_holes_total) || 0), 0)
  const services =
    totalHoles > 0 && Number(quote.services_total_gross) > 0
      ? [
          {
            id: 'panthely',
            service_type: 'panthelyfuras',
            quantity: totalHoles,
            unit_price_net:
              totalHoles > 0 ? round2(Number(quote.services_total_net) / totalHoles) : 0,
            net: Number(quote.services_total_net) || 0,
            vat: Number(quote.services_total_vat) || 0,
            gross: Number(quote.services_total_gross) || 0
          }
        ]
      : []

  const boardGrossBase = Math.round(
    Number(quote.final_total_after_discount) ||
      (Number(quote.lines_total_gross) || 0) + (Number(quote.services_total_gross) || 0)
  )

  const boardGrossCustomer = applyRounding(boardGrossBase * (1 + markupPercent / 100), roundTo)
  const markupFactor = boardGrossBase > 0 ? boardGrossCustomer / boardGrossBase : 1
  const frontGrossRaw =
    (Number(quote.lines_total_gross) || 0) + (Number(quote.services_total_gross) || 0)
  const detailFactor = frontGrossRaw > 0 ? boardGrossCustomer / frontGrossRaw : markupFactor

  const turinovaLogoBase64 = await readFile(
    join(process.cwd(), 'public', 'images', 'turinova-logo.png')
  )
    .then(buf => buf.toString('base64'))
    .catch(() => '')

  const street = String(buyerBody.street || '').trim()
  const sellerStreet = [seller.billing_street, seller.billing_house_number]
    .filter(Boolean)
    .join(' ')
    .trim()

  const html = generateNettfrontCustomerFacingPdfHtml({
    quote: {
      id: quote.id,
      quote_number: quote.quote_number,
      created_at: quote.created_at,
      comment: quote.comment,
      buyer: {
        name: buyerName,
        email: String(buyerBody.email || '').trim(),
        mobile: String(buyerBody.phone || '').trim(),
        billing_name: buyerName,
        billing_city: String(buyerBody.city || '').trim(),
        billing_postal_code: String(buyerBody.postalCode || '').trim(),
        billing_street: street,
        billing_house_number: '',
        billing_tax_number: String(buyerBody.taxNumber || '').trim()
      },
      sku_summary,
      services,
      lines: lines.map((l: any) => ({
        id: l.id,
        display_name: l.display_name,
        finish: l.finish,
        height_mm: l.height_mm,
        width_mm: l.width_mm,
        quantity: l.quantity,
        panthely_holes_total: l.panthely_holes_total,
        megjegyzes: l.megjegyzes
      }))
    },
    workshop: {
      name: sellerName,
      phone: seller.mobile || null,
      email: seller.email || null,
      address: sellerStreet || null,
      city: seller.billing_city || null,
      postalCode: seller.billing_postal_code || null,
      taxNumber: seller.billing_tax_number || null
    },
    preparedBy,
    manualLines,
    boardGrossCustomer,
    markupFactor: lineDisplay === 'detailed' ? detailFactor : markupFactor,
    markupPercent,
    lineDisplay,
    validUntilDisplay: resolveValidUntilDisplay(body.validUntil, quote.created_at),
    turinovaLogoBase64
  })

  if (!html) {
    return { ok: false, status: 500, error: 'HTML generálási hiba' }
  }

  return {
    ok: true,
    html,
    quoteNumber: quote.quote_number,
    portalCustomerId: quote.portal_customer_id,
    quoteStatus: quote.status ?? null
  }
}
