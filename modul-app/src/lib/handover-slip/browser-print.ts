'use client'

import { formatMaterialQty } from '@/lib/handover-slip/build-data'
import type {
  HandoverSlipCopyType,
  HandoverSlipData,
  HandoverSlipSettings
} from '@/lib/handover-slip/types'

function slipHtml(
  data: HandoverSlipData,
  settings: HandoverSlipSettings,
  copyType: HandoverSlipCopyType
): string {
  const lines: string[] = []
  const push = (s: string) => lines.push(s)

  push('<div class="slip">')
  push('<div class="center thick">Átvételi elismervény</div>')
  if (copyType === 'customer') {
    push(
      `<div class="center thick">${escapeHtml(settings.customerCopyLabel)}</div>`
    )
  }
  push(`<div class="center company">${escapeHtml(data.company.name)}</div>`)
  if (settings.showCompanyAddress) {
    const addr = [data.company.postalCode, data.company.city, data.company.address]
      .filter(Boolean)
      .join(' ')
    if (addr) push(`<div class="center">${escapeHtml(addr)}</div>`)
  }
  if (settings.showCompanyPhone && data.company.phone) {
    push(`<div class="center">${escapeHtml(data.company.phone)}</div>`)
  }
  if (settings.showTaxNumber && data.company.taxNumber) {
    push(
      `<div class="center">Adószám: ${escapeHtml(data.company.taxNumber)}</div>`
    )
  }
  push('<hr/>')
  if (settings.showOrderNumber) {
    push(`<div><b>Megrendelés:</b> ${escapeHtml(data.orderNumber)}</div>`)
  }
  if (settings.showCustomerName) {
    push(`<div><b>Ügyfél:</b> ${escapeHtml(data.customerName)}</div>`)
  }
  push('<hr/>')

  if (settings.showMaterials) {
    for (const m of data.materials) {
      push(
        `<div class="row"><span>${escapeHtml(m.name)}</span><span>${escapeHtml(formatMaterialQty(m, settings.qtyFormat))}</span></div>`
      )
      if (settings.showEdge && m.edgeLengthM > 0.001) {
        push(
          `<div class="row muted"><span></span><span>Élzáró: ${m.edgeLengthM.toFixed(2)} m</span></div>`
        )
      }
    }
    push('<hr/>')
  }

  if (settings.showServices && data.services.length) {
    for (const s of data.services) {
      push(
        `<div class="row"><span>${escapeHtml(s.name)}</span><span>${s.quantity} ${escapeHtml(s.unit)}</span></div>`
      )
    }
    push('<hr/>')
  }

  if (settings.showLegalText) {
    push(`<div class="center legal">${escapeHtml(settings.legalText)}</div>`)
  }
  if (copyType === 'original' && settings.showGateLine) {
    push(
      `<div class="center"><b>${escapeHtml(settings.gateLineText)}</b></div>`
    )
  }
  if (settings.showPrintDatetime) {
    push(
      `<div class="center muted">Nyomtatva: ${new Date().toLocaleString('hu-HU')}</div>`
    )
  }
  if (copyType === 'original' && settings.showSignatures) {
    push('<div class="sig">Ügyfél aláírása:</div><div class="sig-line"></div>')
    push(
      '<div class="sig">Átadó munkatárs neve:</div><div class="sig-line"></div>'
    )
  }
  if (settings.showBarcode && data.barcode) {
    const id = `bc-${copyType}`
    push(`<div class="center barcode-wrap"><svg id="${id}"></svg>`)
    push(
      `<div class="barcode-text">${escapeHtml(data.barcode)}</div></div>`
    )
  }
  push('</div>')
  return lines.join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const CSS = `
  body { font-family: ui-monospace, monospace; font-size: 12px; margin: 0; }
  .slip { width: 72mm; margin: 0 auto; padding: 4mm; }
  .center { text-align: center; }
  .thick { font-weight: 700; font-size: 14px; margin: 4px 0; }
  .company { font-weight: 700; font-size: 13px; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
  .muted { color: #555; font-size: 11px; }
  .legal { margin: 8px 0; line-height: 1.35; }
  .sig { margin-top: 12px; }
  .sig-line { border-bottom: 1px dashed #333; height: 28px; margin-bottom: 8px; }
  .barcode-wrap { margin-top: 10px; text-align: center; }
  .barcode-text { margin-top: 4px; letter-spacing: 0.08em; }
  hr { border: none; border-top: 1px dashed #333; margin: 6px 0; }
  @media print {
    @page { margin: 0; size: 80mm auto; }
    body { margin: 0; }
  }
`

function sanitizeBarcode(barcode: string): string {
  let sanitized = barcode.replace(/[^\x20-\x7E]/g, '')
  if (!sanitized) sanitized = '0'
  return sanitized
}

export function openHandoverBrowserPrint(
  data: HandoverSlipData,
  settings: HandoverSlipSettings,
  copyTypes: HandoverSlipCopyType[]
): void {
  const parts = copyTypes.map((t) => slipHtml(data, settings, t))
  const barcodeScript =
    settings.showBarcode && data.barcode
      ? copyTypes
          .map((t) => {
            const id = `bc-${t}`
            const val = JSON.stringify(sanitizeBarcode(data.barcode!))
            return `try{JsBarcode("#${id}",${val},{format:"CODE128",width:1.4,height:44,displayValue:false,margin:0})}catch(e){}`
          })
          .join(';')
      : ''

  const html = `<!doctype html><html><head><title>Átvételi blokk</title><style>${CSS}</style>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
</head><body>${parts.join('<div style="page-break-after:always"></div>')}
<script>${barcodeScript};window.onload=function(){setTimeout(function(){window.print()},120)}<\/script>
</body></html>`
  const w = window.open('', '_blank', 'noopener,noreferrer,width=420,height=720')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
}
