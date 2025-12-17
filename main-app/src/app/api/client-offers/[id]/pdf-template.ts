// Plain HTML template function (no React)

interface ClientOfferItem {
  id: string
  item_type: 'product' | 'material' | 'accessory' | 'linear_material' | 'fee'
  product_name: string
  sku: string | null
  unit: string | null
  quantity: number
  unit_price_net: number
  unit_price_gross: number
  vat_id: string | null
  vat_percentage: number | null
  total_net: number
  total_vat: number
  total_gross: number
}

interface ClientOffer {
  id: string
  offer_number: string
  customer_name: string
  billing_name: string | null
  billing_country: string | null
  billing_city: string | null
  billing_postal_code: string | null
  billing_street: string | null
  billing_house_number: string | null
  billing_tax_number: string | null
  discount_percentage: number
  discount_amount: number
  notes: string | null
  created_at: string
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

interface VatRate {
  id: string
  kulcs: number
}

interface OfferPdfTemplateProps {
  offer: ClientOffer
  items: ClientOfferItem[]
  tenantCompany: TenantCompany
  vatRates: VatRate[]
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
  tenantCompanyLogoBase64?: string  // For header
  turinovaLogoBase64?: string       // For footer
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

// Helper to get unit display
const getUnitDisplay = (item: ClientOfferItem) => {
  if (item.item_type === 'material') return 'm²'
  if (item.item_type === 'linear_material') return 'm'
  return item.unit || 'db'
}

// Helper to get type label
const getTypeLabel = (item: ClientOfferItem) => {
  switch (item.item_type) {
    case 'accessory':
      return 'Kellék'
    case 'material':
      return 'Bútorlap'
    case 'linear_material':
      return 'Szálas termék'
    case 'fee':
      return 'Díj'
    default:
      return 'Termék'
  }
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

export default function generateOfferPdfHtml({
  offer,
  items,
  tenantCompany,
  vatRates,
  summary,
  discountAmount,
  discountPercentage,
  tenantCompanyLogoBase64,
  turinovaLogoBase64
}: OfferPdfTemplateProps): string {
  const itemsRows = items.map((item) => {
    const unitDisplay = getUnitDisplay(item)
    const typeLabel = getTypeLabel(item)
    const quantityWithUnit = `${item.quantity} ${escapeHtml(unitDisplay)}`
    return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(item.product_name || '')}</div>
          ${item.sku ? `<div style="font-size: 9px; color: #757575; margin-top: 0.25em;">SKU: ${escapeHtml(item.sku)}</div>` : ''}
        </td>
        <td>
          <span class="chip">${escapeHtml(typeLabel)}</span>
        </td>
        <td class="text-right nowrap">${quantityWithUnit}</td>
        <td class="text-right nowrap">${formatCurrencyPdf(item.unit_price_gross)} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(item.total_gross)} Ft</td>
      </tr>
    `
  }).join('')

  const beforeDiscountRows = (Number(discountAmount) || 0) > 0 ? `
    <tr class="summary-row">
      <td colspan="4" style="border-top: 2px solid #e0e0e0; border-bottom: 1px solid #e0e0e0;">Nettó összesen:</td>
      <td class="text-right nowrap" style="border-top: 2px solid #e0e0e0; border-bottom: 1px solid #e0e0e0;">${formatCurrencyPdf(summary.totalNetBeforeDiscount)} Ft</td>
    </tr>
    <tr class="summary-row">
      <td colspan="4" style="border-bottom: 1px solid #e0e0e0;">Áfa összesen:</td>
      <td class="text-right nowrap" style="border-bottom: 1px solid #e0e0e0;">${formatCurrencyPdf(summary.totalVatBeforeDiscount)} Ft</td>
    </tr>
    <tr class="summary-row">
      <td colspan="4" style="border-bottom: 2px solid #e0e0e0;">Bruttó összesen:</td>
      <td class="text-right nowrap" style="border-bottom: 2px solid #e0e0e0;">${formatCurrencyPdf(summary.totalGrossBeforeDiscount)} Ft</td>
    </tr>
  ` : ''

  const discountRow = (Number(discountAmount) || 0) > 0 ? `
    <tr class="discount-row">
      <td colspan="4" style="border-bottom: 1px solid #e0e0e0;">Kedvezmény${Number(discountPercentage) > 0 ? ` (${Number(discountPercentage)}%)` : ''}:</td>
      <td class="text-right nowrap" style="border-bottom: 1px solid #e0e0e0; font-weight: 500;">-${formatCurrencyPdf(Number(discountAmount))} Ft</td>
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
        padding: 8mm 4mm 4mm 4mm;
        line-height: 1.2;
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        position: relative;
      }
      .content-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .header {
        margin-bottom: 1.5em;
        padding-bottom: 1em;
        border-bottom: 1px solid #e0e0e0;
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
      .offer-number {
        font-size: 12px;
        font-weight: 600;
        color: #424242;
        margin-bottom: 0.25em;
      }
      .offer-date {
        font-size: 10px;
        color: #757575;
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
        font-weight: 600;
        color: #424242;
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
        color: #212121;
      }
      .column-item-gray {
        color: #616161;
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
        border-bottom: 1px solid #e0e0e0;
      }
      th {
        font-weight: 600;
        color: #424242;
        background-color: #f5f5f5;
        border-top: 1px solid #212121;
        padding: 6px;
      }
      td {
        color: #212121;
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
        border-top: 1px solid #e0e0e0;
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
        border-top: 1px solid #e0e0e0;
        font-size: 8px;
        color: #757575;
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
          <div class="offer-number">${escapeHtml(offer.offer_number)}</div>
          <div class="offer-date">
            <div>Kelt.: ${formatDatePdf(offer.created_at)}</div>
            <div>Érvényesség: ${calculateExpiryDate(offer.created_at)}</div>
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
          <div class="column-item column-item-bold">${escapeHtml(offer.billing_name || offer.customer_name || '')}</div>
          <div class="column-item column-item-gray">${escapeHtml([
            offer.billing_postal_code || '',
            offer.billing_city || '',
            offer.billing_street || '',
            offer.billing_house_number || ''
          ].filter(Boolean).join(' '))}</div>
          ${offer.billing_tax_number ? `<div class="column-item column-item-gray">Adószám: ${escapeHtml(offer.billing_tax_number)}</div>` : ''}
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
    
    ${offer.notes ? `
    <div class="notes-section">
      <div class="notes-title">Megjegyzés:</div>
      <div class="notes-content">${escapeHtml(offer.notes)}</div>
    </div>
    ` : ''}
    </div>
    
    <div class="footer">
      <div class="footer-text">
        Ez az ajánlat a Turinova Vállalatirányítási Rendszerrel készült.
      </div>
      ${turinovaLogoBase64 ? `<img src="data:image/png;base64,${turinovaLogoBase64}" alt="Turinova Logo" class="footer-logo" />` : ''}
    </div>
  </body>
</html>`
}

