import { normalizeBarcode } from '@/lib/quotes/production-utils'

/**
 * HU billentyűzet + US wedge scanner: HID Digit0 → OS `ö`, Minus → `ü`, Y/Z csere.
 * NFC + nagybetű + NFD (o + combining diaeresis) is kezelve.
 */
const WEDGE_CHAR_MAP: Record<string, string> = {
  ö: '0',
  Ö: '0',
  ü: '-',
  Ü: '-',
  // NFD / rare: ó often = on HU (Equal key) — only remap if scanner US Minus/Equal confusion is separate
}

/** Physical `e.code` → US-layout ASCII (locale-független wedge path). */
const CODE_TO_ASCII: Record<string, string> = {
  Digit0: '0',
  Digit1: '1',
  Digit2: '2',
  Digit3: '3',
  Digit4: '4',
  Digit5: '5',
  Digit6: '6',
  Digit7: '7',
  Digit8: '8',
  Digit9: '9',
  KeyA: 'a',
  KeyB: 'b',
  KeyC: 'c',
  KeyD: 'd',
  KeyE: 'e',
  KeyF: 'f',
  KeyG: 'g',
  KeyH: 'h',
  KeyI: 'i',
  KeyJ: 'j',
  KeyK: 'k',
  KeyL: 'l',
  KeyM: 'm',
  KeyN: 'n',
  KeyO: 'o',
  KeyP: 'p',
  KeyQ: 'q',
  KeyR: 'r',
  KeyS: 's',
  KeyT: 't',
  KeyU: 'u',
  KeyV: 'v',
  KeyW: 'w',
  // US wedge: KeyY sends Y scancode; KeyZ sends Z — no swap here (layout-independent codes)
  KeyX: 'x',
  KeyY: 'y',
  KeyZ: 'z',
  Minus: '-',
  Equal: '=',
  Period: '.',
  Slash: '/',
  Space: ' '
}

/**
 * Egy keydown esemény → 1 karakter a wedge bufferhez.
 * Prefer `e.code` (Digit0…), fallback `e.key` + HU remap.
 */
export function charFromWedgeKeyboardEvent(e: {
  code: string
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}): string | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null
  if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape') return null
  if (e.key === 'Backspace' || e.key === 'Delete') return null
  if (e.key.length > 1 && !CODE_TO_ASCII[e.code]) return null

  const fromCode = CODE_TO_ASCII[e.code]
  if (fromCode) return fromCode

  if (e.key.length !== 1) return null
  return WEDGE_CHAR_MAP[e.key] ?? e.key
}

function remapWedgeChars(raw: string): string {
  // NFC so Ö is one codepoint; then map; then strip combining marks left on o/u
  return raw
    .normalize('NFC')
    .split('')
    .map((ch) => {
      if (WEDGE_CHAR_MAP[ch]) return WEDGE_CHAR_MAP[ch]!
      return ch
    })
    .join('')
    .normalize('NFD')
    .replace(/o\u0308/gi, '0') // o + diaeresis → 0
    .replace(/u\u0308/gi, '-') // u + diaeresis → -
    .normalize('NFC')
}

/**
 * HU layout + US wedge: ö/Ö→0, ü/Ü→-, NFD ö→0.
 * Y→Z: numerikus-nehéz EAN/UPC (digitRatio≥0.7) mindig; betűs beszállítói
 * kódoknál (DT-CZ…) a lookup kandidátus lista viszi a Y↔Z variánst.
 * ASCII betűk UPPER — `e.code` Key* mindig kisbetű; DB / címke tipikusan `DT-CZ…`.
 */
export function normalizeScannerBarcode(raw: string): string {
  let remapped = remapWedgeChars(raw)

  const alnum = remapped.replace(/[^0-9A-Za-z]/g, '')
  const digitRatio =
    alnum.length === 0
      ? 0
      : [...alnum].filter((c) => c >= '0' && c <= '9').length / alnum.length
  // EAN/UPC: HU QWERTZ KeyZ→Y scancode nélkül is javít (legacy).
  // Alfanumerikus (DT-CZ…): digitRatio < 0.7 → ne írd át a primary stringet;
  // barcodeLookupCandidates adja a Y↔Z próbákat.
  if (digitRatio >= 0.7) {
    remapped = remapped.replace(/Y/g, 'Z').replace(/y/g, 'z')
  }

  // Locale-független ASCII upper (ne Turkish İ)
  return normalizeBarcode(remapped).replace(/[a-z]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 32)
  )
}

/** Alphanumeric-only UPPER (kötőjel / írásjel nélkül) — HU wedge + CODE128. */
export function barcodeCompactAlnum(code: string): string {
  return code.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
}

/**
 * HU QWERTZ: KeyZ scancode nélkül Y jön a mezőbe → DT-CY… vs DT-CZ….
 * Egy lépéses Y↔Z csere (nem idempotens kétszer).
 */
export function swapBarcodeYZ(code: string): string {
  return code
    .replace(/Y/g, '\u0000')
    .replace(/Z/g, 'Y')
    .replace(/\u0000/g, 'Z')
}
