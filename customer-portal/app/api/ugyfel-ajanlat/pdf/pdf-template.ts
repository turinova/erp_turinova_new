/** Ügyfélajánlat PDF — üres / csak manuális tételek (nincs gyártói forrás) */

import {
  renderCustomerFacingClosingHtml,
  renderPaletteCss,
  renderWorkshopLogoHtml,
  type PdfPaletteId
} from '@/lib/customer-facing-pdf-extras'

type WorkshopProfile = {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  postalCode?: string | null
  taxNumber?: string | null
}

type Buyer = {
  name: string
  email: string
  mobile: string
  billing_name: string
  billing_city: string
  billing_postal_code: string
  billing_street: string
  billing_house_number: string
  billing_tax_number: string
}

type ManualLine = {
  type?: string
  title: string
  quantity: number
  unit?: string
  unitPriceGross: number
}

export type EmptyCustomerFacingPdfProps = {
  quoteNumber: string
  createdAt: string
  workshop: WorkshopProfile
  buyer: Buyer
  preparedBy: string
  portalSourceRows?: Array<{
    title: string
    subtitle?: string
    quantityLabel?: string
    unitPriceGross: number
    lineTotalGross?: number
  }>
  manualLines: ManualLine[]
  validUntilDisplay: string
  turinovaLogoBase64?: string
  workshopLogoDataUrl?: string
  projectTitle?: string
  paymentText?: string
  leadTimeNote?: string
  customerNotes?: string
  paletteId?: PdfPaletteId
  accentHex?: string
  showVatNote?: boolean
}

const MANUAL_TYPE_LABEL: Record<string, string> = {
  shipping: 'Szállítás',
  assembly: 'Szerelés',
  hardware: 'Vasalat',
  fee: 'Díj',
  other: 'Egyéb'
}

function escapeHtml(text: string) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatCurrencyPdf(n: number) {
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(n))
}

function formatDatePdf(dateString: string) {
  const date = new Date(dateString)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}.${m}.${d}.`
}

export default function generateEmptyCustomerFacingPdfHtml({
  quoteNumber,
  createdAt,
  workshop,
  buyer,
  preparedBy,
  portalSourceRows = [],
  manualLines = [],
  validUntilDisplay,
  turinovaLogoBase64,
  workshopLogoDataUrl,
  projectTitle,
  paymentText,
  leadTimeNote,
  customerNotes,
  paletteId,
  accentHex,
  showVatNote
}: EmptyCustomerFacingPdfProps): string {
  const portalRows = (portalSourceRows || [])
    .filter(row => {
      const total =
        row.lineTotalGross != null
          ? Number(row.lineTotalGross)
          : Number(row.unitPriceGross)
      return row.title?.trim() && total > 0
    })
    .map(row => {
      const lineTotal = Math.round(
        row.lineTotalGross != null
          ? Number(row.lineTotalGross) || 0
          : Number(row.unitPriceGross) || 0
      )
      const unitPrice = Math.round(Number(row.unitPriceGross) || lineTotal)
      const qtyLabel = (row.quantityLabel || '1 db').trim() || '1 db'
      return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(row.title.trim())}</div>
          ${
            row.subtitle
              ? `<div style="font-size: 9px; color: #616161; margin-top: 2px;">${escapeHtml(row.subtitle)}</div>`
              : ''
          }
        </td>
        <td class="text-right nowrap">${escapeHtml(qtyLabel)}</td>
        <td class="text-right nowrap">${formatCurrencyPdf(unitPrice)} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(lineTotal)} Ft</td>
      </tr>`
    })
    .join('')

  const manualRows = (manualLines || [])
    .filter(line => line.title?.trim() && Number(line.quantity) > 0)
    .map(line => {
      const qty = Number(line.quantity) || 0
      const unitPrice = Number(line.unitPriceGross) || 0
      const total = Math.round(qty * unitPrice)
      const unitLabel = (line.unit || 'db').trim() || 'db'
      const typeLabel = MANUAL_TYPE_LABEL[line.type || 'other'] || 'Egyéb'
      return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(line.title.trim())}</div>
          <div style="font-size: 9px; color: #616161; margin-top: 2px;">${escapeHtml(typeLabel)}</div>
        </td>
        <td class="text-right nowrap">${qty} ${escapeHtml(unitLabel)}</td>
        <td class="text-right nowrap">${formatCurrencyPdf(Math.round(unitPrice))} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(total)} Ft</td>
      </tr>`
    })
    .join('')

  const portalTotal = (portalSourceRows || [])
    .filter(row => {
      const total =
        row.lineTotalGross != null
          ? Number(row.lineTotalGross)
          : Number(row.unitPriceGross)
      return row.title?.trim() && total > 0
    })
    .reduce((sum, row) => {
      const total =
        row.lineTotalGross != null
          ? Number(row.lineTotalGross)
          : Number(row.unitPriceGross)
      return sum + Math.round(total || 0)
    }, 0)

  const manualTotal = (manualLines || [])
    .filter(line => line.title?.trim() && Number(line.quantity) > 0)
    .reduce(
      (sum, line) =>
        sum + Math.round((Number(line.quantity) || 0) * (Number(line.unitPriceGross) || 0)),
      0
    )

  const payableGross = portalTotal + manualTotal
  const tableBody =
    portalRows + manualRows ||
    `<tr><td colspan="4" style="text-align:center;color:#757575;">Nincs tétel</td></tr>`

  const workshopAddressLine = [workshop.postalCode || '', workshop.city || '', workshop.address || '']
    .filter(Boolean)
    .join(' ')

  return `<!DOCTYPE html>
<html lang="hu">
  <head>
    <meta charset="UTF-8" />
    <style>
      ${renderPaletteCss({ paletteId, accentHex })}
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { margin: 0; size: A4; }
      html, body { height: 100%; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 11px; color: var(--pdf-ink); background: white;
        padding: 8mm 4mm 8mm 4mm; line-height: 1.2;
        display: flex; flex-direction: column; min-height: 100vh; box-sizing: border-box;
      }
      .content-wrapper { flex: 1; display: flex; flex-direction: column; min-height: calc(100vh - 16mm); }
      .header { margin-bottom: 1.5em; padding-bottom: 1em; border-bottom: 1px solid var(--pdf-rule); }
      .header-row { display: flex; justify-content: space-between; align-items: flex-start; }
      .header-left { flex-shrink: 0; }
      .header-logo { max-height: 48px; max-width: 200px; width: auto; height: auto; display: block; }
      .header-right { text-align: right; flex: 1; }
      .title { font-size: 16px; font-weight: 700; color: var(--pdf-accent); margin-bottom: 0.25em; }
      .project-title { font-size: 11px; font-weight: 600; color: var(--pdf-muted); margin-bottom: 0.25em; }
      .quote-number { font-size: 12px; font-weight: 600; color: var(--pdf-muted); margin-bottom: 0.25em; }
      .quote-date { font-size: 10px; color: var(--pdf-ink); }
      .two-column { display: flex; gap: 2em; margin-bottom: 1.5em; }
      .column { flex: 1; }
      .column-title { font-size: 11px; font-weight: 700; color: var(--pdf-accent); margin-bottom: 0.5em; }
      .column-content { padding-left: 0.5em; }
      .column-item { font-size: 10px; margin-bottom: 0.25em; }
      .column-item-bold { font-weight: 500; color: var(--pdf-ink); }
      .column-item-gray { color: var(--pdf-ink); }
      table { width: 100%; border-collapse: collapse; margin-bottom: 1.5em; font-size: 10px; }
      th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid var(--pdf-rule); }
      th { font-weight: 700; color: var(--pdf-ink); background-color: var(--pdf-th-bg); border-top: 1px solid var(--pdf-rule); padding: 6px; }
      td { color: var(--pdf-ink); }
      .text-right { text-align: right; }
      .nowrap { white-space: nowrap; }
      tbody tr:nth-child(even) { background-color: #fafafa; }
      .summary-table { margin-top: 1.5em; }
      .summary-row-total { background-color: var(--pdf-total-bg); color: var(--pdf-total-fg); font-weight: 700; font-size: 12px; padding: 8px; border-bottom: none; }
      .notes-section { margin-top: 1.25em; padding-top: 0.75em; border-top: 1px solid var(--pdf-rule); font-size: 10px; color: var(--pdf-ink); line-height: 1.35; }
      .footer {
        margin-top: auto; padding-top: 1em; border-top: 1px solid var(--pdf-rule);
        font-size: 8px; color: var(--pdf-ink); flex-shrink: 0;
        display: flex; justify-content: space-between; align-items: center;
      }
      .footer-text { flex: 1; }
      .footer-logo { height: 20px; width: auto; margin-left: 1em; }
    </style>
  </head>
  <body>
    <div class="content-wrapper">
    <div class="header">
      <div class="header-row">
        <div class="header-left">${renderWorkshopLogoHtml(workshopLogoDataUrl)}</div>
        <div class="header-right">
          <div class="title">AJÁNLAT</div>
          ${projectTitle ? `<div class="project-title">${escapeHtml(projectTitle)}</div>` : ''}
          <div class="quote-number">${escapeHtml(quoteNumber)}</div>
          <div class="quote-date">
            <div>Kelt.: ${formatDatePdf(createdAt)}</div>
            <div>Érvényesség: ${escapeHtml(validUntilDisplay)}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="two-column">
      <div class="column">
        <div class="column-title">Ajánlat adó:</div>
        <div class="column-content">
          <div class="column-item column-item-bold" style="font-size: 12px; font-weight: 700;">${escapeHtml(workshop.name || '')}</div>
          ${workshopAddressLine ? `<div class="column-item column-item-gray">${escapeHtml(workshopAddressLine)}</div>` : ''}
          ${workshop.phone ? `<div class="column-item column-item-gray">Telefon: ${escapeHtml(workshop.phone)}</div>` : ''}
          ${workshop.email ? `<div class="column-item column-item-gray">E-mail: ${escapeHtml(workshop.email)}</div>` : ''}
          ${workshop.taxNumber ? `<div class="column-item column-item-gray">Adószám: ${escapeHtml(workshop.taxNumber)}</div>` : ''}
          ${preparedBy ? `<div class="column-item column-item-bold" style="margin-top: 0.5em;">Készítette: ${escapeHtml(preparedBy)}</div>` : ''}
        </div>
      </div>

      <div class="column">
        <div class="column-title">Vevő adatok</div>
        <div class="column-content">
          <div class="column-item column-item-bold">${escapeHtml(buyer.billing_name || buyer.name || '')}</div>
          <div class="column-item column-item-gray">${escapeHtml(
            [
              buyer.billing_postal_code || '',
              buyer.billing_city || '',
              buyer.billing_street || '',
              buyer.billing_house_number || ''
            ]
              .filter(Boolean)
              .join(' ')
          )}</div>
          ${buyer.email ? `<div class="column-item column-item-gray">E-mail: ${escapeHtml(buyer.email)}</div>` : ''}
          ${buyer.mobile ? `<div class="column-item column-item-gray">Telefon: ${escapeHtml(buyer.mobile)}</div>` : ''}
          ${buyer.billing_tax_number ? `<div class="column-item column-item-gray">Adószám: ${escapeHtml(buyer.billing_tax_number)}</div>` : ''}
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Megnevezés</th>
          <th class="text-right nowrap">Mennyiség</th>
          <th class="text-right nowrap">Bruttó egységár</th>
          <th class="text-right nowrap">Bruttó részösszeg</th>
        </tr>
      </thead>
      <tbody>
        ${tableBody}
      </tbody>
    </table>

    <table class="summary-table">
      <tbody>
        <tr>
          <td colspan="3" class="summary-row-total">Bruttó összesen:</td>
          <td class="text-right nowrap summary-row-total">${formatCurrencyPdf(payableGross)} Ft</td>
        </tr>
      </tbody>
    </table>

    ${renderCustomerFacingClosingHtml({
      workshopPhone: workshop.phone,
      workshopEmail: workshop.email,
      paymentText,
      leadTimeNote,
      customerNotes,
      showVatNote
    })}

    <div style="flex: 1;"></div>

    <div class="footer">
      <div class="footer-text">
        Ez az ajánlat a Turinova Vállalatirányítási Rendszerrel készült.
      </div>
      ${turinovaLogoBase64 ? `<img src="data:image/png;base64,${turinovaLogoBase64}" alt="Turinova Logo" class="footer-logo" />` : ''}
    </div>
    </div>
  </body>
</html>`
}
