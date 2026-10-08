/**
 * Shared visual shell for quote-like PDFs (lapszabászat + termék árajánlat).
 * Header / footer / typography / table chrome must stay 1:1 across domains.
 */

export function escapePdfHtml(text: string | null | undefined): string {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** YYYY.MM.DD. */
export function formatPdfDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}.`
}

export function formatPdfCurrency(amount: number): string {
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

/** Core CSS shared with lapszabászat quote PDF (without cutting-list extras). */
export function quoteDocumentShellCss(): string {
  return `
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
      .header-company-fallback {
        font-size: 14px;
        font-weight: 700;
        color: #212121;
        max-width: 220px;
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
      .nowrap {
        white-space: nowrap;
      }
      tbody tr:nth-child(even) {
        background-color: #fafafa;
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
      .disclaimer {
        margin-top: 1em;
        font-size: 9px;
        color: #424242;
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
  `
}

export function renderQuotePdfHeader(opts: {
  title?: string
  quoteNumber: string
  createdAt: string | null
  validUntilLabel: string
  tenantCompanyLogoBase64?: string
  companyNameFallback?: string
}): string {
  const title = opts.title ?? 'AJÁNLAT'
  const logo = opts.tenantCompanyLogoBase64
    ? `<img src="data:image/png;base64,${opts.tenantCompanyLogoBase64}" alt="Company Logo" class="header-logo" />`
    : opts.companyNameFallback
      ? `<div class="header-company-fallback">${escapePdfHtml(opts.companyNameFallback)}</div>`
      : ''

  return `
    <div class="header">
      <div class="header-row">
        <div class="header-left">${logo}</div>
        <div class="header-right">
          <div class="title">${escapePdfHtml(title)}</div>
          <div class="quote-number">${escapePdfHtml(opts.quoteNumber)}</div>
          <div class="quote-date">
            <div>Kelt.: ${escapePdfHtml(formatPdfDate(opts.createdAt))}</div>
            <div>Érvényesség: ${escapePdfHtml(opts.validUntilLabel)}</div>
          </div>
        </div>
      </div>
    </div>`
}

export function renderQuotePdfFooter(opts: {
  turinovaLogoBase64?: string
}): string {
  return `
    <div class="footer">
      <div class="footer-text">
        Ez az ajánlat a Turinova Vállalatirányítási Rendszerrel készült.
      </div>
      ${
        opts.turinovaLogoBase64
          ? `<img src="data:image/png;base64,${opts.turinovaLogoBase64}" alt="Turinova Logo" class="footer-logo" />`
          : ''
      }
    </div>`
}

export function renderQuotePdfPartyColumns(opts: {
  issuerName: string
  issuerPostalCity: string
  issuerAddress: string
  issuerTaxNumber: string | null
  buyerName: string
  buyerAddressLine: string
  buyerEmail: string | null
  buyerPhone: string | null
  buyerTaxNumber: string | null
}): string {
  return `
    <div class="two-column">
      <div class="column">
        <div class="column-title">Ajánlat adó:</div>
        <div class="column-content">
          <div class="column-item column-item-bold">${escapePdfHtml(opts.issuerName)}</div>
          ${
            opts.issuerPostalCity
              ? `<div class="column-item column-item-gray">${escapePdfHtml(opts.issuerPostalCity)}</div>`
              : ''
          }
          ${
            opts.issuerAddress
              ? `<div class="column-item column-item-gray">${escapePdfHtml(opts.issuerAddress)}</div>`
              : ''
          }
          ${
            opts.issuerTaxNumber
              ? `<div class="column-item column-item-gray">Adószám: ${escapePdfHtml(opts.issuerTaxNumber)}</div>`
              : ''
          }
        </div>
      </div>
      <div class="column">
        <div class="column-title">Vevő adatok</div>
        <div class="column-content">
          <div class="column-item column-item-bold">${escapePdfHtml(opts.buyerName || '—')}</div>
          ${
            opts.buyerAddressLine
              ? `<div class="column-item column-item-gray">${escapePdfHtml(opts.buyerAddressLine)}</div>`
              : ''
          }
          ${
            opts.buyerEmail
              ? `<div class="column-item column-item-gray">E-mail: ${escapePdfHtml(opts.buyerEmail)}</div>`
              : ''
          }
          ${
            opts.buyerPhone
              ? `<div class="column-item column-item-gray">Telefon: ${escapePdfHtml(opts.buyerPhone)}</div>`
              : ''
          }
          ${
            opts.buyerTaxNumber
              ? `<div class="column-item column-item-gray">Adószám: ${escapePdfHtml(opts.buyerTaxNumber)}</div>`
              : ''
          }
        </div>
      </div>
    </div>`
}
