// Plain HTML template function for Worktop Quote PDF (no React)
// Matches the exact structure and styling of the orders PDF template

interface WorktopQuoteMaterial {
  material_id: string
  material_name: string
  assembly_type: string
  totalMeters: number
  totalNet: number
  totalGross: number
}

interface WorktopQuoteService {
  service_type: string
  quantity: number
  unit: string
  totalNet: number
  totalGross: number
  unitPrice?: number // Unit price extracted from details (if available)
}

interface WorktopConfig {
  id: string
  config_order: number
  assembly_type: string
  linear_material_name: string
  dimension_a: number
  dimension_b: number
  dimension_c: number | null
  dimension_d: number | null
  rounding_r1: number | null
  rounding_r2: number | null
  rounding_r3: number | null
  rounding_r4: number | null
  cut_l1: number | null
  cut_l2: number | null
  cut_l3: number | null
  cut_l4: number | null
  cut_l5: number | null
  cut_l6: number | null
  cut_l7: number | null
  cut_l8: number | null
  cutouts: string | null
  edge_position1: boolean
  edge_position2: boolean
  edge_position3: boolean
  edge_position4: boolean
  edge_position5: boolean | null
  edge_position6: boolean | null
  edge_banding?: string | null
  edge_color_choice?: string | null
  edge_color_text?: string | null
  no_postforming_edge?: boolean
}

interface WorktopQuote {
  id: string
  quote_number: string
  customer: {
    name: string
    email: string | null
    mobile: string | null
    billing_name: string | null
    billing_country: string | null
    billing_city: string | null
    billing_postal_code: string | null
    billing_street: string | null
    billing_house_number: string | null
    billing_tax_number: string | null
  }
  discount_percent: number
  comment: string | null
  created_at: string
  materials: WorktopQuoteMaterial[]
  services: WorktopQuoteService[]
  materialsTotalGross: number
  servicesTotalGross: number
  materialsTotalNet: number
  servicesTotalNet: number
  materialsTotalVat: number
  servicesTotalVat: number
  configs: WorktopConfig[]
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

interface WorktopQuotePdfTemplateProps {
  quote: WorktopQuote
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
  barcode?: string | null // Barcode for orders
  generateSvg?: (config: WorktopConfig) => string // SVG generator function
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

// Format currency for PDF with 2 decimals (for unit prices)
const formatCurrencyPdfWithDecimals = (amount: number) => {
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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
    case 'osszemaras':
      return 'Összemarás'
    case 'kereszt_vagas':
      return 'Kereszt vágás'
    case 'hosszanti_vagas':
      return 'Hosszanti vágás'
    case 'ives_vagas':
      return 'Íves vágás'
    case 'szogvagas':
      return 'Szögvágás'
    case 'kivagas':
      return 'Kivágás'
    case 'elzaro':
      return 'Élzáró'
    default:
      return serviceType
  }
}

export default function generateWorktopQuotePdfHtml({
  quote,
  tenantCompany,
  summary,
  discountAmount,
  discountPercentage,
  tenantCompanyLogoBase64,
  turinovaLogoBase64,
  barcode,
  generateSvg
}: WorktopQuotePdfTemplateProps): string {
  
  // Build materials rows - keep 6 columns like orders PDF, leave "Hull. szorzó" empty
  const materialRows = quote.materials.map((material) => {
    // Calculate unit price (gross per meter) with 2 decimal precision
    const unitPriceGross = material.totalMeters > 0 ? material.totalGross / material.totalMeters : 0
    const roundedUnitPriceGross = Math.round(unitPriceGross * 100) / 100  // Round to 2 decimals
    
    // Recalculate total from rounded unit price (2 decimals) so math is consistent
    const recalculatedTotalGross = roundedUnitPriceGross * material.totalMeters
    const recalculatedTotalNet = material.totalGross > 0
      ? material.totalNet * (recalculatedTotalGross / material.totalGross)
      : material.totalNet
    
    // Material name should be clean (no assembly type), we add it separately
    // Remove any existing assembly type from material_name if present
    const materialNameOnly = material.material_name.split(' (')[0].trim()
    
    return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(materialNameOnly)} (${escapeHtml(material.assembly_type)})</div>
        </td>
        <td></td>
        <td>
          <span class="chip">Szálas termék</span>
        </td>
        <td class="text-right nowrap">${material.totalMeters.toFixed(2)} m</td>
        <td class="text-right nowrap">${formatCurrencyPdfWithDecimals(roundedUnitPriceGross)} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(Math.round(recalculatedTotalGross))} Ft</td>
      </tr>
    `
  }).join('')
  
  // Build services rows - keep 6 columns like orders PDF, leave "Hull. szorzó" empty
  const serviceRows = quote.services.map((service) => {
    // Use extracted unit price if available, otherwise calculate from total
    let unitPriceGross = 0
    if (service.unitPrice) {
      // Use the extracted unit price from details (this is the actual fee per meter/unit)
      unitPriceGross = service.unitPrice
    } else {
      // Fallback: calculate from total
      unitPriceGross = service.quantity > 0 ? service.totalGross / service.quantity : 0
    }
    const roundedUnitPriceGross = Math.round(unitPriceGross * 100) / 100  // Round to 2 decimals
    
    // Recalculate total from rounded unit price (2 decimals) so math is consistent
    const recalculatedTotalGross = roundedUnitPriceGross * service.quantity
    const recalculatedTotalNet = service.totalGross > 0
      ? service.totalNet * (recalculatedTotalGross / service.totalGross)
      : service.totalNet
    
    const quantityDisplay = service.unit === 'm' 
      ? `${service.quantity.toFixed(2)} ${service.unit}`
      : `${service.quantity} ${service.unit}`
    
    return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(getServiceName(service.service_type))}</div>
        </td>
        <td></td>
        <td>
          <span class="chip">Díj</span>
        </td>
        <td class="text-right nowrap">${quantityDisplay}</td>
        <td class="text-right nowrap">${formatCurrencyPdfWithDecimals(roundedUnitPriceGross)} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(Math.round(recalculatedTotalGross))} Ft</td>
      </tr>
    `
  }).join('')
  
  const itemsRows = materialRows + serviceRows

  // Summary rows - matching orders PDF exactly (6 columns total, so colspan="5" for first 5 columns)
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
        size: A4 portrait;
      }
      @page portrait {
        margin: 0;
        size: A4 portrait;
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
        position: relative;
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
      .header-center {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0 10mm;
      }
      .header-barcode {
        max-width: 150px;
        max-height: 50px;
        margin-bottom: 2mm;
      }
      .header-barcode svg {
        width: 100%;
        height: auto;
      }
      .header-barcode-text {
        font-size: 8px;
        font-family: monospace;
        letter-spacing: 1px;
        text-align: center;
        margin-top: 1mm;
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
      .footer-text {
        flex: 1;
      }
      .footer-logo {
        height: 20px;
        width: auto;
        margin-left: 1em;
      }
      .portrait-page-wrapper {
        page-break-before: always;
        page: portrait;
        break-before: page;
        break-after: page;
        page-break-before: always;
        page-break-after: always;
        margin: -8mm -4mm -8mm -4mm; /* Negative margins to escape body padding (8mm top/bottom, 4mm left/right) */
        padding: 0;
        width: 202mm;  /* Exact printable width (210mm - 4mm left - 4mm right) */
        height: 281mm; /* Exact printable height (297mm - 8mm top - 8mm bottom) */
        min-height: 281mm;
        max-height: 281mm; /* Prevent overflow */
        box-sizing: border-box;
        position: relative;
        overflow: hidden; /* Prevent content from overflowing to other pages */
      }
      .portrait-page-wrapper:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      .visualization-page {
        width: 202mm;  /* Full Puppeteer content area width (210mm - 8mm margins) */
        height: 281mm; /* Full Puppeteer content area height (297mm - 16mm margins) */
        max-width: 202mm;
        max-height: 281mm;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        margin: 0; /* No negative margins - let portrait-page-wrapper handle positioning */
        padding: 0;
        box-sizing: border-box;
        position: relative;
      }
      /* Fixed header for visualization pages */
      .visualization-header {
        width: 100%;
        flex: 0 0 auto;
        background-color: #f5f5f5;
        border: 1px solid #000000;
        border-bottom: 2px solid #000000;
        padding: 1.5mm 2mm; /* Reduced padding to prevent overflow */
        margin: 0;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 7pt; /* Slightly smaller font to fit better */
        line-height: 1.3;
        overflow: hidden; /* Prevent header from overflowing */
        max-height: 25mm; /* Limit header height to prevent overflow */
      }
      .visualization-header-table {
        width: 100%;
        border-collapse: collapse;
        margin: 0;
        font-size: 8px;
      }
      .visualization-header-table th,
      .visualization-header-table td {
        padding: 4px 6px;
        text-align: left;
        border: 1px solid #000000;
      }
      .visualization-header-table th {
        font-weight: 700;
        color: #000000;
        background-color: #f5f5f5;
        padding: 6px;
      }
      .visualization-header-table td {
        color: #000000;
      }
      .visualization-header-table .text-center {
        text-align: center;
      }
      .visualization-details {
        width: 15%; /* Reduced from 20% to give more space to visualization */
        height: 100%;
        padding: 2mm;
        box-sizing: border-box;
        position: relative;
        border-right: 1px solid #000;
        overflow: hidden;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: center;
      }
      .rotated-table-container {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: visible;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .rotated-table-wrapper {
        width: 100%;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: visible;
      }
      .rotated-table {
        width: 100%;
        height: auto;
        max-height: 100%;
        font-size: 7.5pt; /* Increased for better readability */
        border-collapse: collapse;
        table-layout: fixed;
        display: table;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        margin: 0;
      }
      .rotated-table tbody {
        display: table-row-group;
      }
      .rotated-table tr {
        display: table-row;
        height: auto;
      }
      .rotated-table th,
      .rotated-table td {
        border: 1px solid #000;
        padding: 1.5mm 2mm;
        text-align: left;
        vertical-align: middle;
        line-height: 1.4;
        overflow: visible;
        font-size: 7.5pt;
        word-spacing: normal;
        letter-spacing: normal;
      }
      .rotated-table th {
        background-color: #f5f5f5;
        font-weight: 700;
        font-size: 7.5pt;
      }
      .rotated-table td {
        background-color: #ffffff;
      }
      .rotated-table .label-cell {
        text-align: left;
        font-weight: 700;
        background-color: #f9f9f9;
        width: 45%;
        min-width: 45%;
        max-width: 45%;
        white-space: nowrap;
        overflow: visible;
        text-overflow: clip;
        border-right: 2px solid #000;
        padding-right: 3mm;
      }
      .rotated-table .data-cell {
        text-align: left;
        width: 55%;
        min-width: 55%;
        max-width: 55%;
        white-space: normal;
        word-wrap: break-word;
        word-break: break-word;
        overflow: visible;
        padding-left: 2mm;
      }
      .rotated-table .wide-cell {
        text-align: left;
        width: 62%;
        min-width: 62%;
        max-width: 62%;
        white-space: normal;
        word-wrap: break-word;
        word-break: break-word;
      }
      .visualization-content {
        width: 100%;
        flex: 1 1 auto;
        min-height: 0;
        max-height: calc(281mm - 25mm); /* Total height minus header max height */
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        margin: 0;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        page-break-inside: avoid; /* Prevent content from breaking across pages */
      }
      .visualization-content-inner {
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        box-sizing: border-box;
        overflow: hidden;
        position: relative;
      }
      .visualization-content-inner svg {
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        display: block;
        object-fit: contain;
        flex-shrink: 0;
        overflow: visible; /* Allow labels to render even if slightly outside */
      }
      .detail-row {
        margin-bottom: 3mm;
        font-size: 12pt;
      }
      .detail-label {
        font-weight: 600;
        display: inline-block;
        min-width: 120px;
      }
      .detail-value {
        display: inline-block;
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
        ${barcode ? `
        <div class="header-center">
          <div class="header-barcode">
            <svg id="barcode-${quote.id}"></svg>
            <div class="header-barcode-text">${escapeHtml(barcode)}</div>
          </div>
        </div>
        ` : ''}
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
    ${barcode ? `
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <script>
      JsBarcode("#barcode-${quote.id}", "${escapeHtml(barcode)}", {
        format: "EAN13",
        width: 2.5,
        height: 50,
        displayValue: false,
        margin: 0
      });
    </script>
    ` : ''}

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
          <th></th>
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

    ${(quote.configs && quote.configs.length > 0 && generateSvg) ? quote.configs.map((config, index) => {
      // Generate SVG for this config
      const svgContent = generateSvg({
        assembly_type: config.assembly_type,
        dimension_a: config.dimension_a,
        dimension_b: config.dimension_b,
        dimension_c: config.dimension_c,
        dimension_d: config.dimension_d,
        rounding_r1: config.rounding_r1,
        rounding_r2: config.rounding_r2,
        rounding_r3: config.rounding_r3,
        rounding_r4: config.rounding_r4,
        cut_l1: config.cut_l1,
        cut_l2: config.cut_l2,
        cut_l3: config.cut_l3,
        cut_l4: config.cut_l4,
        cut_l5: config.cut_l5,
        cut_l6: config.cut_l6,
        cut_l7: config.cut_l7,
        cut_l8: config.cut_l8,
        cutouts: config.cutouts,
        edge_position1: config.edge_position1,
        edge_position2: config.edge_position2,
        edge_position3: config.edge_position3,
        edge_position4: config.edge_position4,
        edge_position5: config.edge_position5,
        edge_position6: config.edge_position6
      } as any)
      
      // Format dimension values for display
      const formatDimension = (value: number | null) => value !== null ? `${value}mm` : '-'
      
      // Parse cutouts
      let cutoutsData: any[] = []
      try {
        cutoutsData = config.cutouts ? JSON.parse(config.cutouts) : []
      } catch (e) {
        cutoutsData = []
      }
      
      // Format cutouts for display
      const cutoutsDisplay = cutoutsData.length > 0 
        ? cutoutsData.map((cutout: any, idx: number) => 
            `Kivágás ${idx + 1}: ${cutout.width || '-'}×${cutout.height || '-'}mm (${cutout.distanceFromLeft || 0}mm, ${cutout.distanceFromBottom || 0}mm)`
          ).join('; ')
        : 'Nincs'
      
      // Format edge positions
      const edgePositions = []
      if (config.edge_position1) edgePositions.push('1. oldal')
      if (config.edge_position2) edgePositions.push('2. oldal')
      if (config.edge_position3) edgePositions.push('3. oldal')
      if (config.edge_position4) edgePositions.push('4. oldal')
      if (config.edge_position5) edgePositions.push('5. oldal')
      if (config.edge_position6) edgePositions.push('6. oldal')
      const edgeDisplay = edgePositions.length > 0 ? edgePositions.join(', ') : 'Nincs'
      
      // Format rounding values
      const roundingValues = []
      if (config.rounding_r1 && config.rounding_r1 > 0) roundingValues.push(`R1: ${formatDimension(config.rounding_r1)}`)
      if (config.rounding_r2 && config.rounding_r2 > 0) roundingValues.push(`R2: ${formatDimension(config.rounding_r2)}`)
      if (config.rounding_r3 && config.rounding_r3 > 0) roundingValues.push(`R3: ${formatDimension(config.rounding_r3)}`)
      if (config.rounding_r4 && config.rounding_r4 > 0) roundingValues.push(`R4: ${formatDimension(config.rounding_r4)}`)
      const roundingDisplay = roundingValues.length > 0 ? roundingValues.join(', ') : 'Nincs'
      
      // Format chamfer values
      const chamferValues = []
      if (config.cut_l1 && config.cut_l1 > 0) chamferValues.push(`L1: ${formatDimension(config.cut_l1)}`)
      if (config.cut_l2 && config.cut_l2 > 0) chamferValues.push(`L2: ${formatDimension(config.cut_l2)}`)
      if (config.cut_l3 && config.cut_l3 > 0) chamferValues.push(`L3: ${formatDimension(config.cut_l3)}`)
      if (config.cut_l4 && config.cut_l4 > 0) chamferValues.push(`L4: ${formatDimension(config.cut_l4)}`)
      if (config.cut_l5 && config.cut_l5 > 0) chamferValues.push(`L5: ${formatDimension(config.cut_l5)}`)
      if (config.cut_l6 && config.cut_l6 > 0) chamferValues.push(`L6: ${formatDimension(config.cut_l6)}`)
      if (config.cut_l7 && config.cut_l7 > 0) chamferValues.push(`L7: ${formatDimension(config.cut_l7)}`)
      if (config.cut_l8 && config.cut_l8 > 0) chamferValues.push(`L8: ${formatDimension(config.cut_l8)}`)
      const chamferDisplay = chamferValues.length > 0 ? chamferValues.join(', ') : 'Nincs'
      
      // Build Munkalap méret row
      let munkalapMeret = `A: ${formatDimension(config.dimension_a)}, B: ${formatDimension(config.dimension_b)}`
      if (config.dimension_c !== null) munkalapMeret += `, C: ${formatDimension(config.dimension_c)}`
      if (config.dimension_d !== null) munkalapMeret += `, D: ${formatDimension(config.dimension_d)}`
      
      // Get material name for this config
      const materialForConfig = quote.materials.find(m => m.assembly_type === config.assembly_type)
      const materialName = materialForConfig ? materialForConfig.material_name : config.linear_material_name || '-'
      
      // Get full customer name (will wrap if needed)
      const customerName = quote.customer.billing_name || quote.customer.name || '—'
      
      // Format cutouts for display (compact format)
      const cutoutsDisplayCompact = cutoutsData.length > 0 
        ? cutoutsData.map((cutout: any, idx: number) => 
            `${idx + 1}: ${cutout.width || '-'}×${cutout.height || '-'}mm`
          ).join('; ')
        : 'Nincs'
      
      // Format R1-R4 values (compact)
      const rValues = []
      if (config.rounding_r1 && config.rounding_r1 > 0) rValues.push(`R1:${config.rounding_r1}mm`)
      if (config.rounding_r2 && config.rounding_r2 > 0) rValues.push(`R2:${config.rounding_r2}mm`)
      if (config.rounding_r3 && config.rounding_r3 > 0) rValues.push(`R3:${config.rounding_r3}mm`)
      if (config.rounding_r4 && config.rounding_r4 > 0) rValues.push(`R4:${config.rounding_r4}mm`)
      const rValuesDisplay = rValues.length > 0 ? rValues.join(' ') : 'Nincs'
      
      // Format L1-L8 values (compact)
      const lValues = []
      if (config.cut_l1 && config.cut_l1 > 0) lValues.push(`L1:${config.cut_l1}mm`)
      if (config.cut_l2 && config.cut_l2 > 0) lValues.push(`L2:${config.cut_l2}mm`)
      if (config.cut_l3 && config.cut_l3 > 0) lValues.push(`L3:${config.cut_l3}mm`)
      if (config.cut_l4 && config.cut_l4 > 0) lValues.push(`L4:${config.cut_l4}mm`)
      if (config.cut_l5 && config.cut_l5 > 0) lValues.push(`L5:${config.cut_l5}mm`)
      if (config.cut_l6 && config.cut_l6 > 0) lValues.push(`L6:${config.cut_l6}mm`)
      if (config.cut_l7 && config.cut_l7 > 0) lValues.push(`L7:${config.cut_l7}mm`)
      if (config.cut_l8 && config.cut_l8 > 0) lValues.push(`L8:${config.cut_l8}mm`)
      const lValuesDisplay = lValues.length > 0 ? lValues.join(' ') : 'Nincs'
      
      // Format ABCD values (compact)
      const abcdDisplay = `A:${config.dimension_a}mm B:${config.dimension_b}mm${config.dimension_c !== null ? ` C:${config.dimension_c}mm` : ''}${config.dimension_d !== null ? ` D:${config.dimension_d}mm` : ''}`
      
      // Format date
      const quoteDate = formatDatePdf(quote.created_at)
      
      return `
    <!-- Visualization Page ${index + 1} for Config ${config.config_order} -->
    <div class="portrait-page-wrapper">
    <div class="visualization-page">
      <div class="visualization-header">
        <table class="visualization-header-table">
          <tbody>
            <tr>
              <th>Megrendelő</th>
              <td>${escapeHtml(customerName)}</td>
              <th>Telephone</th>
              <td>${escapeHtml(quote.customer.mobile || '—')}</td>
              <th>Quote number</th>
              <td>${escapeHtml(quote.quote_number || '—')}</td>
              <th>Date</th>
              <td>${escapeHtml(quoteDate)}</td>
            </tr>
            <tr>
              <th>Anyag neve</th>
              <td>${escapeHtml(materialName)}</td>
              <th>Élzáró anyag</th>
              <td>${escapeHtml(config.edge_banding || 'Nincs élzáró')}</td>
              <th>Élzáró anyag színe</th>
              <td>${escapeHtml(config.edge_color_choice === 'Egyéb szín' && config.edge_color_text ? config.edge_color_text : (config.edge_color_choice || 'Színazonos'))}</td>
              <th>Postforming</th>
              <td>${config.no_postforming_edge ? 'NEM' : 'IGEN'}</td>
            </tr>
            <tr>
              <th>1. oldal</th>
              <td>${config.edge_position1 ? 'IGEN' : 'NEM'}</td>
              <th>2. oldal</th>
              <td>${config.edge_position2 ? 'IGEN' : 'NEM'}</td>
              <th>3. oldal</th>
              <td>${config.edge_position3 ? 'IGEN' : 'NEM'}</td>
              <th>4. oldal</th>
              <td>${config.edge_position4 ? 'IGEN' : 'NEM'}</td>
              <th>5. oldal</th>
              <td>${config.edge_position5 ? 'IGEN' : 'NEM'}</td>
              <th>6. oldal</th>
              <td>${config.edge_position6 ? 'IGEN' : 'NEM'}</td>
            </tr>
            <tr>
              <th>A:</th>
              <td>${config.dimension_a}mm</td>
              <th>B:</th>
              <td>${config.dimension_b}mm</td>
              <th>C:</th>
              <td>${config.dimension_c ? `${config.dimension_c}mm` : '—'}</td>
              <th>D:</th>
              <td>${config.dimension_d ? `${config.dimension_d}mm` : '—'}</td>
            </tr>
            <tr>
              <th>R1:</th>
              <td>${config.rounding_r1 ? `${config.rounding_r1}mm` : '—'}</td>
              <th>R2:</th>
              <td>${config.rounding_r2 ? `${config.rounding_r2}mm` : '—'}</td>
              <th>R3:</th>
              <td>${config.rounding_r3 ? `${config.rounding_r3}mm` : '—'}</td>
              <th>R4:</th>
              <td>${config.rounding_r4 ? `${config.rounding_r4}mm` : '—'}</td>
            </tr>
            <tr>
              <th>L1:</th>
              <td>${config.cut_l1 ? `${config.cut_l1}mm` : '—'}</td>
              <th>L2:</th>
              <td>${config.cut_l2 ? `${config.cut_l2}mm` : '—'}</td>
              <th>L3:</th>
              <td>${config.cut_l3 ? `${config.cut_l3}mm` : '—'}</td>
              <th>L4:</th>
              <td>${config.cut_l4 ? `${config.cut_l4}mm` : '—'}</td>
              <th>L5:</th>
              <td>${config.cut_l5 ? `${config.cut_l5}mm` : '—'}</td>
              <th>L6:</th>
              <td>${config.cut_l6 ? `${config.cut_l6}mm` : '—'}</td>
              <th>L7:</th>
              <td>${config.cut_l7 ? `${config.cut_l7}mm` : '—'}</td>
              <th>L8:</th>
              <td>${config.cut_l8 ? `${config.cut_l8}mm` : '—'}</td>
            </tr>
            ${cutoutsData.length > 0 ? cutoutsData.map((cutout: any, idx: number) => `
            <tr>
              <th>Kivágás${idx + 1}</th>
              <td colspan="7">
                Szélesség: ${cutout.width || '—'}mm, 
                Magasság: ${cutout.height || '—'}mm, 
                Távolság balról: ${cutout.distanceFromLeft || '—'}mm, 
                Távolság alulról: ${cutout.distanceFromBottom || '—'}mm${cutout.worktopType ? `, Munkalap: ${cutout.worktopType}` : ''}
              </td>
            </tr>
            `).join('') : ''}
          </tbody>
        </table>
      </div>
      <div class="visualization-content">
        <div class="visualization-content-inner">
          ${svgContent || '<div style="color: red; padding: 20px;">SVG not generated</div>'}
        </div>
      </div>
    </div>
    </div>
      `
    }).join('') : ''}
  </body>
</html>`
}

// Generate HTML for a single visualization page (table only, no SVG)
// This will be rendered with Puppeteer, then SVG will be added with PDFKit
export function generateVisualizationPageHtml(
  config: WorktopConfig,
  quote: WorktopQuote,
  index: number,
  tenantCompanyLogoBase64?: string,
  turinovaLogoBase64?: string,
  barcode?: string | null
): string {
  // Format dimension values for display
  const formatDimension = (value: number | null) => value !== null ? `${value}mm` : '-'
  
  // Parse cutouts
  let cutoutsData: any[] = []
  try {
    cutoutsData = config.cutouts ? JSON.parse(config.cutouts) : []
  } catch (e) {
    cutoutsData = []
  }
  
  // Get material name for this config (same as first page - lookup from materials array)
  const materialForConfig = quote.materials.find(m => m.assembly_type === config.assembly_type)
  const materialName = materialForConfig ? materialForConfig.material_name : config.linear_material_name || '-'
  
  // Get customer name - use customer.name (not billing_name)
  const customerName = quote.customer.name || '—'
  
  // Format date
  const quoteDate = formatDatePdf(quote.created_at)
  
  // Get edge color text
  const edgeColorText = config.edge_color_choice === 'Egyéb szín' && config.edge_color_text 
    ? config.edge_color_text 
    : (config.edge_color_choice || 'Színazonos')
  
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
        size: A4 portrait;
      }
      html, body {
        height: 100%;
        margin: 0;
        padding: 0;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 11px;
        color: #000000;
        background: #ffffff;
        padding: 8mm 4mm 8mm 4mm;
        line-height: 1.3;
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        box-sizing: border-box;
        position: relative;
      }
      .visualization-page {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        position: relative;
      }
      .visualization-page-logo-container {
        width: 100%;
        flex: 0 0 auto;
        margin-bottom: 2mm;
      }
      .visualization-header {
        width: 100%;
        flex: 0 0 auto;
        background-color: #ffffff;
        border: 0.5px solid #000000;
        border-bottom: 1px solid #000000;
        padding: 3mm 3mm;
        margin: 0;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 8pt;
        line-height: 1.5;
        overflow: hidden;
        max-height: 70mm;
        min-height: 50mm;
        display: flex;
        gap: 3mm;
        align-items: flex-start;
      }
      .header-table-container {
        display: flex;
        flex-direction: column;
        min-width: 0;
        overflow: hidden;
      }
      .header-table-container:first-child {
        flex: 0 0 35%;
        max-width: 35%;
      }
      .header-table-container:last-child {
        flex: 0 0 63%;
        max-width: 63%;
        overflow: hidden;
      }
      .header-table-title {
        font-weight: 700;
        font-size: 9pt;
        color: #000000;
        margin-bottom: 1.5mm;
        padding: 0;
        padding-bottom: 0.5mm;
        line-height: 1.3;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid #000000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .visualization-header-table {
        width: 100%;
        border-collapse: collapse;
        margin: 0;
        font-size: 8px;
        table-layout: fixed;
        max-width: 100%;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .visualization-header-table th,
      .visualization-header-table td {
        padding: 1px 2px;
        text-align: left;
        border: 0.5px solid #000000;
        vertical-align: top;
        overflow: hidden;
        word-wrap: break-word;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .visualization-header-table th {
        font-weight: 700;
        color: #000000;
        background-color: #ffffff;
        padding: 1.5px 2px;
        white-space: nowrap;
        font-size: 8px;
        width: 30%;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .visualization-header-table td {
        color: #000000;
        font-size: 8px;
        line-height: 1.4;
        width: 20%;
        font-weight: 400;
      }
      .visualization-header-table .text-center {
        text-align: center;
      }
      /* Right table - same font size as left table, prevent overflow */
      .header-table-container:last-child .visualization-header-table {
        font-size: 8px;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .header-table-container:last-child .visualization-header-table th,
      .header-table-container:last-child .visualization-header-table td {
        padding: 1px 2px;
        font-size: 7.5px;
        box-sizing: border-box;
        border: 0.5px solid #000000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .header-table-container:last-child .visualization-header-table th {
        padding: 1.5px 2px;
        font-size: 7.5px;
        width: 25%;
        max-width: 25%;
        text-transform: uppercase;
        letter-spacing: 0.2px;
      }
      .header-table-container:last-child .visualization-header-table td {
        font-size: 7.5px;
        width: 25%;
        max-width: 25%;
      }
      /* Regular rows - allow wrapping for long text */
      .visualization-header-table tbody > tr:not(.compact-row) td {
        word-wrap: break-word;
        overflow-wrap: break-word;
        word-break: break-word;
        white-space: normal;
      }
      /* Compact rows - no wrapping, use maximum space */
      .compact-row {
        font-size: 7.5px;
      }
      .compact-row th,
      .compact-row td {
        padding: 1px 2px;
        font-size: 7.5px;
        line-height: 1.3;
        white-space: nowrap;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        border: 0.5px solid #000000;
      }
      .compact-row th {
        padding: 1.5px 2px;
        font-size: 7.5px;
        text-transform: uppercase;
        letter-spacing: 0.2px;
      }
      /* Right table compact rows - same font size as left, reduced padding */
      .header-table-container:last-child .compact-row {
        font-size: 7px;
      }
      .header-table-container:last-child .compact-row th,
      .header-table-container:last-child .compact-row td {
        padding: 1px 2px;
        font-size: 7px;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        border: 0.5px solid #000000;
      }
      .header-table-container:last-child .compact-row th {
        padding: 1.5px 2px;
        font-size: 7px;
        text-transform: uppercase;
        letter-spacing: 0.2px;
      }
      /* Value cells in compact rows should not wrap */
      .compact-row .value-cell {
        white-space: nowrap;
      }
      /* Value cells in regular rows can wrap if needed */
      .value-cell {
        white-space: normal;
        word-break: break-word;
      }
      .visualization-content {
        width: 100%;
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2mm;
        margin: 0;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        border: 0.5px solid #000000;
        background-color: #ffffff;
      }
      .visualization-content-inner {
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        box-sizing: border-box;
        overflow: hidden;
        position: relative;
      }
      .visualization-content-inner svg,
      .visualization-content-inner > * {
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        object-fit: contain;
      }
      .visualization-logo-bottom-left {
        position: absolute;
        bottom: 3mm;
        left: 3mm;
        z-index: 10;
        max-height: 30px;
        max-width: 150px;
        width: auto;
        height: auto;
      }
      .visualization-barcode-bottom-right {
        position: absolute;
        bottom: 3mm;
        right: 3mm;
        z-index: 10;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        max-width: 120px;
      }
      .visualization-barcode-bottom-right svg {
        width: 100%;
        height: auto;
        max-height: 40px;
      }
      .visualization-barcode-bottom-right-text {
        font-size: 7px;
        font-family: monospace;
        letter-spacing: 0.5px;
        text-align: center;
        margin-top: 1mm;
      }
      .visualization-footer {
        width: 100%;
        padding-top: 1mm;
        border-top: 0.5px solid #000000;
        font-size: 7px;
        color: #000000;
        flex-shrink: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 2mm;
      }
      .visualization-footer-text {
        flex: 1;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .visualization-footer-logo {
        height: 16px;
        width: auto;
        margin-left: 1em;
      }
      .signature-space {
        min-height: 20mm;
        border: 0.5px solid #000000;
        margin-top: 2mm;
        padding: 2mm;
        font-size: 7px;
        color: #000000;
      }
      .signature-label {
        font-weight: 700;
        margin-bottom: 1mm;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .visualization-content-inner {
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        box-sizing: border-box;
        overflow: hidden;
        position: relative;
      }
    </style>
  </head>
  <body>
    <div class="visualization-page">
      <div class="visualization-header">
        <!-- Left Table: Megrendelés adatai -->
        <div class="header-table-container">
          <div class="header-table-title">Megrendelés adatai</div>
          <table class="visualization-header-table">
            <tbody>
              <tr>
                <th>Megrendelő neve:</th>
                <td>${escapeHtml(customerName)}</td>
              </tr>
              <tr>
                <th>Telefonszám:</th>
                <td>${escapeHtml(quote.customer.mobile || '—')}</td>
              </tr>
              <tr>
                <th>Ajánlat szám:</th>
                <td>${escapeHtml(quote.quote_number || '—')}</td>
              </tr>
              <tr>
                <th>Dátum:</th>
                <td>${escapeHtml(quoteDate)}</td>
              </tr>
              <tr>
                <th>Anyag neve:</th>
                <td>${escapeHtml(materialName)}</td>
              </tr>
            </tbody>
          </table>
          <div class="signature-space">
            <div class="signature-label">Megrendelő aláírása:</div>
          </div>
        </div>
        
        <!-- Right Table: Megmunkálások -->
        <div class="header-table-container">
          <div class="header-table-title">Megmunkálások</div>
          <table class="visualization-header-table">
            <tbody>
              <tr>
                <th>Élzáró anyag:</th>
                <td class="value-cell">${escapeHtml(config.edge_banding || 'Nincs élzáró')}</td>
                <th>Élzáró színe:</th>
                <td class="value-cell">${escapeHtml(edgeColorText)}</td>
              </tr>
              <tr>
                <th>Postforming:</th>
                <td class="value-cell">${config.no_postforming_edge ? 'NEM' : 'IGEN'}</td>
                <th></th>
                <td></td>
              </tr>
              <tr class="compact-row">
                <th>1. oldal:</th>
                <td class="value-cell">${config.edge_position1 ? 'IGEN' : 'NEM'}</td>
                <th>2. oldal:</th>
                <td class="value-cell">${config.edge_position2 ? 'IGEN' : 'NEM'}</td>
              </tr>
              <tr class="compact-row">
                <th>3. oldal:</th>
                <td class="value-cell">${config.edge_position3 ? 'IGEN' : 'NEM'}</td>
                <th>4. oldal:</th>
                <td class="value-cell">${config.edge_position4 ? 'IGEN' : 'NEM'}</td>
              </tr>
              <tr class="compact-row">
                <th>5. oldal:</th>
                <td class="value-cell">${config.edge_position5 ? 'IGEN' : 'NEM'}</td>
                <th>6. oldal:</th>
                <td class="value-cell">${config.edge_position6 ? 'IGEN' : 'NEM'}</td>
              </tr>
              <tr class="compact-row">
                <th>A:</th>
                <td class="value-cell">${config.dimension_a}mm</td>
                <th>B:</th>
                <td class="value-cell">${config.dimension_b}mm</td>
              </tr>
              <tr class="compact-row">
                <th>C:</th>
                <td class="value-cell">${config.dimension_c ? `${config.dimension_c}mm` : '—'}</td>
                <th>D:</th>
                <td class="value-cell">${config.dimension_d ? `${config.dimension_d}mm` : '—'}</td>
              </tr>
              <tr class="compact-row">
                <th>R1:</th>
                <td class="value-cell">${config.rounding_r1 ? `${config.rounding_r1}mm` : '—'}</td>
                <th>R2:</th>
                <td class="value-cell">${config.rounding_r2 ? `${config.rounding_r2}mm` : '—'}</td>
              </tr>
              <tr class="compact-row">
                <th>R3:</th>
                <td class="value-cell">${config.rounding_r3 ? `${config.rounding_r3}mm` : '—'}</td>
                <th>R4:</th>
                <td class="value-cell">${config.rounding_r4 ? `${config.rounding_r4}mm` : '—'}</td>
              </tr>
              <tr class="compact-row">
                <th>L1:</th>
                <td class="value-cell">${config.cut_l1 ? `${config.cut_l1}mm` : '—'}</td>
                <th>L2:</th>
                <td class="value-cell">${config.cut_l2 ? `${config.cut_l2}mm` : '—'}</td>
              </tr>
              <tr class="compact-row">
                <th>L3:</th>
                <td class="value-cell">${config.cut_l3 ? `${config.cut_l3}mm` : '—'}</td>
                <th>L4:</th>
                <td class="value-cell">${config.cut_l4 ? `${config.cut_l4}mm` : '—'}</td>
              </tr>
              <tr class="compact-row">
                <th>L5:</th>
                <td class="value-cell">${config.cut_l5 ? `${config.cut_l5}mm` : '—'}</td>
                <th>L6:</th>
                <td class="value-cell">${config.cut_l6 ? `${config.cut_l6}mm` : '—'}</td>
              </tr>
              <tr class="compact-row">
                <th>L7:</th>
                <td class="value-cell">${config.cut_l7 ? `${config.cut_l7}mm` : '—'}</td>
                <th>L8:</th>
                <td class="value-cell">${config.cut_l8 ? `${config.cut_l8}mm` : '—'}</td>
              </tr>
              ${cutoutsData.length > 0 ? cutoutsData.map((cutout: any, idx: number) => `
              <tr>
                <th>KIVÁGÁS ${idx + 1}:</th>
                <td colspan="3" class="value-cell">
                  Szélesség: ${cutout.width || '—'}mm, 
                  Magasság: ${cutout.height || '—'}mm, 
                  Bal: ${cutout.distanceFromLeft || '—'}mm, 
                  Alul: ${cutout.distanceFromBottom || '—'}mm
                </td>
              </tr>
              `).join('') : ''}
            </tbody>
          </table>
        </div>
      </div>
      <div class="visualization-content">
        <div class="visualization-content-inner">
          <!-- SVG will be added here by PDFKit -->
          ${tenantCompanyLogoBase64 ? `<img src="data:image/png;base64,${tenantCompanyLogoBase64}" alt="Company Logo" class="visualization-logo-bottom-left" />` : ''}
          ${barcode ? `
          <div class="visualization-barcode-bottom-right">
            <svg id="barcode-viz-${quote.id}-${index}"></svg>
            <div class="visualization-barcode-bottom-right-text">${escapeHtml(barcode)}</div>
          </div>
          ` : ''}
        </div>
      </div>
      <div class="visualization-footer">
        <div class="visualization-footer-text">
          Ez az ajánlat a Turinova Vállalatirányítási Rendszerrel készült.
        </div>
        ${turinovaLogoBase64 ? `<img src="data:image/png;base64,${turinovaLogoBase64}" alt="Turinova Logo" class="visualization-footer-logo" />` : ''}
      </div>
    </div>
    ${barcode ? `
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <script>
      JsBarcode("#barcode-viz-${quote.id}-${index}", "${escapeHtml(barcode)}", {
        format: "EAN13",
        width: 2,
        height: 40,
        displayValue: false,
        margin: 0
      });
    </script>
    ` : ''}
  </body>
</html>
  `
}
