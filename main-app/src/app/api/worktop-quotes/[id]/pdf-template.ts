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
      .footer-text {
        flex: 1;
      }
      .footer-logo {
        height: 20px;
        width: auto;
        margin-left: 1em;
      }
      .visualization-page {
        page-break-before: always;
        width: 210mm;  /* A4 width */
        height: 297mm; /* A4 height */
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      .visualization-details {
        height: 20%; /* 20% of page height */
        width: 100%;
        padding: 0;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }
      .visualization-content {
        height: 80%; /* 80% of page height */
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 5mm;
        box-sizing: border-box;
      }
      .visualization-content svg {
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        display: block;
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
      })
      
      // Format dimension values for display
      const formatDimension = (value: number | null) => value !== null ? `${value}mm` : '-'
      
      return `
    <!-- Visualization Page ${index + 1} for Config ${config.config_order} -->
    <div class="visualization-page">
      <div class="visualization-details">
        <!-- Empty top section -->
      </div>
      <div class="visualization-content">
        ${svgContent || '<div style="color: red; padding: 20px;">SVG not generated</div>'}
      </div>
    </div>
      `
    }).join('') : ''}
  </body>
</html>`
}
