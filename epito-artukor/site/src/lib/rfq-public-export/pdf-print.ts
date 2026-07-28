import type { RfqPublicExportModel } from "@/lib/rfq-public-export/build-export-model"

export const RFQ_PUBLIC_PDF_PRINT_CSS = `
@page {
  size: A4 portrait;
  margin: 14mm 12mm 16mm 12mm;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  padding: 0;
  font-family: Calibri, "Segoe UI", system-ui, sans-serif;
  font-size: 9.5pt;
  line-height: 1.35;
  color: #0f172a;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.rfq-pdf-doc { width: 100%; }

.rfq-pdf-header {
  border-bottom: 2px solid #64748b;
  padding-bottom: 10px;
  margin-bottom: 12px;
}

.rfq-pdf-label {
  font-size: 8.5pt;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #64748b;
}

.rfq-pdf-title {
  margin: 4px 0 0;
  font-size: 16pt;
  font-weight: 700;
  color: #1e293b;
}

.rfq-pdf-meta {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 16px;
  font-size: 9pt;
  color: #334155;
}

.rfq-pdf-meta strong {
  color: #0f172a;
}

.rfq-pdf-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
  font-size: 8.5pt;
}

.rfq-pdf-table th {
  background: #ececec;
  border: 1px solid #b4b4b4;
  padding: 4px 5px;
  text-align: left;
  font-weight: 700;
  color: #404040;
}

.rfq-pdf-table th.num,
.rfq-pdf-table td.num {
  text-align: right;
}

.rfq-pdf-table td {
  border: 1px solid #b4b4b4;
  padding: 4px 5px;
  vertical-align: top;
}

.rfq-pdf-table tr:nth-child(even) td {
  background: #fafafa;
}

.rfq-pdf-declined {
  font-style: italic;
  color: #64748b;
}

.rfq-pdf-footer {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 10pt;
  font-weight: 700;
}

.rfq-pdf-summary {
  margin-bottom: 8px;
}

.rfq-pdf-summary-table {
  margin-top: 6px;
}

.rfq-pdf-trade {
  margin-top: 18px;
  page-break-inside: avoid;
}

.rfq-pdf-trade:first-of-type {
  margin-top: 12px;
}

.rfq-pdf-summary + .rfq-pdf-trade {
  page-break-before: always;
  margin-top: 0;
  padding-top: 0;
}

.rfq-pdf-trade + .rfq-pdf-trade {
  page-break-before: always;
  margin-top: 0;
}

.rfq-pdf-trade-title {
  margin: 0;
  font-size: 12pt;
  font-weight: 700;
  color: #1e293b;
}

.rfq-pdf-trade-sub {
  margin: 2px 0 0;
  font-size: 9pt;
  color: #64748b;
}

.rfq-pdf-trade-meta {
  margin: 4px 0 0;
  font-size: 8.5pt;
  color: #475569;
}

.rfq-pdf-notes {
  margin-top: 14px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
  font-size: 9pt;
  color: #334155;
  white-space: pre-wrap;
}

.rfq-pdf-stamp {
  margin-top: 16px;
  font-size: 8pt;
  color: #64748b;
}
`

export function printRfqPublicPdfDocument(
  rootSelector = ".rfq-pdf-doc",
  title = "Ajánlat"
): void {
  const el = document.querySelector(rootSelector)
  if (!el) {
    throw new Error("A PDF előnézet nem található.")
  }

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <title>${title.replace(/</g, "")}</title>
  <style>${RFQ_PUBLIC_PDF_PRINT_CSS}</style>
</head>
<body>${el.outerHTML}</body>
</html>`

  const iframe = document.createElement("iframe")
  iframe.setAttribute("title", "RFQ PDF nyomtatás")
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none"
  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  const doc = win?.document
  if (!win || !doc) {
    iframe.remove()
    throw new Error("A nyomtatási keret nem hozható létre.")
  }

  doc.open()
  doc.write(html)
  doc.close()

  const cleanup = () => {
    iframe.remove()
  }
  win.addEventListener("afterprint", cleanup, { once: true })
  window.setTimeout(cleanup, 60_000)

  win.focus()
  win.print()
}

export function formatRfqPdfMoney(value: number | null | undefined): string {
  if (value == null || value <= 0) return "—"
  return new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatRfqPdfDate(iso: string): string {
  return new Date(iso).toLocaleDateString("hu-HU")
}

export type { RfqPublicExportModel }
