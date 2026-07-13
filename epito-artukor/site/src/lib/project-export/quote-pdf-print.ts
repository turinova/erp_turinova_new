/** Nyomtatási stílusok — A4 árajánlat PDF (böngésző „Mentés PDF-ként”). */
export const QUOTE_PDF_PRINT_CSS = `
@page {
  size: A4 portrait;
  margin: 18mm 18mm 20mm 18mm;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  padding: 0;
  font-family: Calibri, "Segoe UI", system-ui, sans-serif;
  font-size: 10pt;
  line-height: 1.4;
  color: #0f172a;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.quote-export-document {
  width: 100%;
}

.quote-pdf-summary-page {
  break-after: page;
  page-break-after: always;
}

.quote-pdf-closing-page {
  break-before: page;
  page-break-before: always;
}

.quote-pdf-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 2px solid #64748b;
  padding-bottom: 12px;
  margin-bottom: 14px;
}

.quote-pdf-logo img {
  max-height: 52px;
  max-width: 150px;
  object-fit: contain;
}

.quote-pdf-title-block {
  text-align: right;
  flex: 1;
}

.quote-pdf-doc-label {
  font-size: 9pt;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #64748b;
}

.quote-pdf-doc-title {
  margin: 4px 0 0;
  font-size: 18pt;
  font-weight: 700;
  color: #1e293b;
}

.quote-pdf-meta {
  margin-top: 6px;
  font-size: 9.5pt;
  color: #475569;
}

.quote-pdf-parties {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}

.quote-pdf-party {
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #f8fafc;
  padding: 10px 12px;
}

.quote-pdf-party h2 {
  margin: 0 0 6px;
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.quote-pdf-party p {
  margin: 0 0 4px;
  font-size: 9.5pt;
}

.quote-pdf-party .name {
  font-weight: 700;
  color: #1e293b;
}

.quote-pdf-info-grid {
  display: grid;
  grid-template-columns: 9rem 1fr;
  gap: 4px 8px;
  margin-bottom: 14px;
  font-size: 9.5pt;
}

.quote-pdf-info-grid dt {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 8pt;
  letter-spacing: 0.04em;
  color: #64748b;
}

.quote-pdf-info-grid dd {
  margin: 0;
  color: #1e293b;
}

.quote-pdf-section-title {
  margin: 0 0 8px;
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #475569;
}

table {
  width: 100%;
  border-collapse: collapse;
}

.quote-pdf-summary-table th,
.quote-pdf-summary-table td,
.quote-pdf-lines-table th,
.quote-pdf-lines-table td {
  border: 1px solid #cbd5e1;
  padding: 5px 7px;
  vertical-align: top;
}

.quote-pdf-summary-table thead th,
.quote-pdf-lines-table thead th {
  background: #ececec;
  font-size: 8pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #404040;
}

.quote-pdf-summary-table td.num,
.quote-pdf-lines-table td.num {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.quote-pdf-summary-table tfoot td {
  font-weight: 700;
  background: #e8eef4;
  border-top: 2px solid #808080;
}

.quote-pdf-totals-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.quote-pdf-totals-box {
  width: 16rem;
  border: 1px solid #94a3b8;
  background: #f8fafc;
  break-inside: avoid;
  page-break-inside: avoid;
}

.quote-pdf-totals-box h3 {
  margin: 0;
  padding: 6px 10px;
  font-size: 8.5pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: center;
  background: #ececec;
  border-bottom: 1px solid #cbd5e1;
}

.quote-pdf-totals-box dl {
  margin: 0;
  padding: 8px 10px;
}

.quote-pdf-totals-box .row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 0;
  font-size: 9.5pt;
}

.quote-pdf-totals-box .row.grand {
  margin-top: 6px;
  padding-top: 8px;
  border-top: 2px solid #1e3a5f;
  font-size: 11pt;
  font-weight: 700;
  color: #1e3a5f;
  background: #dbeafe;
  margin-left: -10px;
  margin-right: -10px;
  padding-left: 10px;
  padding-right: 10px;
  padding-bottom: 8px;
}

.quote-pdf-trade-band {
  margin: 14px 0 0;
  padding: 6px 10px;
  background: #fff8e1;
  border: 1px solid #cbd5e1;
  border-bottom: none;
  font-size: 9.5pt;
  font-weight: 700;
  color: #1e293b;
  break-after: avoid;
  page-break-after: avoid;
}

.quote-pdf-trade-footer {
  text-align: right;
  padding: 6px 8px;
  font-size: 9pt;
  font-weight: 600;
  border: 1px solid #cbd5e1;
  border-top: 2px solid #94a3b8;
  background: #f8fafc;
  margin-bottom: 4px;
}

.quote-pdf-lines-table {
  margin-bottom: 0;
}

.quote-pdf-lines-table tbody tr {
  break-inside: auto;
  page-break-inside: auto;
}

.quote-pdf-lines-table td.text {
  line-height: 1.35;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}

.quote-pdf-lines-table td.code {
  font-family: Consolas, monospace;
  font-size: 8.5pt;
  color: #1d4ed8;
}

.quote-pdf-lines-table thead {
  display: table-header-group;
}

.quote-pdf-closing h2 {
  margin: 16px 0 6px;
  font-size: 9pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #475569;
}

.quote-pdf-closing p {
  margin: 0 0 10px;
  font-size: 9.5pt;
  line-height: 1.45;
  white-space: pre-wrap;
}

.quote-pdf-signatures {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 28px;
}

.quote-pdf-signatures .line {
  margin-top: 36px;
  border-top: 1px solid #64748b;
  padding-top: 4px;
  font-size: 9pt;
  color: #475569;
}

.quote-pdf-footer-note {
  margin-top: 20px;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
  font-size: 8pt;
  color: #64748b;
  line-height: 1.4;
}
`

export function printQuotePdfDocument(rootSelector = ".quote-export-document"): void {
  const el = document.querySelector(rootSelector)
  if (!el) {
    throw new Error("Az árajánlat előnézet nem található.")
  }

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <title>Árajánlat</title>
  <style>${QUOTE_PDF_PRINT_CSS}</style>
</head>
<body>${el.outerHTML}</body>
</html>`

  const iframe = document.createElement("iframe")
  iframe.setAttribute("title", "Árajánlat nyomtatás")
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
