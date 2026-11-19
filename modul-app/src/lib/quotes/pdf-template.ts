// Plain HTML template function for Quote PDF (no React)
// Ported 1:1 from main-app quotes PDF template.

import { panthelyEdgeMm, panthelySideText } from '@/lib/opti/panel-draft'
import {
  countSzogCuts,
  resolveSzogCorners,
  szogShapeSummaryLabel
} from '@/lib/opti/szogvagas-preview'
import {
  buildSzogPdfDiagramSvg,
  buildSzogPdfEdgeGroups
} from '@/lib/quotes/szog-pdf-diagram'
import { formatQuoteFeeLabel } from '@/lib/quotes/fee-totals'

export type QuotePdfPricingLine = {
  id: string
  material_name: string
  board_length_mm: number
  board_width_mm: number
  thickness_mm: number
  charged_sqm: number | null
  waste_multi: number
  boards_used: number
  material_net: number
  material_gross: number
  cutting_length_m: number
  cutting_net: number
  cutting_gross: number
  edge_materials_net: number
  edge_materials_gross: number
  materials?: {
    name: string
  } | null
  quote_edge_materials_breakdown?: Array<{
    edge_material_name: string
    total_length_m: number
    gross_price: number
  }>
  quote_services_breakdown?: Array<{
    service_type: string
    quantity: number
    gross_price: number
    net_price?: number
  }>
}

export type QuotePdfFee = {
  id: string
  fee_name: string
  comment?: string | null
  quantity: number
  unit_shortform?: string
  unit_price_net: number
  vat_rate: number
  net_price: number
  gross_price: number
  kind?: 'fee' | 'credit'
}

export type QuotePdfAccessory = {
  id: string
  accessory_name: string
  sku?: string | null
  quantity: number
  unit_price_net: number
  vat_rate: number
  total_net?: number
  total_vat?: number
  total_gross: number
  unit_name?: string | null
  accessories?: { name: string; sku?: string | null } | null
  units?: { name?: string; shortform?: string } | null
}

export type QuotePdfPanel = {
  id: string
  material_machine_code: string
  material_name: string
  /** sheet_materials.grain_direction — száljelölés a szög vizuálon. */
  grain_direction: boolean
  width_mm: number
  height_mm: number
  quantity: number
  label: string | null
  edge_a_code: string | null
  edge_c_code: string | null
  edge_b_code: string | null
  edge_d_code: string | null
  edge_ferde_code: string | null
  /** Emberi élzáró név (szög vizuál / legenda). */
  edge_a_label: string | null
  edge_b_label: string | null
  edge_c_label: string | null
  edge_d_label: string | null
  edge_ferde_label: string | null
  duplungolas: boolean
  panthelyfuras_quantity: number
  panthelyfuras_oldal: 'hosszu' | 'rovid' | null
  szogvagas: boolean
  szogvagas_corners: Array<{
    corner: 'TL' | 'TR' | 'BL' | 'BR'
    alongGrainMm: number
    alongCrossMm: number
  }>
  szog_kind: 'trapezoid' | 'triangle' | null
  szog_trap_short_mm: number | null
  szog_trap_axis: 'grain' | 'cross' | null
}

export type QuotePdfInput = {
  id: string
  quote_number: string
  /** Munkacím — fejléc hero, ha meg van adva (max 40). */
  project_name?: string | null
  order_number?: string | null
  barcode?: string | null
  customer: {
    name: string
    email: string
    mobile: string
    billing_name: string
    billing_country: string
    billing_city: string
    billing_postal_code: string
    billing_street: string
    billing_house_number: string
    billing_tax_number: string
  }
  discount_percent: number
  comment: string | null
  created_at: string
  pricing: QuotePdfPricingLine[]
  fees: QuotePdfFee[]
  accessories?: QuotePdfAccessory[]
  panels?: QuotePdfPanel[]
  totals: {
    total_net: number
    total_vat: number
    total_gross: number
    final_total_after_discount: number
    fees_total_net: number
    fees_total_vat: number
    fees_total_gross: number
    accessories_total_net?: number
    accessories_total_vat?: number
    accessories_total_gross?: number
    /** Számlával azonos (nettó-első) nettó / ÁFA összesen. */
    invoice_net_total?: number | null
    invoice_vat_total?: number | null
  }
}

export type TenantCompanyPdf = {
  id: string
  name: string
  country: string | null
  city: string | null
  postal_code: string | null
  address: string | null
  tax_number: string | null
  vat_id: string | null
  quote_validity_days: number
}

interface QuotePdfTemplateProps {
  quote: QuotePdfInput
  tenantCompany: TenantCompanyPdf
  summary: {
    totalNetBeforeDiscount: number
    totalVatBeforeDiscount: number
    totalGrossBeforeDiscount: number
    totalNetAfterDiscount: number
    totalVatAfterDiscount: number
    totalGrossAfterDiscount: number
  }
  discountAmount: number
  discountPercentage: number
  tenantCompanyLogoBase64?: string
  turinovaLogoBase64?: string
}

// Format date as YYYY.MM.DD. (Hungarian format)
const formatDatePdf = (dateString: string) => {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}.`
}

// Calculate expiry date (creation date + validity days)
const calculateExpiryDate = (dateString: string, validityDays: number) => {
  const days =
    Number.isFinite(validityDays) && validityDays > 0
      ? Math.min(365, Math.floor(validityDays))
      : 14
  const date = new Date(dateString)
  date.setDate(date.getDate() + days)
  return formatDatePdf(date.toISOString())
}

// Format currency for PDF (Hungarian format)
const formatCurrencyPdf = (amount: number) => {
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

// Format currency for PDF with 2 decimals (for unit prices)
const formatCurrencyPdfWithDecimals = (amount: number) => {
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

// Format waste multiplier for PDF (e.g., 1.2 -> "1.20x")
const formatWasteMultiplier = (value: number) => {
  return `${value.toFixed(2)}x`
}

// Escape HTML to prevent XSS
const escapeHtml = (text: string | null | undefined) => {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Get service name in Hungarian
const getServiceName = (serviceType: string) => {
  switch (serviceType) {
    case 'panthelyfuras':
      return 'Pánthely fúrás'
    case 'duplungolas':
      return 'Duplungolás'
    case 'szogvagas':
      return 'Szögvágás'
    default:
      return serviceType
  }
}

// Get service unit
const getServiceUnit = (serviceType: string) => {
  switch (serviceType) {
    case 'panthelyfuras':
    case 'szogvagas':
      return 'db'
    case 'duplungolas':
      return 'm²'
    default:
      return 'db'
  }
}

export default function generateQuotePdfHtml({
  quote,
  tenantCompany,
  summary,
  discountAmount,
  discountPercentage,
  tenantCompanyLogoBase64,
  turinovaLogoBase64
}: QuotePdfTemplateProps): string {
  const validityDays = tenantCompany.quote_validity_days ?? 14
  const expiryLabel = calculateExpiryDate(quote.created_at, validityDays)

  // Aggregate edge materials breakdown from all pricing items
  const edgeMaterialsMap = new Map<string, { material_name: string; edge_material_name: string; total_length_m: number }>()
  
  quote.pricing.forEach(pricing => {
    if (pricing.quote_edge_materials_breakdown) {
      pricing.quote_edge_materials_breakdown.forEach(edge => {
        const key = `${pricing.material_name || pricing.materials?.name || ''}_${edge.edge_material_name}`
        const existing = edgeMaterialsMap.get(key)
        if (existing) {
          existing.total_length_m += edge.total_length_m
        } else {
          edgeMaterialsMap.set(key, {
            material_name: pricing.material_name || pricing.materials?.name || '',
            edge_material_name: edge.edge_material_name,
            total_length_m: edge.total_length_m
          })
        }
      })
    }
  })
  
  const edgeMaterialsArray = Array.from(edgeMaterialsMap.values())
  const barcodeValue = (quote.barcode || '').trim()
  const barcodeSafe = barcodeValue.replace(/[^\x20-\x7E]/g, '') || barcodeValue
  const barcodeSvgId = `barcode-${quote.id}`
  const projectName = (quote.project_name || '').trim()
  const projectHtml = projectName
    ? `<p class="header-field"><span class="header-field-label">Projekt neve:</span> <span class="header-field-value">${escapeHtml(projectName)}</span></p>`
    : ''
  const identityInner = `
              <div class="header-title-row">
                <span class="header-doc-type">Ajánlat</span>
                <span class="header-title-sep">·</span>
                <span class="header-quote-no">${escapeHtml(quote.quote_number)}</span>
              </div>
              ${projectHtml}
              <div class="header-dates">
                <p class="header-date-line"><span class="header-field-label">Kelt:</span> <span class="header-date-value">${formatDatePdf(quote.created_at)}</span></p>
                <p class="header-date-line"><span class="header-field-label">Érvényes:</span> <span class="header-date-value">${escapeHtml(expiryLabel)}</span></p>
              </div>`
  const brandHtml = tenantCompanyLogoBase64
    ? `<div class="header-brand"><img src="data:image/png;base64,${tenantCompanyLogoBase64}" alt="Company Logo" class="header-logo" /></div>`
    : `<div class="header-brand"></div>`
  /** 1. oldal: brand + identity + scan. */
  const headerPrimaryHtml = `
        <div class="header">
          <div class="header-row">
            ${brandHtml}
            <div class="header-identity">${identityInner}
            </div>
            ${
              barcodeSafe
                ? `<div class="header-scan">
              <svg id="${barcodeSvgId}"></svg>
              <div class="header-scan-text">${escapeHtml(barcodeValue)}</div>
            </div>`
                : ''
            }
          </div>
        </div>`
  /** 2–3. oldal: kompakt, barcode nélkül. */
  const headerCompactHtml = `
        <div class="header header-compact">
          <div class="header-row">
            ${brandHtml}
            <div class="header-identity">${identityInner}
            </div>
          </div>
        </div>`

  // Tételek + lábléc: DB snapshot Ft (egész). Egységár csak info (bruttó/qty).
  // Ne unit×qty újraszámolás — az ellentmondana az összesítőnek / Számlázznak.

  // 1. Materials from pricing
  const materialRows = quote.pricing.map((pricing) => {
    const materialName = pricing.materials?.name || pricing.material_name
    const chargedSqm = pricing.charged_sqm || 0
    const wasteMulti = pricing.waste_multi || 1
    const boardsUsed = pricing.boards_used || 0
    const boardLengthMm = pricing.board_length_mm || 0
    const boardWidthMm = pricing.board_width_mm || 0

    const displaySqm = chargedSqm / wasteMulti
    const quantityDisplay = `${displaySqm.toFixed(2)} m² / ${boardsUsed} db`

    const boardAreaM2 = (boardLengthMm * boardWidthMm) / 1000000
    const totalArea = boardAreaM2 * boardsUsed + chargedSqm
    const lineGross = Math.round(Number(pricing.material_gross) || 0)
    const unitPriceGross =
      totalArea > 0 ? Math.round((lineGross / totalArea) * 100) / 100 : 0

    const dimensions = `${pricing.board_length_mm}×${pricing.board_width_mm}×${pricing.thickness_mm} mm`

    return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(materialName)}</div>
          <div style="font-size: 9px; color: #757575; margin-top: 0.25em;">${dimensions}</div>
        </td>
        <td>
          <span class="chip">${formatWasteMultiplier(wasteMulti)}</span>
        </td>
        <td>
          <span class="chip">Laptermék</span>
        </td>
        <td class="text-right nowrap">${quantityDisplay}</td>
        <td class="text-right nowrap">${formatCurrencyPdfWithDecimals(unitPriceGross)} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(lineGross)} Ft</td>
      </tr>
    `
  }).join('')

  // 2. Services from pricing breakdowns
  const serviceRows: string[] = []

  let totalCuttingLength = 0
  let totalCuttingGross = 0
  quote.pricing.forEach((p) => {
    if (p.cutting_gross > 0) {
      totalCuttingLength += p.cutting_length_m || 0
      totalCuttingGross += p.cutting_gross
    }
  })

  if (totalCuttingGross > 0) {
    const lineGross = Math.round(totalCuttingGross)
    const unitPriceGross =
      totalCuttingLength > 0
        ? Math.round((lineGross / totalCuttingLength) * 100) / 100
        : 0

    serviceRows.push(`
      <tr>
        <td>
          <div style="font-weight: 500;">Szabás díj</div>
        </td>
        <td></td>
        <td>
          <span class="chip">Díj</span>
        </td>
        <td class="text-right nowrap">${totalCuttingLength.toFixed(2)} m</td>
        <td class="text-right nowrap">${formatCurrencyPdfWithDecimals(unitPriceGross)} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(lineGross)} Ft</td>
      </tr>
    `)
  }

  let totalEdgeLengthForService = 0
  let totalEdgeGross = 0
  quote.pricing.forEach((p) => {
    if (p.edge_materials_gross > 0) {
      totalEdgeGross += p.edge_materials_gross
      if (p.quote_edge_materials_breakdown) {
        p.quote_edge_materials_breakdown.forEach((edge) => {
          totalEdgeLengthForService += edge.total_length_m
        })
      }
    }
  })

  if (totalEdgeGross > 0) {
    const lineGross = Math.round(totalEdgeGross)
    const unitPriceGross =
      totalEdgeLengthForService > 0
        ? Math.round((lineGross / totalEdgeLengthForService) * 100) / 100
        : 0

    serviceRows.push(`
      <tr>
        <td>
          <div style="font-weight: 500;">Élzárás</div>
        </td>
        <td></td>
        <td>
          <span class="chip">Díj</span>
        </td>
        <td class="text-right nowrap">${totalEdgeLengthForService.toFixed(2)} m</td>
        <td class="text-right nowrap">${formatCurrencyPdfWithDecimals(unitPriceGross)} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(lineGross)} Ft</td>
      </tr>
    `)
  }

  const servicesMap = new Map<
    string,
    { quantity: number; gross: number; net: number }
  >()
  quote.pricing.forEach((p) => {
    if (p.quote_services_breakdown) {
      p.quote_services_breakdown.forEach((service) => {
        const existing = servicesMap.get(service.service_type)
        if (existing) {
          existing.quantity += service.quantity
          existing.gross += service.gross_price
          existing.net += service.net_price || 0
        } else {
          servicesMap.set(service.service_type, {
            quantity: service.quantity,
            gross: service.gross_price,
            net: service.net_price || 0
          })
        }
      })
    }
  })

  servicesMap.forEach((data, serviceType) => {
    const serviceName = getServiceName(serviceType)
    const unit = getServiceUnit(serviceType)
    const lineGross = Math.round(data.gross)
    const unitPriceGross =
      data.quantity > 0 ? Math.round(lineGross / data.quantity) : 0
    const qtyLabel =
      unit === 'm²'
        ? `${data.quantity.toFixed(3)} ${unit}`
        : `${Math.round(data.quantity)} ${unit}`

    serviceRows.push(`
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(serviceName)}</div>
        </td>
        <td></td>
        <td>
          <span class="chip">Díj</span>
        </td>
        <td class="text-right nowrap">${qtyLabel}</td>
        <td class="text-right nowrap">${formatCurrencyPdf(unitPriceGross)} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(lineGross)} Ft</td>
      </tr>
    `)
  })

  // 3. Accessories — DB gross_price / total_gross
  const accessoryRows = (quote.accessories || []).map((acc) => {
    const name = acc.accessories?.name || acc.accessory_name || ''
    const lineGross = Math.round(Number(acc.total_gross) || 0)
    const qty = Number(acc.quantity) || 1
    const unitPriceGross = qty > 0 ? Math.round(lineGross / qty) : 0
    const unitLabel =
      acc.units?.shortform || acc.units?.name || acc.unit_name || 'db'
    return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(name)}</div>
          ${acc.sku || acc.accessories?.sku ? `<div style="font-size: 9px; color: #757575; margin-top: 0.25em;">${escapeHtml(acc.accessories?.sku || acc.sku || '')}</div>` : ''}
        </td>
        <td></td>
        <td>
          <span class="chip">Termék</span>
        </td>
        <td class="text-right nowrap">${acc.quantity} ${escapeHtml(unitLabel)}</td>
        <td class="text-right nowrap">${formatCurrencyPdf(unitPriceGross)} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(lineGross)} Ft</td>
      </tr>
    `
  }).join('')

  // 4. Fees — DB gross_price; megjegyzés zárójelben a név után
  const feeRows = quote.fees.map((fee) => {
    const lineGross = Math.round(Number(fee.gross_price) || 0)
    const qty = Number(fee.quantity) || 1
    const unitPriceGross = qty > 0 ? Math.round(lineGross / qty) : 0
    const chip =
      fee.kind === 'credit' || fee.gross_price < 0 ? 'Jóváírás' : 'Díj'
    const feeLabel = formatQuoteFeeLabel(fee.fee_name, fee.comment)

    return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(feeLabel)}</div>
        </td>
        <td></td>
        <td>
          <span class="chip">${chip}</span>
        </td>
        <td class="text-right nowrap">${fee.quantity} ${escapeHtml(fee.unit_shortform || 'db')}</td>
        <td class="text-right nowrap">${formatCurrencyPdf(Math.abs(unitPriceGross))} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(lineGross)} Ft</td>
      </tr>
    `
  }).join('')

  const itemsRows = materialRows + serviceRows.join('') + accessoryRows + feeRows

  // Lábléc = DB summary (detail „Végösszeg” / final_total_gross)
  const beforeDiscountRows = (Number(discountAmount) || 0) > 0 ? `
    <tr class="summary-row">
      <td colspan="5" style="border-top: 2px solid #000000; border-bottom: 1px solid #000000;">Nettó összesen:</td>
      <td class="text-right nowrap" style="border-top: 2px solid #000000; border-bottom: 1px solid #000000;">${formatCurrencyPdf(summary.totalNetBeforeDiscount)} Ft</td>
    </tr>
    <tr class="summary-row">
      <td colspan="5" style="border-bottom: 1px solid #000000;">Áfa összesen:</td>
      <td class="text-right nowrap" style="border-bottom: 1px solid #000000;">${formatCurrencyPdf(summary.totalVatBeforeDiscount)} Ft</td>
    </tr>
    <tr class="summary-row">
      <td colspan="5" style="border-bottom: 2px solid #000000;">Bruttó összesen:</td>
      <td class="text-right nowrap" style="border-bottom: 2px solid #000000;">${formatCurrencyPdf(summary.totalGrossBeforeDiscount)} Ft</td>
    </tr>
  ` : ''

  const discountRow = (Number(discountAmount) || 0) > 0 ? `
    <tr class="discount-row">
      <td colspan="5" style="border-bottom: 1px solid #000000;">Kedvezmény${Number(discountPercentage) > 0 ? ` (${Number(discountPercentage)}%)` : ''}:</td>
      <td class="text-right nowrap" style="border-bottom: 1px solid #000000; font-weight: 500;">-${formatCurrencyPdf(Number(discountAmount))} Ft</td>
    </tr>
  ` : ''

  return `<!DOCTYPE html>
<html lang="hu">
  <head>
    <meta charset="UTF-8" />
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      @page {
        margin: 0;
        size: A4;
      }
      html, body {
        height: 100%;
        margin: 0;
        padding: 0;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 11px;
        color: #212121;
        background: white;
        padding: 8mm 4mm 8mm 4mm;
        line-height: 1.2;
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        box-sizing: border-box;
      }
      .content-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: calc(100vh - 16mm);
      }
      .header {
        margin-bottom: 1.25em;
        padding-bottom: 0.85em;
        border-bottom: 1px solid #e4e4e7;
      }
      .header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
      }
      .header-brand {
        flex: 0 0 auto;
        max-width: 38%;
      }
      .header-logo {
        max-height: 44px;
        max-width: 200px;
        width: auto;
        height: auto;
        display: block;
      }
      .header-identity {
        flex: 1 1 auto;
        min-width: 0;
        text-align: left;
        padding-top: 1px;
      }
      .header-title-row {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0.35em;
        margin: 0 0 0.4em;
      }
      .header-doc-type {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #71717a;
      }
      .header-title-sep {
        font-size: 11px;
        font-weight: 500;
        color: #a1a1aa;
      }
      .header-quote-no {
        font-size: 13px;
        font-weight: 700;
        color: #18181b;
        letter-spacing: 0.01em;
      }
      .header-field {
        font-size: 12.5px;
        line-height: 1.4;
        margin: 0 0 0.35em;
        max-width: 26em;
        word-break: break-word;
      }
      .header-field-label {
        font-weight: 500;
        color: #52525b;
      }
      .header-field-value {
        font-weight: 700;
        color: #18181b;
      }
      .header-dates {
        margin: 0.15em 0 0;
      }
      .header-date-line {
        font-size: 11.5px;
        line-height: 1.45;
        margin: 0 0 0.1em;
      }
      .header-date-value {
        font-weight: 700;
        color: #27272a;
      }
      .header-scan {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        padding: 2px 0 0;
      }
      .header-scan svg {
        max-width: 124px;
        height: auto;
      }
      .header-scan-text {
        font-size: 9px;
        font-family: ui-monospace, monospace;
        letter-spacing: 0.04em;
        margin-top: 3px;
        color: #3f3f46;
      }
      .header.header-compact .header-logo {
        max-height: 36px;
        max-width: 160px;
      }
      .header.header-compact .header-field {
        font-size: 12px;
      }
      .header.header-compact .header-quote-no {
        font-size: 12.5px;
      }
      .two-column {
        display: flex;
        gap: 2em;
        margin-bottom: 1.5em;
      }
      .column {
        flex: 1;
        min-width: 0;
      }
      .column-title {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #71717a;
        margin: 0 0 0.45em;
      }
      .column-content {
        padding-left: 0;
      }
      .party-name {
        font-size: 13px;
        font-weight: 700;
        color: #18181b;
        line-height: 1.3;
        margin: 0 0 0.4em;
        word-break: break-word;
      }
      .party-field {
        font-size: 11.5px;
        line-height: 1.45;
        margin: 0 0 0.2em;
        word-break: break-word;
      }
      .party-field-label {
        font-weight: 500;
        color: #52525b;
      }
      .party-field-value {
        font-weight: 700;
        color: #27272a;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 1.5em;
        font-size: 10px;
      }
      th, td {
        padding: 4px 6px;
        text-align: left;
        border-bottom: 1px solid #000000;
      }
      th {
        font-weight: 700;
        color: #000000;
        background-color: #f5f5f5;
        border-top: 1px solid #000000;
        padding: 6px;
      }
      td {
        color: #000000;
      }
      .text-right {
        text-align: right;
      }
      .text-center {
        text-align: center;
      }
      .nowrap {
        white-space: nowrap;
      }
      tbody tr:nth-child(even) {
        background-color: #fafafa;
      }
      .chip {
        display: inline-block;
        padding: 2px 8px;
        border: 1px solid #212121;
        border-radius: 12px;
        font-size: 9px;
        font-weight: 500;
        color: #212121;
        background-color: transparent;
      }
      .summary-table {
        margin-top: 1.5em;
      }
      .summary-row {
        background-color: #f5f5f5;
      }
      .summary-row-bold {
        font-weight: 700;
        font-size: 11px;
        color: #212121;
        border-top: 2px solid #212121;
        padding: 6px 8px;
      }
      .summary-row-total {
        background-color: #212121;
        color: #ffffff;
        font-weight: 700;
        font-size: 12px;
        padding: 8px;
        border-bottom: none;
      }
      .discount-row {
        color: #616161;
      }
      .notes-section {
        margin-top: 1.5em;
        padding-top: 1em;
        border-top: 1px solid #000000;
      }
      .notes-title {
        font-size: 10px;
        font-weight: 600;
        color: #424242;
        margin-bottom: 0.5em;
      }
      .notes-content {
        font-size: 10px;
        color: #212121;
        white-space: pre-wrap;
      }
      .footer {
        margin-top: auto;
        padding-top: 1em;
        border-top: 1px solid #000000;
        font-size: 8px;
        color: #000000;
        flex-shrink: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .page-break {
        page-break-before: always;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        padding: 8mm 4mm 8mm 4mm;
        box-sizing: border-box;
      }
      .page-break .content-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: calc(100vh - 16mm);
      }
      .page-break .footer {
        margin-top: auto;
        flex-shrink: 0;
      }
      .footer-text {
        flex: 1;
      }
      .footer-logo {
        height: 20px;
        width: auto;
        margin-left: 1em;
      }
      .page-break {
        page-break-before: always;
      }

      .szog-visual-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 0.5em;
      }
      .szog-visual-card {
        border: 1px solid #cbd5e1;
        border-radius: 3px;
        padding: 10px 12px;
        page-break-inside: avoid;
        overflow: visible;
      }
      .szog-id {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 6px;
      }
      .szog-id-code {
        font-size: 12px;
        font-weight: 700;
        color: #18181B;
      }
      .szog-id-qty {
        font-size: 12px;
        font-weight: 700;
        color: #18181B;
        white-space: nowrap;
      }
      .szog-id-label {
        font-size: 10px;
        color: #64748b;
        margin-top: -2px;
        margin-bottom: 6px;
      }
      .szog-spec {
        display: table;
        width: 100%;
        border-top: 1px solid #e2e8f0;
        border-bottom: 1px solid #e2e8f0;
        padding: 6px 0;
        margin-bottom: 6px;
      }
      .szog-spec-col {
        display: table-cell;
        vertical-align: top;
        width: 42%;
      }
      .szog-spec-col + .szog-spec-col {
        width: 58%;
        padding-left: 10px;
        border-left: 1px solid #e2e8f0;
      }
      .szog-block-k {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #64748b;
        margin-bottom: 2px;
      }
      .szog-block-v {
        font-size: 11px;
        font-weight: 600;
        color: #18181B;
        line-height: 1.35;
      }
      .szog-edges {
        margin-bottom: 8px;
      }
      .szog-edge-row {
        font-size: 11px;
        color: #1e293b;
        line-height: 1.4;
        margin-top: 2px;
      }
      .szog-edge-mat {
        font-weight: 600;
        color: #18181B;
      }
      .szog-edge-sides {
        color: #475569;
      }
      .szog-diagram {
        text-align: center;
        overflow: visible;
      }
      .cutting-list-title {
        font-size: 14px;
        font-weight: 700;
        color: #000000;
        margin-bottom: 1em;
        text-align: center;
      }
      .cutting-list-table {
        font-size: 9px;
      }
      .cutting-list-table th,
      .cutting-list-table td {
        padding: 3px 4px;
        font-size: 9px;
        border: 1px solid #000000;
      }
      .cutting-list-table th {
        background-color: #f5f5f5;
        font-weight: 700;
      }
      .cutting-list-table td {
        text-align: center;
      }
      .cutting-list-table td.text-left {
        text-align: left;
      }
      .cutting-list-table td.text-right {
        text-align: right;
      }
    </style>
  </head>
  <body>
    <div class="content-wrapper">
    ${headerPrimaryHtml}

    ${(() => {
      const issuerName = (tenantCompany.name || '').trim()
      const issuerCityLine = [tenantCompany.postal_code || '', tenantCompany.city || '']
        .filter(Boolean)
        .join(' ')
      const issuerAddress = [issuerCityLine, tenantCompany.address || '']
        .filter(Boolean)
        .join(', ')
      const buyerName = (
        quote.customer.billing_name ||
        quote.customer.name ||
        ''
      ).trim()
      const buyerAddress = [
        quote.customer.billing_postal_code || '',
        quote.customer.billing_city || '',
        [quote.customer.billing_street || '', quote.customer.billing_house_number || '']
          .filter(Boolean)
          .join(' ')
      ]
        .filter(Boolean)
        .join(', ')
      const partyField = (label: string, value: string) =>
        value
          ? `<p class="party-field"><span class="party-field-label">${escapeHtml(label)}:</span> <span class="party-field-value">${escapeHtml(value)}</span></p>`
          : ''
      return `
    <div class="two-column">
      <div class="column">
        <div class="column-title">Ajánlat adó</div>
        <div class="column-content">
          ${issuerName ? `<p class="party-name">${escapeHtml(issuerName)}</p>` : ''}
          ${partyField('Cím', issuerAddress)}
          ${partyField('Adószám', (tenantCompany.tax_number || '').trim())}
        </div>
      </div>
      <div class="column">
        <div class="column-title">Vevő</div>
        <div class="column-content">
          ${buyerName ? `<p class="party-name">${escapeHtml(buyerName)}</p>` : ''}
          ${partyField('Cím', buyerAddress)}
          ${partyField('E-mail', (quote.customer.email || '').trim())}
          ${partyField('Telefon', (quote.customer.mobile || '').trim())}
          ${partyField('Adószám', (quote.customer.billing_tax_number || '').trim())}
        </div>
      </div>
    </div>`
    })()}

    <table>
      <thead>
        <tr>
          <th>Megnevezés</th>
          <th>Hull. szorzó</th>
          <th>Típus</th>
          <th class="text-right nowrap">Mennyiség</th>
          <th class="text-right nowrap">Bruttó egységár</th>
          <th class="text-right nowrap">Bruttó részösszeg</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <table class="summary-table">
      <tbody>
        ${beforeDiscountRows}
        ${discountRow}
        <tr class="summary-row">
          <td colspan="5" class="summary-row-bold">Nettó összesen:</td>
          <td class="text-right nowrap summary-row-bold">${formatCurrencyPdf(summary.totalNetAfterDiscount)} Ft</td>
        </tr>
        <tr class="summary-row">
          <td colspan="5" class="summary-row-bold" style="border-top: none;">Áfa összesen:</td>
          <td class="text-right nowrap summary-row-bold" style="border-top: none;">${formatCurrencyPdf(summary.totalVatAfterDiscount)} Ft</td>
        </tr>
        <tr>
          <td colspan="5" class="summary-row-total">Bruttó összesen:</td>
          <td class="text-right nowrap summary-row-total">${formatCurrencyPdf(summary.totalGrossAfterDiscount)} Ft</td>
        </tr>
      </tbody>
    </table>
    
    ${quote.comment ? `
    <div class="notes-section">
      <div class="notes-title">Megjegyzés:</div>
      <div class="notes-content">${escapeHtml(quote.comment)}</div>
    </div>
    ` : ''}
    
    <div style="flex: 1;"></div>
    
    <div class="footer">
      <div class="footer-text">
        Ez az ajánlat a Turinova Vállalatirányítási Rendszerrel készült.
      </div>
      ${turinovaLogoBase64 ? `<img src="data:image/png;base64,${turinovaLogoBase64}" alt="Turinova Logo" class="footer-logo" />` : ''}
    </div>
    </div>

    ${quote.panels && quote.panels.length > 0 ? `
    <!-- Second Page: Cutting List -->
    <div class="page-break">
      <div class="content-wrapper">
        ${headerCompactHtml}

        <div class="cutting-list-title">Szabásjegyzék</div>

        <table class="cutting-list-table">
          <thead>
            <tr>
              <th>Anyag</th>
              <th class="text-right">Hosszúság</th>
              <th class="text-right">Szélesség</th>
              <th class="text-right">Darab</th>
              <th>Jelölés</th>
              <th>Hosszú felső</th>
              <th>Hosszú alsó</th>
              <th>Széles bal</th>
              <th>Széles jobb</th>
              <th>Ferde</th>
              <th class="text-center">Egyéb</th>
            </tr>
          </thead>
          <tbody>
            ${quote.panels.map((panel) => {
              const services = []
              if (panel.panthelyfuras_quantity > 0) {
                services.push(
                  panel.panthelyfuras_oldal
                    ? `Pánthelyfúrás ${panel.panthelyfuras_quantity} db – ${panthelySideText(
                        panel.panthelyfuras_oldal,
                        panel.width_mm,
                        panel.height_mm
                      )} (${panthelyEdgeMm(
                        panel.width_mm,
                        panel.height_mm,
                        panel.panthelyfuras_oldal
                      )} mm)`
                    : `Pánthelyfúrás (${panel.panthelyfuras_quantity})`
                )
              }
              if (panel.duplungolas) {
                services.push('Duplungolás')
              }
              if (panel.szogvagas) {
                services.push(
                  szogShapeSummaryLabel({
                    szogvagas: panel.szogvagas,
                    grainMm: panel.width_mm,
                    crossMm: panel.height_mm,
                    szogCorners: panel.szogvagas_corners,
                    szogKind: panel.szog_kind,
                    szogTrapShortMm: panel.szog_trap_short_mm,
                    szogTrapAxis: panel.szog_trap_axis
                  }) || 'Szögvágás'
                )
              }
              const servicesText = services.length > 0 ? services.join(', ') : '-'
              
              return `
                <tr>
                  <td class="text-left">${escapeHtml(panel.material_machine_code || panel.material_name || '')}</td>
                  <td class="text-right">${panel.width_mm}</td>
                  <td class="text-right">${panel.height_mm}</td>
                  <td class="text-right">${panel.quantity}</td>
                  <td class="text-left">${escapeHtml(panel.label || '-')}</td>
                  <td>${escapeHtml(panel.edge_a_code || '')}</td>
                  <td>${escapeHtml(panel.edge_c_code || '')}</td>
                  <td>${escapeHtml(panel.edge_d_code || '')}</td>
                  <td>${escapeHtml(panel.edge_b_code || '')}</td>
                  <td>${escapeHtml(panel.edge_ferde_code || '')}</td>
                  <td class="text-center">${servicesText}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
        
        ${edgeMaterialsArray.length > 0 ? `
        <div class="cutting-list-title" style="margin-top: 1.5em;">Élzáró összesítő</div>
        
        <table class="cutting-list-table">
          <thead>
            <tr>
              <th>Anyag</th>
              <th>Élzáró</th>
              <th class="text-right">Hossz (m)</th>
            </tr>
          </thead>
          <tbody>
            ${edgeMaterialsArray.map((item) => `
              <tr>
                <td class="text-left">${escapeHtml(item.material_name)}</td>
                <td class="text-left">${escapeHtml(item.edge_material_name)}</td>
                <td class="text-right">${item.total_length_m.toFixed(2)} m</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
        
        <div style="flex: 1;"></div>
        
        <div class="footer">
          <div class="footer-text">
            Ez az ajánlat a Turinova Vállalatirányítási Rendszerrel készült.
          </div>
          ${turinovaLogoBase64 ? `<img src="data:image/png;base64,${turinovaLogoBase64}" alt="Turinova Logo" class="footer-logo" />` : ''}
        </div>
      </div>
    </div>
    ` : ''}
    ${(() => {
      const szogPanels = (quote.panels || []).filter((p) => {
        if (!p.szogvagas) return false
        const corners = resolveSzogCorners({
          grainMm: p.width_mm,
          crossMm: p.height_mm,
          corners: p.szogvagas_corners,
          szogKind: p.szog_kind,
          szogTrapShortMm: p.szog_trap_short_mm,
          szogTrapAxis: p.szog_trap_axis
        })
        return countSzogCuts(corners) > 0
      })
      if (szogPanels.length === 0) return ''
      const cards = szogPanels
        .map((panel) => {
          const shape =
            szogShapeSummaryLabel({
              szogvagas: true,
              grainMm: panel.width_mm,
              crossMm: panel.height_mm,
              szogCorners: panel.szogvagas_corners,
              szogKind: panel.szog_kind,
              szogTrapShortMm: panel.szog_trap_short_mm,
              szogTrapAxis: panel.szog_trap_axis
            }) || 'Szögvágás'
          const diagramInput = {
            id: panel.id,
            grainMm: panel.width_mm,
            crossMm: panel.height_mm,
            showGrain: panel.grain_direction,
            szogCorners: panel.szogvagas_corners,
            szogKind: panel.szog_kind,
            szogTrapShortMm: panel.szog_trap_short_mm,
            szogTrapAxis: panel.szog_trap_axis,
            edgeALabel: panel.edge_a_label,
            edgeBLabel: panel.edge_b_label,
            edgeCLabel: panel.edge_c_label,
            edgeDLabel: panel.edge_d_label,
            edgeFerdeLabel: panel.edge_ferde_label
          }
          const svg = buildSzogPdfDiagramSvg(diagramInput)
          const edgeGroups = buildSzogPdfEdgeGroups(diagramInput)
          const edgesHtml =
            edgeGroups.length === 0
              ? ''
              : `<div class="szog-edges">
              <div class="szog-block-k">Élzárás</div>
              ${edgeGroups
                .map(
                  (g) =>
                    `<div class="szog-edge-row"><span class="szog-edge-mat">${escapeHtml(g.label)}</span><span class="szog-edge-sides"> — ${escapeHtml(g.sides.join(', '))}</span></div>`
                )
                .join('')}
            </div>`
          const labelHtml = panel.label
            ? `<div class="szog-id-label">${escapeHtml(panel.label)}</div>`
            : ''
          return `<div class="szog-visual-card">
            <div class="szog-id">
              <span class="szog-id-code">${escapeHtml(panel.material_machine_code || panel.material_name || '')}</span>
              <span class="szog-id-qty">${panel.quantity} db</span>
            </div>
            ${labelHtml}
            <div class="szog-spec">
              <div class="szog-spec-col">
                <div class="szog-block-k">Szabás</div>
                <div class="szog-block-v">${panel.width_mm} × ${panel.height_mm} mm</div>
              </div>
              <div class="szog-spec-col">
                <div class="szog-block-k">Alak</div>
                <div class="szog-block-v">${escapeHtml(shape)}</div>
              </div>
            </div>
            ${edgesHtml}
            <div class="szog-diagram">${svg}</div>
          </div>`
        })
        .join('')
      return `
    <div class="page-break">
      <div class="content-wrapper">
        ${headerCompactHtml}
        <div class="cutting-list-title">Szögvágott panelek</div>
        <div class="szog-visual-grid">${cards}</div>
        <div style="flex: 1;"></div>
        <div class="footer">
          <div class="footer-text">
            Ez az ajánlat a Turinova Vállalatirányítási Rendszerrel készült.
          </div>
          ${turinovaLogoBase64 ? `<img src="data:image/png;base64,${turinovaLogoBase64}" alt="Turinova Logo" class="footer-logo" />` : ''}
        </div>
      </div>
    </div>`
    })()}
    ${barcodeSafe ? `
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <script>
      try {
        JsBarcode("#${barcodeSvgId}", ${JSON.stringify(barcodeSafe)}, {
          format: "CODE128",
          width: 1.4,
          height: 40,
          displayValue: false,
          margin: 0
        });
      } catch (e) {}
    </script>
    ` : ''}
  </body>
</html>`
}

