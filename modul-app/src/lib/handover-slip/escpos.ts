/**
 * ESC/POS builder for 80mm átvételi blokk — settings-driven.
 * Saját implementáció (main-app ötlet, nincs forráscopy).
 */

import { formatMaterialQty } from '@/lib/handover-slip/build-data'
import type {
  HandoverSlipCopyType,
  HandoverSlipData,
  HandoverSlipSettings
} from '@/lib/handover-slip/types'

const ESC = '\x1B'
const GS = '\x1D'
const LF = '\x0A'
const PAPER_WIDTH = 48

function init(): string {
  return ESC + '@'
}

function align(a: 0 | 1 | 2): string {
  return ESC + 'a' + String.fromCharCode(a)
}

function bold(on: boolean): string {
  return ESC + 'E' + (on ? '\x01' : '\x00')
}

function size(w: 1 | 2, h: 1 | 2): string {
  const n = (w - 1) + (h - 1) * 16
  return GS + '!' + String.fromCharCode(n)
}

function codePage852(): string {
  return ESC + 't' + String.fromCharCode(2)
}

function text(s: string): string {
  return s + LF
}

function feed(n = 1): string {
  return LF.repeat(n)
}

function dashed(): string {
  return '-'.repeat(PAPER_WIDTH) + LF
}

function thick(): string {
  return '='.repeat(PAPER_WIDTH) + LF
}

function cut(): string {
  return GS + 'V' + String.fromCharCode(65) + String.fromCharCode(3)
}

function row(left: string, right: string): string {
  const maxL = 26
  const maxR = 20
  const l = left.length > maxL ? left.slice(0, maxL - 1) + '…' : left
  const r = right.length > maxR ? right.slice(0, maxR - 1) + '…' : right
  const pad = Math.max(1, PAPER_WIDTH - l.length - r.length)
  return l + ' '.repeat(pad) + r + LF
}

function wrapRow(left: string, right: string): string {
  const maxL = 26
  if (left.length <= maxL) return row(left, right)
  let out = ''
  let rest = left
  let first = true
  while (rest.length > 0) {
    const chunk = rest.slice(0, maxL)
    rest = rest.slice(maxL)
    out += first ? row(chunk, right) : row(chunk, '')
    first = false
  }
  return out
}

/** CP852-ish mapping for HU letters (byte values). */
const CP852: Record<string, number> = {
  Á: 0xb5,
  É: 0x90,
  Í: 0xd6,
  Ó: 0xe0,
  Ö: 0x99,
  Ő: 0x8a,
  Ú: 0xe9,
  Ü: 0x9a,
  Ű: 0xeb,
  á: 0xa0,
  é: 0x82,
  í: 0xa1,
  ó: 0xa2,
  ö: 0x94,
  ő: 0x8b,
  ú: 0xa3,
  ü: 0x81,
  ű: 0x8f,
  '—': 0x2d,
  '–': 0x2d,
  '…': 0x2e,
  '²': 0xfd
}

function encodeCp852(input: string): Uint8Array {
  const out: number[] = []
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 63
    if (code < 128) {
      out.push(code)
      continue
    }
    const mapped = CP852[ch]
    out.push(mapped ?? 0x3f)
  }
  return new Uint8Array(out)
}

function wrapLegal(s: string, width = 40): string[] {
  const words = s.trim().split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length > width) {
      if (cur) lines.push(cur)
      cur = w
    } else {
      cur = next
    }
  }
  if (cur) lines.push(cur)
  return lines
}

export function generateHandoverEscPos(
  data: HandoverSlipData,
  settings: HandoverSlipSettings,
  copyType: HandoverSlipCopyType
): Uint8Array {
  let c = ''
  c += init()
  c += codePage852()
  c += align(1)
  c += thick()
  c += size(2, 2)
  c += bold(true)
  c += text('Átvételi elismervény')
  c += bold(false)
  c += size(1, 1)

  if (copyType === 'customer') {
    c += size(2, 2)
    c += bold(true)
    c += text(settings.customerCopyLabel || 'Vevői példány')
    c += bold(false)
    c += size(1, 1)
  }
  c += thick()
  c += feed(1)

  if (settings.showCompanyLogo === false) {
    /* logo ESC/POS: skip in MVP */
  }

  if (data.company.name) {
    c += size(2, 2)
    c += bold(true)
    const name =
      data.company.name.length > 24
        ? data.company.name.slice(0, 21) + '...'
        : data.company.name
    c += text(name)
    c += bold(false)
    c += size(1, 1)
  }

  if (settings.showCompanyAddress) {
    const parts = [
      data.company.postalCode,
      data.company.city,
      data.company.address
    ].filter(Boolean)
    if (parts.length) c += text(parts.join(' '))
  }
  if (settings.showCompanyPhone && data.company.phone) {
    c += text(data.company.phone)
  }
  if (settings.showCompanyEmail && data.company.email) {
    c += text(data.company.email)
  }
  if (settings.showTaxNumber && data.company.taxNumber) {
    c += text(`Adószám: ${data.company.taxNumber}`)
  }

  c += feed(1)
  c += align(0)
  c += dashed()

  c += bold(true)
  if (settings.showOrderNumber) {
    c += text(`Megrendelés száma: ${data.orderNumber}`)
  }
  if (settings.showCustomerName) {
    c += text(`Ügyfél neve: ${data.customerName}`)
  }
  c += bold(false)
  c += dashed()

  if (settings.showMaterials && data.materials.length > 0) {
    c += bold(true)
    c += row('Anyag', 'Mennyiség')
    c += bold(false)
    c += dashed()
    for (const m of data.materials) {
      c += wrapRow(m.name, formatMaterialQty(m, settings.qtyFormat))
      if (settings.showEdge && m.edgeLengthM > 0.001) {
        c += row('', `Élzáró: ${m.edgeLengthM.toFixed(2)} m`)
      }
    }
    c += dashed()
  }

  if (settings.showServices && data.services.length > 0) {
    c += bold(true)
    c += row('Megnevezés', 'Mennyiség')
    c += bold(false)
    c += dashed()
    for (const s of data.services) {
      const q =
        s.quantity % 1 === 0
          ? `${s.quantity} ${s.unit}`
          : `${s.quantity.toFixed(2)} ${s.unit}`
      c += row(s.name, q)
    }
    c += dashed()
  }

  if (settings.showFees && data.feeLines.length > 0) {
    for (const f of data.feeLines) {
      c += row(f.name, `${f.qty}`)
    }
    c += dashed()
  }

  if (settings.showAccessories && data.accessoryLines.length > 0) {
    for (const a of data.accessoryLines) {
      c += row(a.name, `${a.qty} db`)
    }
    c += dashed()
  }

  if (settings.showLegalText && settings.legalText.trim()) {
    c += align(1)
    for (const line of wrapLegal(settings.legalText)) {
      c += text(line)
    }
    c += feed(1)
  }

  if (
    copyType === 'original' &&
    settings.showGateLine &&
    settings.gateLineText.trim()
  ) {
    c += align(1)
    c += bold(true)
    for (const line of wrapLegal(settings.gateLineText, 36)) {
      c += text(line)
    }
    c += bold(false)
    c += feed(1)
  }

  if (settings.showPrintDatetime) {
    const now = new Date()
    const d = now.toLocaleDateString('hu-HU')
    const t = now.toLocaleTimeString('hu-HU', {
      hour: '2-digit',
      minute: '2-digit'
    })
    c += align(1)
    c += text(`Nyomtatva: ${d} ${t}`)
    c += feed(1)
  }

  if (copyType === 'original' && settings.showSignatures) {
    c += align(0)
    c += text('Ügyfél aláírása:')
    c += feed(3)
    c += dashed()
    c += text('Átadó munkatárs neve:')
    c += feed(3)
    c += dashed()
  }

  if (settings.showBarcode && data.barcode?.trim()) {
    c += feed(1)
    c += align(1)
    const barcodeText = data.barcode.trim()
    const bytes = new TextEncoder().encode(barcodeText)
    c += GS + 'h' + String.fromCharCode(80)
    c += GS + 'w' + String.fromCharCode(2)
    c += GS + 'H' + String.fromCharCode(0)
    c +=
      GS +
      String.fromCharCode(0x6b) +
      String.fromCharCode(73) +
      String.fromCharCode(bytes.length)
    for (let i = 0; i < bytes.length; i++) {
      c += String.fromCharCode(bytes[i])
    }
    c += '\x00'
    c += feed(1)
    c += text(barcodeText)
    c += feed(2)
  } else {
    c += feed(2)
  }

  c += cut()
  return encodeCp852(c)
}
