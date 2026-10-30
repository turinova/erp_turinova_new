/**
 * Client-side A4 PDF — clerk-readable text + sharp barcode (quiet zone).
 */

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFDocument as PDFDocType,
  type PDFFont,
  type PDFPage
} from 'pdf-lib'

import { renderA4BarcodePng } from '@/lib/a4-barcode-sheets/barcode-render'
import {
  A4_CELL_PAD_MM,
  A4_NAME_DEFAULT_MAX_CHARS,
  fitFontSizePt,
  fitNameLines,
  formatA4PriceLine,
  packA4Cell,
  truncateA4
} from '@/lib/a4-barcode-sheets/layout'
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  cellFieldsFromDraft,
  type A4SheetCellDraft,
  type A4SheetFields
} from '@/lib/a4-barcode-sheets/types'

const MM_TO_PT = 72 / 25.4

function mm(n: number): number {
  return n * MM_TO_PT
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] ?? ''
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** WinAnsi-safe for Helvetica; keeps visual length for centering. */
function pdfSafeText(s: string): string {
  return s
    .replace(/[őŐ]/g, (c) => (c === 'ő' ? 'o' : 'O'))
    .replace(/[űŰ]/g, (c) => (c === 'ű' ? 'u' : 'U'))
    .replace(/[–—]/g, '-')
    .replace(/[„”"]/g, '"')
    .replace(/…/g, '.')
    .replace(/°/g, 'o')
}

function fitCenteredSize(
  text: string,
  font: PDFFont,
  widthMm: number,
  preferredPt: number,
  minPt: number
): number {
  let size = preferredPt
  const maxW = mm(widthMm) * 0.98
  while (size > minPt && font.widthOfTextAtSize(text, size) > maxW) {
    size -= 0.25
  }
  return size
}

/** Shared size for multi-line blocks — widest line wins (equal pt both lines). */
function fitSharedCenteredSize(
  lines: string[],
  font: PDFFont,
  widthMm: number,
  preferredPt: number,
  minPt: number
): number {
  let size = preferredPt
  for (const line of lines) {
    const safe = pdfSafeText(line)
    if (!safe) continue
    size = Math.min(
      size,
      fitCenteredSize(safe, font, widthMm, preferredPt, minPt)
    )
  }
  return size
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  opts: {
    xMm: number
    widthMm: number
    baselineYMm: number
    size: number
    font: PDFFont
    minSize?: number
    /** When true, use `size` as-is (multi-line name). */
    fixedSize?: boolean
  }
) {
  const safe = pdfSafeText(text)
  if (!safe) return
  const size = opts.fixedSize
    ? opts.size
    : fitCenteredSize(
        safe,
        opts.font,
        opts.widthMm,
        opts.size,
        opts.minSize ?? 6
      )
  const tw = opts.font.widthOfTextAtSize(safe, size)
  const tx = mm(opts.xMm) + (mm(opts.widthMm) - tw) / 2
  page.drawText(safe, {
    x: Math.max(mm(opts.xMm), tx),
    y: mm(opts.baselineYMm),
    size,
    font: opts.font,
    color: rgb(0, 0, 0)
  })
}

/** Paint one cell interior (same truth as full-sheet PDF). */
async function paintA4CellContent(opts: {
  doc: PDFDocType
  page: PDFPage
  cell: A4SheetCellDraft
  x0Mm: number
  y0Mm: number
  cellWMm: number
  cellHMm: number
  font: PDFFont
  fontBold: PDFFont
  drawBorder?: boolean
}) {
  const {
    doc,
    page,
    cell,
    x0Mm,
    y0Mm,
    cellWMm,
    cellHMm,
    font,
    fontBold
  } = opts
  const pad = A4_CELL_PAD_MM
  const yTop = y0Mm + cellHMm

  if (opts.drawBorder !== false) {
    page.drawRectangle({
      x: mm(x0Mm),
      y: mm(y0Mm),
      width: mm(cellWMm),
      height: mm(cellHMm),
      borderColor: rgb(0.82, 0.82, 0.82),
      borderWidth: 0.3
    })
  }

  const fields = cellFieldsFromDraft(cell)
  const pack = packA4Cell(cellWMm, cellHMm, fields)
  const contentX = x0Mm + pad
  const contentTop = yTop - pad
  const contentW = pack.contentW

  function zoneBox(zoneId: keyof typeof pack.zones) {
    const z = pack.zones[zoneId]
    const yTopZ = contentTop - z.yFromTop
    return { yBottom: yTopZ - z.height, yTop: yTopZ, height: z.height }
  }

  if (fields.showName && cell.nameSnap && pack.zones.name.height > 0.5) {
    const z = zoneBox('name')
    // Snap already ≤44 in editor; hard-cut only — no second ellipsis pass
    const capped = truncateA4(cell.nameSnap, A4_NAME_DEFAULT_MAX_CHARS)
    let lines = fitNameLines(capped, pack.nameCharsPerLine)
    if (pack.nameLinesBudget === 1 && lines.length > 1) {
      lines = [truncateA4(lines.join(' '), pack.nameCharsPerLine)]
    }
    const preferred = fitFontSizePt(z.height, lines.length, {
      min: 9,
      max: Math.min(32, 10 + pack.layoutScale * 12)
    })
    const fontSize = fitSharedCenteredSize(
      lines.filter(Boolean),
      fontBold,
      contentW,
      preferred,
      8
    )
    const lineStepMm = (fontSize * 1.12 * 25.4) / 72
    const blockH = lines.length * lineStepMm
    // Vertically center name block in its (now tight) band
    let baseline =
      z.yBottom + (z.height - blockH) / 2 + (lines.length - 1) * lineStepMm
    for (const line of lines) {
      if (!line) continue
      drawCenteredText(page, line, {
        xMm: contentX,
        widthMm: contentW,
        baselineYMm: baseline,
        size: fontSize,
        font: fontBold,
        fixedSize: true
      })
      baseline -= lineStepMm
    }
  }

  if (fields.showSku && cell.skuSnap && pack.zones.sku.height > 0.5) {
    const z = zoneBox('sku')
    const text = truncateA4(
      cell.skuSnap,
      Math.max(6, Math.floor(contentW / 1.55))
    )
    const preferred = fitFontSizePt(z.height, 1, {
      min: 11,
      max: Math.min(30, 12 + pack.layoutScale * 10)
    })
    const fontSize = fitCenteredSize(
      pdfSafeText(text),
      font,
      contentW,
      preferred,
      10
    )
    const baseline = z.yBottom + (z.height - fontSize * 0.35) / 2
    drawCenteredText(page, text, {
      xMm: contentX,
      widthMm: contentW,
      baselineYMm: baseline,
      size: fontSize,
      font,
      fixedSize: true
    })
  }

  if (fields.showPrice && pack.zones.price.height > 0.5) {
    const priceLine = formatA4PriceLine(cell.priceGross, cell.unitSnap)
    if (priceLine) {
          const z = zoneBox('price')
          const preferred = fitFontSizePt(z.height, 1, {
            min: 11,
            max: Math.min(40, 14 + pack.layoutScale * 14)
          })
          const fontSize = fitCenteredSize(
            pdfSafeText(priceLine),
            fontBold,
            contentW,
            preferred,
            10
          )
          const baseline = z.yBottom + (z.height - fontSize * 0.35) / 2
          drawCenteredText(page, priceLine, {
            xMm: contentX,
            widthMm: contentW,
            baselineYMm: baseline,
            size: fontSize,
            font: fontBold,
            fixedSize: true
          })
    }
  }

  if (
    fields.showBarcode &&
    cell.barcodeValue.trim() &&
    pack.zones.barcode.height > 0.5
  ) {
    const z = zoneBox('barcode')
    const rendered = renderA4BarcodePng({
      value: cell.barcodeValue.trim(),
      zoneWidthMm: contentW,
      zoneHeightMm: z.height
    })
    if (rendered.ok) {
      const image = await doc.embedPng(dataUrlToBytes(rendered.dataUrl))
      const bx = contentX + (contentW - rendered.drawWidthMm) / 2
      // Pin bars to top of barcode zone — no void between price and bars
      const by = z.yTop - rendered.drawHeightMm
      page.drawImage(image, {
        x: mm(bx),
        y: mm(Math.max(z.yBottom, by)),
        width: mm(rendered.drawWidthMm),
        height: mm(rendered.drawHeightMm)
      })
    }
  }
}

export type BuildA4PdfInput = {
  name: string
  cols: number
  rows: number
  marginMm: number
  fields: A4SheetFields
  cells: A4SheetCellDraft[]
}

export async function buildA4BarcodeSheetPdf(
  input: BuildA4PdfInput
): Promise<Uint8Array> {
  void input.fields
  const doc = await PDFDocument.create()
  const page = doc.addPage([mm(A4_WIDTH_MM), mm(A4_HEIGHT_MM)])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const margin = Math.max(0, input.marginMm)
  const cols = Math.max(1, input.cols)
  const rows = Math.max(1, input.rows)
  const cellW = (A4_WIDTH_MM - 2 * margin) / cols
  const cellH = (A4_HEIGHT_MM - 2 * margin) / rows

  const byPos = new Map<string, A4SheetCellDraft>()
  for (const c of input.cells) {
    byPos.set(`${c.row}:${c.col}`, c)
  }

  page.drawRectangle({
    x: mm(margin),
    y: mm(margin),
    width: mm(A4_WIDTH_MM - 2 * margin),
    height: mm(A4_HEIGHT_MM - 2 * margin),
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 0.4
  })

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = margin + c * cellW
      const yTop = A4_HEIGHT_MM - margin - r * cellH
      const y0 = yTop - cellH
      const cell = byPos.get(`${r}:${c}`)
      if (!cell) {
        page.drawRectangle({
          x: mm(x0),
          y: mm(y0),
          width: mm(cellW),
          height: mm(cellH),
          borderColor: rgb(0.82, 0.82, 0.82),
          borderWidth: 0.3
        })
        continue
      }
      await paintA4CellContent({
        doc,
        page,
        cell,
        x0Mm: x0,
        y0Mm: y0,
        cellWMm: cellW,
        cellHMm: cellH,
        font,
        fontBold,
        drawBorder: true
      })
    }
  }

  if (margin >= 4) {
    const hint = `${truncateA4(input.name, 40)} · nyomtatás: 100% / tényleges méret`
    page.drawText(hint, {
      x: mm(margin),
      y: mm(1.8),
      size: 6,
      font,
      color: rgb(0.45, 0.45, 0.45)
    })
  }

  return doc.save()
}

/**
 * Single-cell PDF at exact grid cell size — same paint as sheet (print truth).
 */
export async function buildA4SingleCellPdf(input: {
  cell: A4SheetCellDraft
  cellWMm: number
  cellHMm: number
}): Promise<Uint8Array> {
  const cellW = Math.max(8, input.cellWMm)
  const cellH = Math.max(8, input.cellHMm)
  const doc = await PDFDocument.create()
  const page = doc.addPage([mm(cellW), mm(cellH)])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  page.drawRectangle({
    x: 0,
    y: 0,
    width: mm(cellW),
    height: mm(cellH),
    color: rgb(1, 1, 1)
  })

  await paintA4CellContent({
    doc,
    page,
    cell: input.cell,
    x0Mm: 0,
    y0Mm: 0,
    cellWMm: cellW,
    cellHMm: cellH,
    font,
    fontBold,
    drawBorder: true
  })

  return doc.save()
}

export async function downloadA4BarcodeSheetPdf(
  input: BuildA4PdfInput,
  filename?: string
): Promise<void> {
  const bytes = await buildA4BarcodeSheetPdf(input)
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/pdf'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    filename ??
    `${input.name.replace(/[^\w\-áéíóöőúüűÁÉÍÓÖŐÚÜŰ ]+/gi, '').trim() || 'vonalkod-lap'}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadA4CalibrationPdf(
  cols: number,
  rows: number,
  marginMm: number
): Promise<void> {
  await downloadA4BarcodeSheetPdf(
    {
      name: 'Kalibráló',
      cols,
      rows,
      marginMm,
      fields: { showName: false, showSku: false, showPrice: false },
      cells: []
    },
    'vonalkod-lap-kalibracio.pdf'
  )
}
