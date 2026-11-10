import QRCode from 'qrcode'

/** Szinkron QR SVG (böngészős nyomtatás + előnézet). Hiba esetén üres string. */
export function qrSvgMarkup(text: string, sizePx = 120): string {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    const margin = 2
    const total = n + margin * 2
    let d = ''
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.modules.get(row, col)) d += `M${col + margin} ${row + margin}h1v1h-1z`
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges" role="img" aria-label="QR-kód"><rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
  } catch {
    return ''
  }
}
