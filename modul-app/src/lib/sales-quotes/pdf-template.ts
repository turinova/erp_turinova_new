import {
  escapePdfHtml,
  formatPdfCurrency,
  formatPdfDate,
  quoteDocumentShellCss,
  renderQuotePdfFooter,
  renderQuotePdfHeader,
  renderQuotePdfPartyColumns
} from '@/lib/pdf/quote-document-shell'
import type { SalesQuoteDetail } from '@/lib/sales-quotes/queries'

export type SalesQuotePdfCompany = {
  name: string
  taxNumber: string | null
  postalCode: string | null
  city: string | null
  address: string | null
  email: string | null
  phone: string | null
}

export type SalesQuotePdfLogos = {
  tenantCompanyLogoBase64?: string
  turinovaLogoBase64?: string
}

export function generateSalesQuotePdfHtml(
  detail: SalesQuoteDetail,
  company: SalesQuotePdfCompany,
  logos: SalesQuotePdfLogos = {}
): string {
  const rows = detail.items
    .map((it) => {
      const qty = Number.isInteger(it.quantity)
        ? String(it.quantity)
        : it.quantity.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
      return `<tr>
        <td>${escapePdfHtml(it.name_snapshot)}</td>
        <td class="nowrap">${escapePdfHtml(it.sku_snapshot ?? '—')}</td>
        <td class="text-right nowrap">${escapePdfHtml(qty)} ${escapePdfHtml(it.unit_shortform)}</td>
        <td class="text-right nowrap">${formatPdfCurrency(it.unit_price_gross)} Ft</td>
        <td class="text-right nowrap">${formatPdfCurrency(it.total_gross)} Ft</td>
      </tr>`
    })
    .join('')

  const buyerName =
    detail.billing_name?.trim() || detail.customer_name?.trim() || '—'
  const buyerAddressLine = [
    detail.billing_postal_code,
    detail.billing_city,
    detail.billing_street,
    detail.billing_house_number
  ]
    .filter(Boolean)
    .join(' ')

  const validUntilLabel = detail.valid_until
    ? formatPdfDate(detail.valid_until)
    : '—'

  const discountRow =
    detail.discount_percentage > 0
      ? `<tr class="discount-row">
          <td colspan="4">Kedvezmény (${detail.discount_percentage}%)</td>
          <td class="text-right nowrap">—</td>
        </tr>`
      : ''

  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8" />
  <title>Árajánlat ${escapePdfHtml(detail.quote_number)}</title>
  <style>${quoteDocumentShellCss()}</style>
</head>
<body>
  <div class="content-wrapper">
    ${renderQuotePdfHeader({
      title: 'AJÁNLAT',
      quoteNumber: detail.quote_number,
      createdAt: detail.created_at,
      validUntilLabel,
      tenantCompanyLogoBase64: logos.tenantCompanyLogoBase64,
      companyNameFallback: company.name
    })}

    ${renderQuotePdfPartyColumns({
      issuerName: company.name || 'Cég',
      issuerPostalCity: [company.postalCode, company.city]
        .filter(Boolean)
        .join(' '),
      issuerAddress: company.address || '',
      issuerTaxNumber: company.taxNumber,
      buyerName,
      buyerAddressLine,
      buyerEmail: detail.customer_email,
      buyerPhone: detail.customer_mobile,
      buyerTaxNumber: detail.billing_tax_number
    })}

    <table>
      <thead>
        <tr>
          <th>Megnevezés</th>
          <th>Cikkszám</th>
          <th class="text-right nowrap">Mennyiség</th>
          <th class="text-right nowrap">Bruttó egységár</th>
          <th class="text-right nowrap">Bruttó részösszeg</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <table class="summary-table">
      <tbody>
        ${discountRow}
        <tr class="summary-row">
          <td colspan="4" class="summary-row-bold">Nettó összesen:</td>
          <td class="text-right nowrap summary-row-bold">${formatPdfCurrency(detail.subtotal_net)} Ft</td>
        </tr>
        <tr class="summary-row">
          <td colspan="4" class="summary-row-bold" style="border-top: none;">Áfa összesen:</td>
          <td class="text-right nowrap summary-row-bold" style="border-top: none;">${formatPdfCurrency(detail.total_vat)} Ft</td>
        </tr>
        <tr>
          <td colspan="4" class="summary-row-total">Bruttó összesen:</td>
          <td class="text-right nowrap summary-row-total">${formatPdfCurrency(detail.total_gross)} Ft</td>
        </tr>
      </tbody>
    </table>

    ${
      detail.note
        ? `<div class="notes-section">
            <div class="notes-title">Megjegyzés:</div>
            <div class="notes-content">${escapePdfHtml(detail.note)}</div>
          </div>`
        : ''
    }

    <p class="disclaimer">
      Ez az árajánlat nem számla. Elfogadás után eladás készül belőle.
    </p>

    <div style="flex: 1;"></div>

    ${renderQuotePdfFooter({
      turinovaLogoBase64: logos.turinovaLogoBase64
    })}
  </div>
</body>
</html>`
}
