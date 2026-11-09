/** Jelenléti ív HTML (hivatalos + belső) — UI/footer megegyezik az ajánlat PDF-fel. */

import type { TenantCompanyRow } from '@/lib/company/queries'
import {
  formatHours,
  type SheetEmployee,
  type SheetResult
} from '@/lib/jelenlet/sheet-engine'
import type { SheetRules } from '@/lib/jelenlet/sheet-rules'

export type SheetPdfCompany = {
  name: string
  city: string | null
  postal_code: string | null
  address: string | null
  tax_number: string | null
}

export function companyToSheetPdf(company: TenantCompanyRow | null): SheetPdfCompany {
  return {
    name: company?.name ?? '',
    city: company?.city ?? null,
    postal_code: company?.postal_code ?? null,
    address: company?.address ?? null,
    tax_number: company?.tax_number ?? null
  }
}

export type SheetHtmlInput = {
  company: SheetPdfCompany
  employee: SheetEmployee
  year: number
  month: number
  result: SheetResult
  rules: SheetRules
  presetName: string
  tenantCompanyLogoBase64?: string
  turinovaLogoBase64?: string
}

export const SHEET_MONTH_NAMES = [
  'Január',
  'Február',
  'Március',
  'Április',
  'Május',
  'Június',
  'Július',
  'Augusztus',
  'Szeptember',
  'Október',
  'November',
  'December'
]

const DAY_NAMES = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']

function escapeHtml(text: string | null | undefined) {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function lunchCell(start: string | null, end: string | null): string {
  if (!start || !end) return '-'
  return `${start} - ${end}`
}

export function generateSheetHtml(input: SheetHtmlInput): string {
  const { company, employee, year, month, result, rules } = input
  const official = rules.base === 'official'
  const monthName = SHEET_MONTH_NAMES[month - 1] ?? ''
  const addressLine = [company.postal_code, company.city].filter(Boolean).join(' ')
  const s = result.summary

  const tableRows = result.rows
    .map((r) => {
      const hours = r.hoursEmphasis
        ? `<strong>${escapeHtml(r.hoursText)}</strong>`
        : escapeHtml(r.hoursText)
      const note = r.note ? ` <span class="note">(${escapeHtml(r.note)})</span>` : ''
      return `
      <tr${r.dayOfWeek === 0 || r.dayOfWeek === 6 ? ' class="weekend"' : ''}>
        <td>${escapeHtml(`${r.date.slice(5, 7)}.${r.date.slice(8, 10)} ${DAY_NAMES[r.dayOfWeek] ?? ''}`)}</td>
        <td>${escapeHtml(r.arrival ?? '-')}</td>
        <td>${escapeHtml(lunchCell(r.lunchStart, r.lunchEnd))}</td>
        <td>${escapeHtml(r.departure ?? '-')}</td>
        <td>${escapeHtml(r.status)}</td>
        <td align="right">${hours}${note}</td>
      </tr>`
    })
    .join('')

  const summaryRows: string[] = [
    `<div class="summary-row"><span class="summary-label">Összes dolgozott óra:</span><span>${formatHours(s.totalMinutes)} óra</span></div>`
  ]
  if (!official || s.overtimeMinutes > 0) {
    summaryRows.push(
      `<div class="summary-row"><span class="summary-label">Összes túlóra:</span><span>${formatHours(s.overtimeMinutes)} óra</span></div>`
    )
  }
  summaryRows.push(
    `<div class="summary-row"><span class="summary-label">Ledolgozott munkanapok:</span><span>${s.daysWorked} nap</span></div>`,
    `<div class="summary-row"><span class="summary-label">Távollét:</span><span>${s.absentDays} nap</span></div>`
  )
  if (rules.saturday !== 'hidden') {
    summaryRows.push(
      `<div class="summary-row"><span class="summary-label">Szombati munka:</span><span>${s.saturdayDays} nap${s.saturdayMinutes > 0 ? ` · ${formatHours(s.saturdayMinutes)} óra` : ''}</span></div>`
    )
  }
  if (!official && s.leaveWorkDays > 0) {
    summaryRows.push(
      `<div class="summary-row"><span class="summary-label">Távollét + munka:</span><span>${s.leaveWorkDays} nap</span></div>`
    )
  }

  const badge = official ? 'HIVATALOS' : 'BELSŐ · PAPÍR NÉZET'

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
        font-size: 9px;
        color: #212121;
        background: white;
        padding: 8mm 4mm 8mm 4mm;
        line-height: 1.2;
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }
      .content-wrapper { flex: 1; display: flex; flex-direction: column; min-height: calc(100vh - 16mm); }
      .header { margin-bottom: 0.8em; }
      .header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
      .header-logo { max-height: 42px; max-width: 160px; object-fit: contain; }
      .header-right { text-align: right; flex: 1; }
      .title { font-size: 16px; font-weight: 700; color: #000; letter-spacing: 0.02em; }
      .subtitle { font-size: 12px; font-weight: 600; color: #424242; margin-top: 0.15em; }
      .badge { display: inline-block; margin-top: 0.35em; border: 1px solid #000; padding: 2px 6px; font-size: 8px; font-weight: 700; letter-spacing: 0.04em; }
      .badge.internal { border-width: 2px; }
      .preset { font-size: 8px; color: #616161; margin-top: 0.25em; }
      .company-block { margin: 0.6em 0 0.8em; font-size: 10px; }
      .company-name { font-weight: 700; font-size: 11px; margin-bottom: 0.15em; }
      .company-line { color: #616161; }
      .employee-info { margin-bottom: 0.7em; font-size: 12px; border: 1px solid #000; padding: 8px 10px; background-color: #f9f9f9; }
      .employee-info-row { margin-bottom: 0.2em; }
      .employee-info-row:last-child { margin-bottom: 0; }
      .employee-label { font-weight: 600; display: inline-block; width: 140px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 0.8em; font-size: 8px; }
      th { background-color: #f5f5f5; border: 1px solid #000; padding: 5px 6px; text-align: left; font-weight: 600; font-size: 8px; }
      th:last-child { text-align: right; }
      td { border: 1px solid #000; padding: 5px 6px; font-size: 8px; line-height: 1.35; }
      td:last-child { text-align: right; }
      tr.weekend td { background-color: #fafafa; }
      .note { font-size: 0.85em; color: #666; font-style: italic; }
      .summary-section { margin-top: 0.5em; margin-bottom: 0.6em; font-size: 11px; border: 1px solid #000; padding: 8px 10px; background-color: #f9f9f9; }
      .summary-row { margin-bottom: 0.25em; }
      .summary-row:last-child { margin-bottom: 0; }
      .summary-label { font-weight: 600; display: inline-block; width: 160px; }
      .signature-section { margin-top: auto; margin-bottom: 0.6em; display: flex; justify-content: flex-end; gap: 48px; }
      .signature-box { text-align: center; width: 180px; }
      .signature-line { border-bottom: 1px dotted #000; margin-bottom: 0.3em; height: 28px; }
      .signature-label { font-size: 11px; font-weight: 500; }
      .footer { margin-top: auto; padding-top: 1em; border-top: 1px solid #000; font-size: 8px; color: #000; display: flex; justify-content: space-between; align-items: center; }
      .footer-text { flex: 1; }
      .footer-logo { height: 20px; width: auto; margin-left: 1em; }
    </style>
  </head>
  <body>
    <div class="content-wrapper">
      <div class="header">
        <div class="header-row">
          <div>
            ${input.tenantCompanyLogoBase64 ? `<img src="data:image/png;base64,${input.tenantCompanyLogoBase64}" alt="Cég logo" class="header-logo" />` : ''}
          </div>
          <div class="header-right">
            <div class="title">JELENLÉTI ÍV</div>
            <div class="subtitle">${year} ${escapeHtml(monthName)}</div>
            <div class="badge${official ? '' : ' internal'}">${badge}</div>
            ${official ? '' : `<div class="preset">Sablon: ${escapeHtml(input.presetName)} — nem hivatalos dokumentum</div>`}
          </div>
        </div>
      </div>

      <div class="company-block">
        <div class="company-name">${escapeHtml(company.name)}</div>
        ${addressLine ? `<div class="company-line">${escapeHtml(addressLine)}</div>` : ''}
        ${company.address ? `<div class="company-line">${escapeHtml(company.address)}</div>` : ''}
        ${company.tax_number ? `<div class="company-line">Adószám: ${escapeHtml(company.tax_number)}</div>` : ''}
      </div>

      <div class="employee-info">
        <div class="employee-info-row"><span class="employee-label">Munkavállaló neve:</span><span>${escapeHtml(employee.name)}</span></div>
        ${employee.code ? `<div class="employee-info-row"><span class="employee-label">Azonosító:</span><span>${escapeHtml(employee.code)}</span></div>` : ''}
        <div class="employee-info-row"><span class="employee-label">Munkakör:</span><span>${escapeHtml(employee.typeName || '—')}</span></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Dátum</th>
            <th>Érkezés</th>
            <th>Munkaidő szünet</th>
            <th>Távozás</th>
            <th>Státusz</th>
            <th>Ledolgozott óra</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>

      <div class="summary-section">${summaryRows.join('')}</div>

      <div class="signature-section">
        ${rules.showEmployeeSignature ? '<div class="signature-box"><div class="signature-line"></div><div class="signature-label">Dolgozó aláírása</div></div>' : ''}
        <div class="signature-box"><div class="signature-line"></div><div class="signature-label">Engedélyező aláírása</div></div>
      </div>

      <div class="footer">
        <div class="footer-text">Ez a jelenléti ív a Turinova Vállalatirányítási Rendszerrel készült.</div>
        ${input.turinovaLogoBase64 ? `<img src="data:image/png;base64,${input.turinovaLogoBase64}" alt="Turinova Logo" class="footer-logo" />` : ''}
      </div>
    </div>
  </body>
</html>`
}
