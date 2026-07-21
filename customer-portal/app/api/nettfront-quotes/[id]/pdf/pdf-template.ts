/** Fronttervező árajánlat PDF — Opti quotes PDF sablon struktúra / stílus, Front adatokkal */

type SkuSummary = {
  id: string
  display_name: string
  finish: string | null
  front_type?: string | null
  panels_db: number
  total_sqm: number
  sell_net_per_sqm: number
  net: number
  vat: number
  gross: number
}

type ServiceRow = {
  id: string
  service_type: string
  quantity: number
  unit_price_net: number
  net: number
  vat: number
  gross: number
}

type FeeRow = {
  id: string
  fee_name: string
  quantity: number
  unit_price_net: number
  vat_rate: number
  vat_amount: number
  gross_price: number
}

type LineRow = {
  id: string
  display_name: string
  finish: string | null
  height_mm: number
  width_mm: number
  quantity: number
  panthely_holes_total: number
  megjegyzes: string | null
}

type Customer = {
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

type TenantCompany = {
  name: string
  country?: string | null
  city?: string | null
  postal_code?: string | null
  address?: string | null
  tax_number?: string | null
}

export type FronttervezoPdfTemplateProps = {
  quote: {
    id: string
    quote_number: string
    order_number?: string | null
    barcode?: string | null
    created_at: string
    comment: string | null
    customer: Customer | null
    sku_summary: SkuSummary[]
    services: ServiceRow[]
    fees: FeeRow[]
    lines: LineRow[]
  }
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

const formatDatePdf = (dateString: string) => {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}.`
}

const calculateExpiryDate = (dateString: string) => {
  const date = new Date(dateString)
  date.setDate(date.getDate() + 14)
  return formatDatePdf(date.toISOString())
}

const formatCurrencyPdf = (amount: number) =>
  new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)

const formatCurrencyPdfWithDecimals = (amount: number) =>
  new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)

const escapeHtml = (text: string | null | undefined) => {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const finishLabel = (finish: string | null) => {
  if (finish === 'hg') return 'Fényes'
  if (finish === 'matt') return 'Matt'
  return ''
}

const serviceName = (type: string) => {
  if (type === 'panthelyfuras') return 'Pánthely fúrás'
  return type
}

export default function generateFronttervezoQuotePdfHtml({
  quote,
  tenantCompany,
  summary,
  discountAmount,
  discountPercentage,
  tenantCompanyLogoBase64,
  turinovaLogoBase64
}: FronttervezoPdfTemplateProps): string {
  const customer = quote.customer
  const barcode = quote.barcode || null
  const barcodeSvgId = `barcode-${quote.id}`
  const headerTitle = quote.order_number ? 'MEGRENDELÉS' : 'AJÁNLAT'
  const headerNumber = quote.order_number || quote.quote_number

  const barcodeHeaderHtml = barcode
    ? `
        <div class="header-center">
          <div class="header-barcode">
            <svg id="${barcodeSvgId}"></svg>
            <div class="header-barcode-text">${escapeHtml(barcode)}</div>
          </div>
        </div>
        `
    : ''

  const barcodeScriptHtml = barcode
    ? `
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <script>
      JsBarcode("#${barcodeSvgId}", ${JSON.stringify(barcode)}, {
        format: "EAN13",
        width: 2.5,
        height: 50,
        displayValue: false,
        margin: 0
      });
    </script>
    `
    : ''

  const skuRows = (quote.sku_summary || [])
    .map(row => {
      const sqm = Number(row.total_sqm) || 0
      const gross = Number(row.gross) || 0
      const unitGross = sqm > 0 ? gross / sqm : 0
      const roundedUnit = Math.round(unitGross * 100) / 100
      const finish = finishLabel(row.finish) || '—'
      const qty = `${sqm.toFixed(2)} m² / ${row.panels_db} db`
      const rawType = (row.front_type || 'inomat').toLowerCase()
      const typeLabel = rawType === 'inomat' ? 'Inomat' : rawType.charAt(0).toUpperCase() + rawType.slice(1)

      return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(row.display_name)}</div>
        </td>
        <td><span class="chip">${escapeHtml(typeLabel)}</span></td>
        <td><span class="chip">${escapeHtml(finish)}</span></td>
        <td class="text-right nowrap">${qty}</td>
        <td class="text-right nowrap">${formatCurrencyPdfWithDecimals(roundedUnit)} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(Math.round(gross))} Ft</td>
      </tr>`
    })
    .join('')

  const serviceRows = (quote.services || [])
    .map(svc => {
      const qty = Number(svc.quantity) || 0
      const gross = Number(svc.gross) || 0
      const unitGross = qty > 0 ? gross / qty : 0
      const roundedUnit = Math.round(unitGross)
      return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(serviceName(svc.service_type))}</div>
        </td>
        <td><span class="chip">Szolgáltatás</span></td>
        <td>—</td>
        <td class="text-right nowrap">${qty} db</td>
        <td class="text-right nowrap">${formatCurrencyPdf(roundedUnit)} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(Math.round(gross))} Ft</td>
      </tr>`
    })
    .join('')

  const feeRows = (quote.fees || [])
    .map(fee => {
      const qty = Number(fee.quantity) || 1
      const gross = Number(fee.gross_price) || 0
      const unitGross = qty > 0 ? gross / qty : 0
      const roundedUnit = Math.round(unitGross)
      return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(fee.fee_name)}</div>
        </td>
        <td><span class="chip">Díj</span></td>
        <td>—</td>
        <td class="text-right nowrap">${qty} db</td>
        <td class="text-right nowrap">${formatCurrencyPdf(roundedUnit)} Ft</td>
        <td class="text-right nowrap" style="font-weight: 500;">${formatCurrencyPdf(Math.round(gross))} Ft</td>
      </tr>`
    })
    .join('')

  const itemsRows = skuRows + serviceRows + feeRows

  const beforeDiscountRows =
    (Number(discountAmount) || 0) > 0
      ? `
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
  `
      : ''

  const discountRow =
    (Number(discountAmount) || 0) > 0
      ? `
    <tr class="discount-row">
      <td colspan="5" style="border-bottom: 1px solid #000000;">Kedvezmény${Number(discountPercentage) > 0 ? ` (${Number(discountPercentage)}%)` : ''}:</td>
      <td class="text-right nowrap" style="border-bottom: 1px solid #000000; font-weight: 500;">-${formatCurrencyPdf(Number(discountAmount))} Ft</td>
    </tr>
  `
      : ''

  const lineRows = (quote.lines || [])
    .map(line => {
      const pant =
        line.panthely_holes_total > 0 ? `${line.panthely_holes_total} db` : '—'
      return `
      <tr>
        <td class="text-left">${escapeHtml(line.display_name)}</td>
        <td class="text-right">${line.height_mm}</td>
        <td class="text-right">${line.width_mm}</td>
        <td class="text-right">${line.quantity}</td>
        <td class="text-center">${pant}</td>
        <td class="text-left">${escapeHtml(line.megjegyzes || '—')}</td>
      </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="hu">
  <head>
    <meta charset="UTF-8" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { margin: 0; size: A4; }
      html, body { height: 100%; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 11px; color: #212121; background: white;
        padding: 8mm 4mm 8mm 4mm; line-height: 1.2;
        display: flex; flex-direction: column; min-height: 100vh; box-sizing: border-box;
      }
      .content-wrapper { flex: 1; display: flex; flex-direction: column; min-height: calc(100vh - 16mm); }
      .header { margin-bottom: 1.5em; padding-bottom: 1em; border-bottom: 1px solid #000000; }
      .header-row { display: flex; justify-content: space-between; align-items: flex-start; }
      .header-left { flex-shrink: 0; }
      .header-logo { max-height: 50px; max-width: 220px; width: auto; height: auto; }
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
      .header-barcode svg { width: 100%; height: auto; }
      .header-barcode-text {
        font-size: 8px;
        font-family: monospace;
        letter-spacing: 1px;
        text-align: center;
        margin-top: 1mm;
      }
      .header-right { text-align: right; flex: 1; }
      .title { font-size: 16px; font-weight: 700; color: #212121; margin-bottom: 0.25em; }
      .quote-number { font-size: 12px; font-weight: 600; color: #424242; margin-bottom: 0.25em; }
      .quote-date { font-size: 10px; color: #000000; }
      .two-column { display: flex; gap: 2em; margin-bottom: 1.5em; }
      .column { flex: 1; }
      .column-title { font-size: 11px; font-weight: 700; color: #000000; margin-bottom: 0.5em; }
      .column-content { padding-left: 0.5em; }
      .column-item { font-size: 10px; margin-bottom: 0.25em; }
      .column-item-bold { font-weight: 500; color: #000000; }
      .column-item-gray { color: #000000; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 1.5em; font-size: 10px; }
      th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #000000; }
      th { font-weight: 700; color: #000000; background-color: #f5f5f5; border-top: 1px solid #000000; padding: 6px; }
      td { color: #000000; }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .nowrap { white-space: nowrap; }
      tbody tr:nth-child(even) { background-color: #fafafa; }
      .chip {
        display: inline-block; padding: 2px 8px; border: 1px solid #212121;
        border-radius: 12px; font-size: 9px; font-weight: 500; color: #212121; background-color: transparent;
      }
      .summary-table { margin-top: 1.5em; }
      .summary-row { background-color: #f5f5f5; }
      .summary-row-bold { font-weight: 700; font-size: 11px; color: #212121; border-top: 2px solid #212121; padding: 6px 8px; }
      .summary-row-total { background-color: #212121; color: #ffffff; font-weight: 700; font-size: 12px; padding: 8px; border-bottom: none; }
      .discount-row { color: #616161; }
      .notes-section { margin-top: 1.5em; padding-top: 1em; border-top: 1px solid #000000; }
      .notes-title { font-size: 10px; font-weight: 600; color: #424242; margin-bottom: 0.5em; }
      .notes-content { font-size: 10px; color: #212121; white-space: pre-wrap; }
      .footer {
        margin-top: auto; padding-top: 1em; border-top: 1px solid #000000;
        font-size: 8px; color: #000000; flex-shrink: 0;
        display: flex; justify-content: space-between; align-items: center;
      }
      .footer-text { flex: 1; }
      .footer-logo { height: 20px; width: auto; margin-left: 1em; }
      .page-break {
        page-break-before: always; min-height: 100vh; display: flex; flex-direction: column;
        padding: 8mm 4mm 8mm 4mm; box-sizing: border-box;
      }
      .page-break .content-wrapper { flex: 1; display: flex; flex-direction: column; min-height: calc(100vh - 16mm); }
      .page-break .footer { margin-top: auto; flex-shrink: 0; }
      .cutting-list-title { font-size: 14px; font-weight: 700; color: #000000; margin-bottom: 1em; text-align: center; }
      .cutting-list-table { font-size: 9px; }
      .cutting-list-table th, .cutting-list-table td { padding: 3px 4px; font-size: 9px; border: 1px solid #000000; }
      .cutting-list-table th { background-color: #f5f5f5; font-weight: 700; }
      .cutting-list-table td { text-align: center; }
      .cutting-list-table td.text-left { text-align: left; }
      .cutting-list-table td.text-right { text-align: right; }
    </style>
  </head>
  <body>
    <div class="content-wrapper">
    <div class="header">
      <div class="header-row">
        <div class="header-left">
          ${tenantCompanyLogoBase64 ? `<img src="data:image/png;base64,${tenantCompanyLogoBase64}" alt="Company Logo" class="header-logo" />` : ''}
        </div>
        ${barcodeHeaderHtml}
        <div class="header-right">
          <div class="title">${headerTitle}</div>
          <div class="quote-number">${escapeHtml(headerNumber)}</div>
          <div class="quote-date">
            <div>Kelt.: ${formatDatePdf(quote.created_at)}</div>
            <div>Érvényesség: ${calculateExpiryDate(quote.created_at)}</div>
          </div>
        </div>
      </div>
    </div>
    ${barcodeScriptHtml}

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
          <div class="column-item column-item-bold">${escapeHtml(customer?.billing_name || customer?.name || '')}</div>
          <div class="column-item column-item-gray">${escapeHtml(
            [
              customer?.billing_postal_code || '',
              customer?.billing_city || '',
              customer?.billing_street || '',
              customer?.billing_house_number || ''
            ]
              .filter(Boolean)
              .join(' ')
          )}</div>
          ${customer?.email ? `<div class="column-item column-item-gray">E-mail: ${escapeHtml(customer.email)}</div>` : ''}
          ${customer?.mobile ? `<div class="column-item column-item-gray">Telefon: ${escapeHtml(customer.mobile)}</div>` : ''}
          ${customer?.billing_tax_number ? `<div class="column-item column-item-gray">Adószám: ${escapeHtml(customer.billing_tax_number)}</div>` : ''}
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Megnevezés</th>
          <th>Típus</th>
          <th>Felület</th>
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

    ${
      quote.comment
        ? `
    <div class="notes-section">
      <div class="notes-title">Megjegyzés:</div>
      <div class="notes-content">${escapeHtml(quote.comment)}</div>
    </div>
    `
        : ''
    }

    <div style="flex: 1;"></div>

    <div class="footer">
      <div class="footer-text">
        Ez az ajánlat a Turinova Vállalatirányítási Rendszerrel készült.
      </div>
      ${turinovaLogoBase64 ? `<img src="data:image/png;base64,${turinovaLogoBase64}" alt="Turinova Logo" class="footer-logo" />` : ''}
    </div>
    </div>

    ${
      quote.lines && quote.lines.length > 0
        ? `
    <div class="page-break">
      <div class="content-wrapper">
        <div class="header">
          <div class="header-row">
            <div class="header-left">
              ${tenantCompanyLogoBase64 ? `<img src="data:image/png;base64,${tenantCompanyLogoBase64}" alt="Company Logo" class="header-logo" />` : ''}
            </div>
            ${
              barcode
                ? `
            <div class="header-center">
              <div class="header-barcode">
                <svg id="${barcodeSvgId}-p2"></svg>
                <div class="header-barcode-text">${escapeHtml(barcode)}</div>
              </div>
            </div>
            `
                : ''
            }
            <div class="header-right">
              <div class="title">${headerTitle}</div>
              <div class="quote-number">${escapeHtml(headerNumber)}</div>
              <div class="quote-date">
                <div>Kelt.: ${formatDatePdf(quote.created_at)}</div>
                <div>Érvényesség: ${calculateExpiryDate(quote.created_at)}</div>
              </div>
            </div>
          </div>
        </div>
        ${
          barcode
            ? `
        <script>
          JsBarcode("#${barcodeSvgId}-p2", ${JSON.stringify(barcode)}, {
            format: "EAN13",
            width: 2.5,
            height: 50,
            displayValue: false,
            margin: 0
          });
        </script>
        `
            : ''
        }

        <div class="cutting-list-title">Front tételek</div>

        <table class="cutting-list-table">
          <thead>
            <tr>
              <th>Szín</th>
              <th class="text-right">Magasság</th>
              <th class="text-right">Szélesség</th>
              <th class="text-right">Darab</th>
              <th class="text-center">Pánthely</th>
              <th>Megjegyzés</th>
            </tr>
          </thead>
          <tbody>
            ${lineRows}
          </tbody>
        </table>

        <div style="flex: 1;"></div>

        <div class="footer">
          <div class="footer-text">
            Ez az ajánlat a Turinova Vállalatirányítási Rendszerrel készült.
          </div>
          ${turinovaLogoBase64 ? `<img src="data:image/png;base64,${turinovaLogoBase64}" alt="Turinova Logo" class="footer-logo" />` : ''}
        </div>
      </div>
    </div>
    `
        : ''
    }
  </body>
</html>`
}
