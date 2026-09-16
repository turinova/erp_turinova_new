'use client'

import { createRoot, type Root } from 'react-dom/client'

import { ProductLabelSheet } from '@/components/labels/product-label-sheet'
import type { LabelFields, LabelSize, ProductLabelPayload } from '@/lib/labels/types'

type PrintArgs = {
  payload: ProductLabelPayload
  fields: LabelFields
  productName: string
  price: number
  unitShortform: string
  size: LabelSize
  amount: number
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

export async function printProductLabels(args: PrintArgs): Promise<void> {
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
        background: white !important;
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
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
      }
      #${CONTAINER_ID} > .label-sheet {
        width: ${w} !important;
        height: ${h} !important;
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        margin: 0 !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }
      #${CONTAINER_ID} > .label-sheet:last-child {
        page-break-after: auto;
        break-after: auto;
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
    />
  ))

  root.render(<>{sheets}</>)
  await new Promise((r) => setTimeout(r, 120))
  window.print()
  setTimeout(cleanup, 800)
}
