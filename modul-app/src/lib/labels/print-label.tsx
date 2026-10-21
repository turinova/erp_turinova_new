'use client'

import { createRoot, type Root } from 'react-dom/client'

import { ProductLabelSheet } from '@/components/labels/product-label-sheet'
import {
  probeBrowserPrint,
  sendZplViaBrowserPrint,
  type BrowserPrintDevice
} from '@/lib/labels/browser-print-client'
import { isScannableOn33x25 } from '@/lib/labels/print-policy'
import { generateLabelZpl } from '@/lib/labels/zpl'
import type { LabelFields, LabelSize, ProductLabelPayload } from '@/lib/labels/types'

type PrintArgs = {
  payload: ProductLabelPayload
  fields: LabelFields
  productName: string
  price: number
  unitShortform: string
  size: LabelSize
  amount: number
  /** Digits under bars — default false (scan-safe). */
  showHumanReadable?: boolean
  offsetXMm?: number
  offsetYMm?: number
  /** Resolved barcode (supplier / internal / auto). */
  barcodeValue?: string | null
  /**
   * `zebra` (default): Browser Print ZPL.
   * `html`: Chrome → driver raster (fallback only).
   * `auto`: try Zebra, then HTML on failure.
   */
  method?: 'zebra' | 'html' | 'auto'
  /** Cached device from dialog probe. */
  zebraDevice?: BrowserPrintDevice | null
}

export type PrintLabelResult = {
  method: 'zebra' | 'html'
  fitWarning: string | null
}

const CONTAINER_ID = 'modul-product-label-print'
const STYLE_ID = 'modul-product-label-print-styles'

function cleanup() {
  const container = document.getElementById(CONTAINER_ID)
  if (container) {
    const root = (container as HTMLElement & { __root?: Root }).__root
    root?.unmount()
    container.remove()
  }
  document.getElementById(STYLE_ID)?.remove()
}

/** Legacy Chrome print dialog path — barcodes are rasterized (often unscannable). */
export async function printProductLabelsHtml(args: PrintArgs): Promise<void> {
  cleanup()

  const { w, h } = { w: '33mm', h: '25mm' }

  const container = document.createElement('div')
  container.id = CONTAINER_ID
  container.style.cssText =
    'position:absolute;left:-9999px;top:-9999px;visibility:hidden'
  document.body.appendChild(container)

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @media print {
      @page { size: ${w} ${h}; margin: 0; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: ${w} !important;
        height: ${h} !important;
        background: white !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body > *:not(#${CONTAINER_ID}) {
        display: none !important;
      }
      #${CONTAINER_ID} {
        position: static !important;
        left: auto !important;
        top: auto !important;
        visibility: visible !important;
        display: block !important;
        width: ${w} !important;
        height: auto !important;
        margin: 0 auto !important;
        padding: 0 !important;
        background: white !important;
      }
      #${CONTAINER_ID} > .label-sheet {
        width: ${w} !important;
        height: ${h} !important;
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        margin: 0 auto !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${CONTAINER_ID} > .label-sheet:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      #${CONTAINER_ID} .label-barcode-svg-wrap {
        overflow: hidden !important;
      }
      #${CONTAINER_ID} .label-barcode-svg-wrap svg {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        object-fit: fill !important;
      }
    }
  `
  document.head.appendChild(style)

  const root = createRoot(container)
  ;(container as HTMLElement & { __root?: Root }).__root = root

  const sheets = Array.from({ length: Math.max(1, args.amount) }, (_, i) => (
    <ProductLabelSheet
      key={i}
      className="label-sheet"
      payload={args.payload}
      fields={args.fields}
      productName={args.productName}
      price={args.price}
      unitShortform={args.unitShortform}
      size={args.size}
      mode="print"
      showHumanReadable={args.showHumanReadable ?? false}
      offsetXMm={args.offsetXMm ?? 0}
      offsetYMm={args.offsetYMm ?? 0}
      barcodeValue={args.barcodeValue}
    />
  ))

  root.render(<>{sheets}</>)
  await new Promise((r) => setTimeout(r, 120))
  window.print()
  setTimeout(cleanup, 800)
}

async function printViaZebra(args: PrintArgs): Promise<PrintLabelResult> {
  void args.size // only 33x25 supported for ZPL today
  const wantBarcode = args.fields.showBarcode && Boolean(args.barcodeValue)
  if (wantBarcode && !isScannableOn33x25(args.barcodeValue)) {
    throw new Error(
      'A vonalkód nem fér olvashatóan a 33×25 címkére. Használj belső EAN-t, vagy kapcsold ki a Vonalkód mezőt.'
    )
  }
  const generated = generateLabelZpl({
    productName: args.productName,
    price: args.price,
    unitShortform: args.unitShortform,
    fields: args.fields,
    payload: args.payload,
    barcodeValue: args.barcodeValue,
    showHumanReadable: args.showHumanReadable,
    amount: args.amount,
    offsetXMm: args.offsetXMm,
    offsetYMm: args.offsetYMm
  })
  if (!generated.packOk) {
    throw new Error(
      generated.fitWarning ??
        'Nem fér minden pipált mező a címkére. Kapcsolj ki egy mezőt.'
    )
  }
  // sendZplViaBrowserPrint always re-probes (USB unplug-safe)
  await sendZplViaBrowserPrint(generated.zpl, args.zebraDevice ?? null)
  return { method: 'zebra', fitWarning: generated.fitWarning }
}

/**
 * Primary: Zebra Browser Print (native ZPL barcodes).
 * Fallback: HTML window.print (explicit method or auto after Zebra fail).
 */
export async function printProductLabels(
  args: PrintArgs
): Promise<PrintLabelResult> {
  const method = args.method ?? 'zebra'

  if (method === 'html') {
    await printProductLabelsHtml(args)
    return { method: 'html', fitWarning: null }
  }

  if (method === 'zebra') {
    return printViaZebra(args)
  }

  // auto
  try {
    return await printViaZebra(args)
  } catch (err) {
    console.warn('[label-print] Zebra failed, HTML fallback', err)
    await printProductLabelsHtml(args)
    return { method: 'html', fitWarning: null }
  }
}

export { probeBrowserPrint }
