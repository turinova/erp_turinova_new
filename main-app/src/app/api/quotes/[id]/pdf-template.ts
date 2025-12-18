// Plain HTML template function for Quote PDF (no React)

interface QuoteMaterialPricing {
  id: string
  material_name: string
  charged_sqm: number | null
  waste_multi: number
  boards_used: number
  material_gross: number
  materials?: {
    name: string
  } | null
}

interface QuoteFee {
  id: string
  fee_name: string
  quantity: number
  unit_price_net: number
  vat_rate: number
  gross_price: number
}

interface QuoteService {
  service_type: string
  quantity: number
  gross_price: number
}

interface Quote {
  id: string
  quote_number: string
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
  pricing: Array<{
    id: string
    material_name: string
    board_length_mm: number
    board_width_mm: number
    charged_sqm: number | null
    waste_multi: number
    boards_used: number
    material_gross: number
    cutting_length_m: number
    cutting_gross: number
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
    }>
  }>
  fees: QuoteFee[]
  panels?: Array<{
    id: string
    material_machine_code: string
    material_name: string
    width_mm: number
    height_mm: number
    quantity: number
    label: string | null
    edge_a_code: string | null
    edge_c_code: string | null
    edge_b_code: string | null
    edge_d_code: string | null
    duplungolas: boolean
    panthelyfuras_quantity: number
    szogvagas: boolean
  }>
  totals: {
    total_net: number
    total_vat: number
    total_gross: number
    final_total_after_discount: number
    fees_total_gross: number
  }
}

interface TenantCompany {
  id: string
  name: string
  country: string | null
  city: string | null
  postal_code: string | null
  address: string | null
  tax_number: string | null
  vat_id: string | null
}

interface QuotePdfTemplateProps {
  quote: Quote
  tenantCompany: TenantCompany
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

// Calculate expiry date (creation date + 2 weeks)
const calculateExpiryDate = (dateString: string) => {
  const date = new Date(dateString)
  date.setDate(date.getDate() + 14) // Add 14 days (2 weeks)
  return formatDatePdf(date.toISOString())
}

// Format currency for PDF (Hungarian format)
const formatCurrencyPdf = (amount: number) => {
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
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
  const totalEdgeLength = edgeMaterialsArray.reduce((sum, item) => sum + item.total_length_m, 0)
  
  // Build items array: materials + fees + services
  
  // 1. Materials from pricing
  const materialRows = quote.pricing.map((pricing) => {
    const materialName = pricing.materials?.name || pricing.material_name
    const chargedSqm = pricing.charged_sqm || 0
    const wasteMulti = pricing.waste_multi || 1
    const boardsUsed = pricing.boards_used || 0
    const boardLengthMm = pricing.board_length_mm || 0
    const boardWidthMm = pricing.board_width_mm || 0
    
    // Mennyiség: charged_sqm / waste_multi m² + boards_used db
    const displaySqm = chargedSqm / wasteMulti
    const quantityDisplay = `${displaySqm.toFixed(2)} m² / ${boardsUsed} db`
    
    // Calculate total area: full boards area + charged area
    // board_length_mm * board_width_mm / 1000000 = area of one board in m²
    const boardAreaM2 = (boardLengthMm * boardWidthMm) / 1000000
    const totalBoardsArea = boardAreaM2 * boardsUsed
    const totalArea = totalBoardsArea + chargedSqm
    
    // Calculate unit price (gross per m²)
    const unitPriceGross = totalArea > 0 ? pricing.material_gross / totalArea : 0
    
    return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(materialName)}</div>
        </td>
        <td>
          <span class="chip">Bútorlap</span>
        </td>
        <td class="text-right nowrap">${quantityDisplay}</td>
        <td class="text-right nowrap">${formatCurrencyPdf(Math.round(unitPriceGross))} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(Math.round(pricing.material_gross))} Ft</td>
      </tr>
    `
  }).join('')
  
  // 2. Services from pricing breakdowns
  const serviceRows: string[] = []
  
  // Aggregate cutting costs
  let totalCuttingLength = 0
  let totalCuttingGross = 0
  quote.pricing.forEach(p => {
    if (p.cutting_length_m > 0 && p.cutting_gross > 0) {
      totalCuttingLength += p.cutting_length_m
      totalCuttingGross += p.cutting_gross
    }
  })
  
  if (totalCuttingGross > 0) {
    const unitPriceGross = totalCuttingLength > 0 ? totalCuttingGross / totalCuttingLength : 0
    serviceRows.push(`
      <tr>
        <td>
          <div style="font-weight: 500;">Szabás díj</div>
        </td>
        <td>
          <span class="chip">Díj</span>
        </td>
        <td class="text-right nowrap">${totalCuttingLength.toFixed(2)} m</td>
        <td class="text-right nowrap">${formatCurrencyPdf(Math.round(unitPriceGross))} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(Math.round(totalCuttingGross))} Ft</td>
      </tr>
    `)
  }
  
  // Aggregate edge materials for services section
  let totalEdgeLengthForService = 0
  let totalEdgeGross = 0
  quote.pricing.forEach(p => {
    if (p.quote_edge_materials_breakdown) {
      p.quote_edge_materials_breakdown.forEach(edge => {
        totalEdgeLengthForService += edge.total_length_m
        totalEdgeGross += edge.gross_price
      })
    }
  })
  
  if (totalEdgeGross > 0) {
    const unitPriceGross = totalEdgeLengthForService > 0 ? totalEdgeGross / totalEdgeLengthForService : 0
    serviceRows.push(`
      <tr>
        <td>
          <div style="font-weight: 500;">Élzárás</div>
        </td>
        <td>
          <span class="chip">Díj</span>
        </td>
        <td class="text-right nowrap">${totalEdgeLengthForService.toFixed(2)} m</td>
        <td class="text-right nowrap">${formatCurrencyPdf(Math.round(unitPriceGross))} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(Math.round(totalEdgeGross))} Ft</td>
      </tr>
    `)
  }
  
  // Aggregate other services
  const servicesMap = new Map<string, { quantity: number; gross: number }>()
  quote.pricing.forEach(p => {
    if (p.quote_services_breakdown) {
      p.quote_services_breakdown.forEach(service => {
        const existing = servicesMap.get(service.service_type)
        if (existing) {
          existing.quantity += service.quantity
          existing.gross += service.gross_price
        } else {
          servicesMap.set(service.service_type, {
            quantity: service.quantity,
            gross: service.gross_price
          })
        }
      })
    }
  })
  
  servicesMap.forEach((data, serviceType) => {
    const serviceName = getServiceName(serviceType)
    const unit = getServiceUnit(serviceType)
    const unitPriceGross = data.quantity > 0 ? data.gross / data.quantity : 0
    
    serviceRows.push(`
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(serviceName)}</div>
        </td>
        <td>
          <span class="chip">Díj</span>
        </td>
        <td class="text-right nowrap">${data.quantity} ${unit}</td>
        <td class="text-right nowrap">${formatCurrencyPdf(Math.round(unitPriceGross))} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(Math.round(data.gross))} Ft</td>
      </tr>
    `)
  })
  
  // 3. Fees from quote_fees table
  const feeRows = quote.fees.map((fee) => {
    const unitPriceGross = fee.quantity > 0 ? fee.gross_price / fee.quantity : 0
    
    return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(fee.fee_name)}</div>
        </td>
        <td>
          <span class="chip">Díj</span>
        </td>
        <td class="text-right nowrap">${fee.quantity} db</td>
        <td class="text-right nowrap">${formatCurrencyPdf(Math.round(unitPriceGross))} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(Math.round(fee.gross_price))} Ft</td>
      </tr>
    `
  }).join('')
  
  const itemsRows = materialRows + serviceRows.join('') + feeRows

  const beforeDiscountRows = (Number(discountAmount) || 0) > 0 ? `
    <tr class="summary-row">
      <td colspan="4" style="border-top: 2px solid #000000; border-bottom: 1px solid #000000;">Nettó összesen:</td>
      <td class="text-right nowrap" style="border-top: 2px solid #000000; border-bottom: 1px solid #000000;">${formatCurrencyPdf(summary.totalNetBeforeDiscount)} Ft</td>
    </tr>
    <tr class="summary-row">
      <td colspan="4" style="border-bottom: 1px solid #000000;">Áfa összesen:</td>
      <td class="text-right nowrap" style="border-bottom: 1px solid #000000;">${formatCurrencyPdf(summary.totalVatBeforeDiscount)} Ft</td>
    </tr>
    <tr class="summary-row">
      <td colspan="4" style="border-bottom: 2px solid #000000;">Bruttó összesen:</td>
      <td class="text-right nowrap" style="border-bottom: 2px solid #000000;">${formatCurrencyPdf(summary.totalGrossBeforeDiscount)} Ft</td>
    </tr>
  ` : ''

  const discountRow = (Number(discountAmount) || 0) > 0 ? `
    <tr class="discount-row">
      <td colspan="4" style="border-bottom: 1px solid #000000;">Kedvezmény${Number(discountPercentage) > 0 ? ` (${Number(discountPercentage)}%)` : ''}:</td>
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
        margin-bottom: 1.5em;
        padding-bottom: 1em;
        border-bottom: 1px solid #000000;
      }
      .header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .header-left {
        flex-shrink: 0;
      }
      .header-logo {
        max-height: 50px;
        max-width: 220px;
        width: auto;
        height: auto;
      }
      .header-right {
        text-align: right;
        flex: 1;
      }
      .title {
        font-size: 16px;
        font-weight: 700;
        color: #212121;
        margin-bottom: 0.25em;
      }
      .quote-number {
        font-size: 12px;
        font-weight: 600;
        color: #424242;
        margin-bottom: 0.25em;
      }
      .quote-date {
        font-size: 10px;
        color: #000000;
      }
      .two-column {
        display: flex;
        gap: 2em;
        margin-bottom: 1.5em;
      }
      .column {
        flex: 1;
      }
      .column-title {
        font-size: 11px;
        font-weight: 700;
        color: #000000;
        margin-bottom: 0.5em;
      }
      .column-content {
        padding-left: 0.5em;
      }
      .column-item {
        font-size: 10px;
        margin-bottom: 0.25em;
      }
      .column-item-bold {
        font-weight: 500;
        color: #000000;
      }
      .column-item-gray {
        color: #000000;
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
    <div class="header">
      <div class="header-row">
        <div class="header-left">
          ${tenantCompanyLogoBase64 ? `<img src="data:image/png;base64,${tenantCompanyLogoBase64}" alt="Company Logo" class="header-logo" />` : ''}
        </div>
        <div class="header-right">
          <div class="title">AJÁNLAT</div>
          <div class="quote-number">${escapeHtml(quote.quote_number)}</div>
          <div class="quote-date">
            <div>Kelt.: ${formatDatePdf(quote.created_at)}</div>
            <div>Érvényesség: ${calculateExpiryDate(quote.created_at)}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="two-column">
      <div class="column">
        <div class="column-title">Ajánlat adó:</div>
        <div class="column-content">
          <div class="column-item column-item-bold">${escapeHtml(tenantCompany.name || '')}</div>
          <div class="column-item column-item-gray">${escapeHtml([tenantCompany.postal_code || '', tenantCompany.city || ''].filter(Boolean).join(' '))}</div>
          <div class="column-item column-item-gray">${escapeHtml(tenantCompany.address || '')}</div>
          ${tenantCompany.tax_number ? `<div class="column-item column-item-gray">Adószám: ${escapeHtml(tenantCompany.tax_number)}</div>` : ''}
        </div>
      </div>

      <div class="column">
        <div class="column-title">Vevő adatok</div>
        <div class="column-content">
          <div class="column-item column-item-bold">${escapeHtml(quote.customer.billing_name || quote.customer.name || '')}</div>
          <div class="column-item column-item-gray">${escapeHtml([
            quote.customer.billing_postal_code || '',
            quote.customer.billing_city || '',
            quote.customer.billing_street || '',
            quote.customer.billing_house_number || ''
          ].filter(Boolean).join(' '))}</div>
          ${quote.customer.email ? `<div class="column-item column-item-gray">E-mail: ${escapeHtml(quote.customer.email)}</div>` : ''}
          ${quote.customer.mobile ? `<div class="column-item column-item-gray">Telefon: ${escapeHtml(quote.customer.mobile)}</div>` : ''}
          ${quote.customer.billing_tax_number ? `<div class="column-item column-item-gray">Adószám: ${escapeHtml(quote.customer.billing_tax_number)}</div>` : ''}
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Megnevezés</th>
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
          <td colspan="4" class="summary-row-bold">Nettó összesen:</td>
          <td class="text-right nowrap summary-row-bold">${formatCurrencyPdf(summary.totalNetAfterDiscount)} Ft</td>
        </tr>
        <tr class="summary-row">
          <td colspan="4" class="summary-row-bold" style="border-top: none;">Áfa összesen:</td>
          <td class="text-right nowrap summary-row-bold" style="border-top: none;">${formatCurrencyPdf(summary.totalVatAfterDiscount)} Ft</td>
        </tr>
        <tr>
          <td colspan="4" class="summary-row-total">Bruttó összesen:</td>
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
        <div class="header">
          <div class="header-row">
            <div class="header-left">
              ${tenantCompanyLogoBase64 ? `<img src="data:image/png;base64,${tenantCompanyLogoBase64}" alt="Company Logo" class="header-logo" />` : ''}
            </div>
            <div class="header-right">
              <div class="title">AJÁNLAT</div>
              <div class="quote-number">${escapeHtml(quote.quote_number)}</div>
              <div class="quote-date">
                <div>Kelt.: ${formatDatePdf(quote.created_at)}</div>
                <div>Érvényesség: ${calculateExpiryDate(quote.created_at)}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="cutting-list-title">Szabásjegyzék</div>

        <table class="cutting-list-table">
          <thead>
            <tr>
              <th>Anyag</th>
              <th class="text-right">Hosszúság</th>
              <th class="text-right">Szélesség</th>
              <th class="text-right">Darab</th>
              <th>Jelölés</th>
              <th>Hosszú alsó</th>
              <th>Hosszú felső</th>
              <th>Széles bal</th>
              <th>Széles jobb</th>
              <th class="text-center">Egyéb</th>
            </tr>
          </thead>
          <tbody>
            ${quote.panels.map((panel) => {
              const services = []
              if (panel.panthelyfuras_quantity > 0) {
                services.push(`Pánthelyfúrás (${panel.panthelyfuras_quantity})`)
              }
              if (panel.duplungolas) {
                services.push('Duplungolás')
              }
              if (panel.szogvagas) {
                services.push('Szögvágás')
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
                  <td>${escapeHtml(panel.edge_b_code || '')}</td>
                  <td>${escapeHtml(panel.edge_d_code || '')}</td>
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
  </body>
</html>`
}

