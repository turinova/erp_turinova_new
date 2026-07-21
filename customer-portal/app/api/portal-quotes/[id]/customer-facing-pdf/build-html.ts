import { readFile } from 'fs/promises'
import { join } from 'path'
import { getPortalQuoteById } from '@/lib/supabase-server'
import { getEdgeMaterialCodes } from '@/lib/company-data-server'
import generateCustomerFacingQuotePdfHtml from './pdf-template'

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

function applyRounding(n: number, roundTo: number): number {
  const rounded = Math.round(n)
  if (!roundTo || roundTo <= 0) return rounded
  return Math.round(rounded / roundTo) * roundTo
}

/** Accept YYYY-MM-DD → Hungarian PDF date; fallback = createdAt + 14 days. */
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

export type BuildHtmlResult =
  | { ok: true; html: string; quoteNumber: string }
  | { ok: false; status: number; error: string }

/**
 * Shared HTML builder for Opti customer-facing PDF + live preview.
 * @param preview — if true, missing buyer/preparedBy get placeholders (no hard fail).
 */
export async function buildOptiCustomerFacingHtml(
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

  const quoteData = await getPortalQuoteById(quoteId)
  if (!quoteData) {
    return { ok: false, status: 404, error: 'Árajánlat nem található' }
  }
  if (!quoteData.companies) {
    return { ok: false, status: 500, error: 'Cégadatok nem találhatók' }
  }

  const seller = Array.isArray(quoteData.portal_customers)
    ? quoteData.portal_customers[0]
    : quoteData.portal_customers

  if (!seller) {
    return { ok: false, status: 500, error: 'Ajánlat adó (profil) nem található' }
  }

  const sellerName = String(seller.billing_name || seller.name || '').trim()
  if (!sellerName) {
    return { ok: false, status: 400, error: 'Hiányzik az ajánlat adó cégnév a profilból' }
  }

  const companyCredentials = {
    supabase_url: quoteData.companies.supabase_url,
    supabase_anon_key: quoteData.companies.supabase_anon_key
  }

  const edgeMaterialIds = new Set<string>()
  quoteData.panels?.forEach((panel: any) => {
    if (panel.edge_material_a_id) edgeMaterialIds.add(panel.edge_material_a_id)
    if (panel.edge_material_b_id) edgeMaterialIds.add(panel.edge_material_b_id)
    if (panel.edge_material_c_id) edgeMaterialIds.add(panel.edge_material_c_id)
    if (panel.edge_material_d_id) edgeMaterialIds.add(panel.edge_material_d_id)
  })

  const edgeCodesMap =
    edgeMaterialIds.size > 0
      ? await getEdgeMaterialCodes(companyCredentials, Array.from(edgeMaterialIds))
      : new Map()

  const enrichedPanels =
    quoteData.panels?.map((panel: any) => {
      const materialPricing = quoteData.pricing?.find((p: any) => p.material_id === panel.material_id)
      const materialName = materialPricing?.material_name || 'Ismeretlen anyag'
      return {
        ...panel,
        material_machine_code: materialName,
        material_name: materialName,
        edge_a_code: panel.edge_material_a_id ? edgeCodesMap.get(panel.edge_material_a_id) || null : null,
        edge_b_code: panel.edge_material_b_id ? edgeCodesMap.get(panel.edge_material_b_id) || null : null,
        edge_c_code: panel.edge_material_c_id ? edgeCodesMap.get(panel.edge_material_c_id) || null : null,
        edge_d_code: panel.edge_material_d_id ? edgeCodesMap.get(panel.edge_material_d_id) || null : null
      }
    }) || []

  const materialsGross = quoteData.total_gross || 0
  const materialsNet = quoteData.total_net || 0
  const materialsGrossPositive = Math.max(0, materialsGross)
  const discountPercent = quoteData.discount_percent || 0
  const discountAmount = materialsGrossPositive * (discountPercent / 100)
  const materialsGrossNegative = Math.min(0, materialsGross)
  const boardGrossBase = Math.round(
    materialsGrossPositive - discountAmount + materialsGrossNegative
  )
  const discountRatio = materialsGross > 0 ? discountAmount / materialsGross : 0
  const boardNetBase = Math.round(materialsNet * (1 - discountRatio))
  const boardVatBase = boardGrossBase - boardNetBase

  const boardGrossCustomer = applyRounding(boardGrossBase * (1 + markupPercent / 100), roundTo)
  const markupFactor = boardGrossBase > 0 ? boardGrossCustomer / boardGrossBase : 1
  const boardNetCustomer = Math.round(boardNetBase * markupFactor)
  const boardVatCustomer = boardGrossCustomer - boardNetCustomer

  const summary = {
    totalNetBeforeDiscount: boardNetCustomer,
    totalVatBeforeDiscount: boardVatCustomer,
    totalGrossBeforeDiscount: boardGrossCustomer,
    totalNetAfterDiscount: boardNetCustomer,
    totalVatAfterDiscount: boardVatCustomer,
    totalGrossAfterDiscount: boardGrossCustomer
  }

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

  const html = generateCustomerFacingQuotePdfHtml({
    quote: {
      id: quoteData.id,
      quote_number: quoteData.quote_number,
      customer: {
        name: buyerName,
        email: String(buyerBody.email || '').trim(),
        mobile: String(buyerBody.phone || '').trim(),
        billing_name: buyerName,
        billing_country: '',
        billing_city: String(buyerBody.city || '').trim(),
        billing_postal_code: String(buyerBody.postalCode || '').trim(),
        billing_street: street,
        billing_house_number: '',
        billing_tax_number: String(buyerBody.taxNumber || '').trim()
      },
      discount_percent: 0,
      comment: quoteData.comment,
      created_at: quoteData.created_at,
      pricing: quoteData.pricing || [],
      panels: enrichedPanels,
      totals: {
        total_net: boardNetCustomer,
        total_vat: boardVatCustomer,
        total_gross: boardGrossCustomer,
        final_total_after_discount: boardGrossCustomer
      }
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
    summary,
    discountAmount: 0,
    discountPercentage: 0,
    markupFactor,
    lineDisplay,
    boardGrossCustomer,
    markupPercent,
    validUntilDisplay: resolveValidUntilDisplay(body.validUntil, quoteData.created_at),
    turinovaLogoBase64
  })

  if (!html) {
    return { ok: false, status: 500, error: 'HTML generálási hiba' }
  }

  return { ok: true, html, quoteNumber: quoteData.quote_number }
}
