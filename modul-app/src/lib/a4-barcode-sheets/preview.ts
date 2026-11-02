/**
 * PDF → PNG preview — same bytes as download (print truth).
 * pdf.js loaded from /public (webpackIgnore) — Next/webpack cannot bundle pdfjs-dist ESM.
 */

import {
  buildA4BarcodeSheetPdf,
  buildA4SingleCellPdf,
  type BuildA4PdfInput
} from '@/lib/a4-barcode-sheets/pdf'
import type { A4SheetCellDraft } from '@/lib/a4-barcode-sheets/types'

/** Boot file polyfills Map.getOrInsert* then loads pdf.worker.min.mjs. */
const WORKER_SRC = '/pdfjs/pdf.worker-boot.mjs'

type PdfjsLib = {
  getDocument: (src: {
    data: Uint8Array
    useSystemFonts?: boolean
    isEvalSupported?: boolean
  }) => { promise: Promise<PdfDocumentProxy> }
  GlobalWorkerOptions: { workerSrc: string }
}

type PdfDocumentProxy = {
  getPage: (n: number) => Promise<PdfPageProxy>
  destroy: () => Promise<void>
}

type PdfPageProxy = {
  getViewport: (opts: { scale: number }) => { width: number; height: number }
  render: (opts: {
    canvas: HTMLCanvasElement
    viewport: { width: number; height: number }
  }) => { promise: Promise<void> }
}

let pdfjsPromise: Promise<PdfjsLib> | null = null

/**
 * pdf.js 5.6+ uses Map.getOrInsert / getOrInsertComputed (Chrome 145+ / Safari 26.2+).
 * Main-thread polyfill — worker scope is covered by /pdfjs/pdf.worker-boot.mjs.
 */
function ensureMapGetOrInsert(): void {
  const proto = Map.prototype as Map<unknown, unknown> & {
    getOrInsert?: (key: unknown, value: unknown) => unknown
    getOrInsertComputed?: (
      key: unknown,
      callback: (key: unknown) => unknown
    ) => unknown
  }
  if (typeof proto.getOrInsert !== 'function') {
    proto.getOrInsert = function (key, value) {
      if (this.has(key)) return this.get(key)
      this.set(key, value)
      return value
    }
  }
  if (typeof proto.getOrInsertComputed !== 'function') {
    proto.getOrInsertComputed = function (key, callback) {
      if (this.has(key)) return this.get(key)
      const value = callback(key)
      this.set(key, value)
      return value
    }
  }
}

async function loadPdfjs(): Promise<PdfjsLib> {
  if (!pdfjsPromise) {
    ensureMapGetOrInsert()
    // Literal path required for webpackIgnore (do not use a variable).
    // Public ESM — not resolved via node_modules (see /public/pdfjs/).
    pdfjsPromise = (
      import(
        /* webpackIgnore: true */
        // @ts-expect-error vendored absolute public path
        '/pdfjs/pdf.min.mjs'
      ) as Promise<{ default?: PdfjsLib } & PdfjsLib>
    ).then((mod) => {
      const lib = mod.default ?? mod
      lib.GlobalWorkerOptions.workerSrc = WORKER_SRC
      return lib
    })
  }
  return pdfjsPromise
}

/** Render first PDF page to PNG data URL (scale ≈ screen sharpness). */
export async function pdfBytesToPngDataUrl(
  pdfBytes: Uint8Array,
  scale = 2
): Promise<string> {
  const pdfjs = await loadPdfjs()

  // Copy — pdf.js may transfer/detach the buffer
  const data = pdfBytes.slice()
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false
  })
  const pdf = await loadingTask.promise
  try {
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    if (!canvas.getContext('2d')) {
      throw new Error('Canvas nem elérhető.')
    }

    await page.render({
      canvas,
      viewport
    }).promise

    return canvas.toDataURL('image/png')
  } finally {
    await pdf.destroy()
  }
}

/** Build the print PDF then rasterize page 1 → PNG. */
export async function buildA4BarcodeSheetPreviewPng(
  input: BuildA4PdfInput,
  scale = 2
): Promise<string> {
  const bytes = await buildA4BarcodeSheetPdf(input)
  return pdfBytesToPngDataUrl(bytes, scale)
}

async function pdfBytesToRasterDataUrl(
  pdfBytes: Uint8Array,
  opts: { scale?: number; mime?: 'image/png' | 'image/jpeg'; quality?: number }
): Promise<string> {
  const pdfjs = await loadPdfjs()
  const data = pdfBytes.slice()
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false
  })
  const pdf = await loadingTask.promise
  try {
    const page = await pdf.getPage(1)
    const scale = opts.scale ?? 3
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    if (!canvas.getContext('2d')) {
      throw new Error('Canvas nem elérhető.')
    }
    await page.render({ canvas, viewport }).promise
    const mime = opts.mime ?? 'image/png'
    if (mime === 'image/jpeg') {
      return canvas.toDataURL('image/jpeg', opts.quality ?? 0.92)
    }
    return canvas.toDataURL('image/png')
  } finally {
    await pdf.destroy()
  }
}

/** One grid cell → JPEG (print-truth PDF raster). */
export async function buildA4CellPreviewJpeg(input: {
  cell: A4SheetCellDraft
  cellWMm: number
  cellHMm: number
  scale?: number
}): Promise<string> {
  const bytes = await buildA4SingleCellPdf({
    cell: input.cell,
    cellWMm: input.cellWMm,
    cellHMm: input.cellHMm
  })
  return pdfBytesToRasterDataUrl(bytes, {
    scale: input.scale ?? 4,
    mime: 'image/jpeg',
    quality: 0.92
  })
}
