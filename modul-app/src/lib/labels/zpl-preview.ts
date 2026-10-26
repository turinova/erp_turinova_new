/**
 * Client-side ZPL → PNG preview via @zebrash/browser.
 * Same ZPL string as Browser Print (amount forced to 1 for preview).
 * Upscaled for screen sharpness (print stays 203 dpi / 8 dpmm).
 */

import type { LabelZplInput } from '@/lib/labels/zpl'
import { generateLabelZpl } from '@/lib/labels/zpl'

export const ZPL_PREVIEW_WIDTH_MM = 33
export const ZPL_PREVIEW_HEIGHT_MM = 25
/** Native ZD220 density — ZPL coordinates are authored for this. */
export const ZPL_PREVIEW_NATIVE_DPMM = 8
/**
 * Screen upscale after native render (smooth). Does not change print ZPL.
 * 3 → ~792×600 px from 264×200.
 */
export const ZPL_PREVIEW_UPSCALE = 3

let fontsConfigured = false

async function loadZebrash() {
  const mod = await import('@zebrash/browser')
  if (!fontsConfigured) {
    mod.setFontBaseUrl('/fonts/zebrash/')
    fontsConfigured = true
  }
  return mod
}

async function upscalePng(
  png: Uint8Array,
  factor: number
): Promise<Uint8Array> {
  if (factor <= 1 || typeof createImageBitmap === 'undefined') return png

  const copy = new Uint8Array(png.byteLength)
  copy.set(png)
  const blob = new Blob([copy], { type: 'image/png' })
  const bmp = await createImageBitmap(blob)
  const w = bmp.width * factor
  const h = bmp.height * factor
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bmp.close()
    return png
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const outBlob = await canvas.convertToBlob({ type: 'image/png' })
  return new Uint8Array(await outBlob.arrayBuffer())
}

export type ZplPreviewResult = {
  zpl: string
  objectUrl: string
  packOk: boolean
  fitWarning: string | null
}

/**
 * Render the same ZPL the printer would get (1 copy) to a PNG object URL.
 * Caller must revokeObjectURL when done / replaced.
 */
export async function renderLabelZplPreview(
  input: Omit<LabelZplInput, 'amount'> & { amount?: number }
): Promise<ZplPreviewResult> {
  const generated = generateLabelZpl({
    ...input,
    amount: 1
  })

  const { Parser, Drawer } = await loadZebrash()
  const labels = new Parser().parse(generated.zpl)
  if (!labels.length) {
    throw new Error('A ZPL előnézet üres (nincs címke a parserben).')
  }

  const png = await new Drawer().drawLabelAsPng(labels[0], {
    labelWidthMm: ZPL_PREVIEW_WIDTH_MM,
    labelHeightMm: ZPL_PREVIEW_HEIGHT_MM,
    dpmm: ZPL_PREVIEW_NATIVE_DPMM
  })

  const bytes = png instanceof Uint8Array ? png : new Uint8Array(png)
  const hiRes = await upscalePng(bytes, ZPL_PREVIEW_UPSCALE)
  const out = new Uint8Array(hiRes.byteLength)
  out.set(hiRes)
  const objectUrl = URL.createObjectURL(
    new Blob([out], { type: 'image/png' })
  )

  return {
    zpl: generated.zpl,
    objectUrl,
    packOk: generated.packOk,
    fitWarning: generated.fitWarning
  }
}
