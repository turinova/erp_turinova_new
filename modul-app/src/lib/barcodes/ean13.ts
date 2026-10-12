/**
 * Belső (bolt) EAN-13 — GS1 restricted circulation prefix `200`.
 * Gyártói GS1 helyett: címkézéshez / POS scanhez, ha nincs gyári vonalkód.
 */

export const INTERNAL_EAN13_PREFIX = '200'

/** 12 digit → check digit (0–9). */
export function ean13CheckDigit(digits12: string): number {
  const d = digits12.replace(/\D/g, '')
  if (d.length !== 12) {
    throw new Error('EAN-13 check digithez 12 számjegy kell.')
  }
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const n = Number(d[i])
    sum += i % 2 === 0 ? n : n * 3
  }
  return (10 - (sum % 10)) % 10
}

export function buildEan13(digits12: string): string {
  const d = digits12.replace(/\D/g, '')
  if (d.length !== 12) {
    throw new Error('EAN-13-hoz 12 számjegy kell.')
  }
  return `${d}${ean13CheckDigit(d)}`
}

export function isValidEan13(code: string): boolean {
  const d = code.replace(/\D/g, '')
  if (d.length !== 13) return false
  try {
    return buildEan13(d.slice(0, 12)) === d
  } catch {
    return false
  }
}

/** prefix (3) + body (9) → EAN-13 */
export function buildInternalEan13(
  body9: string,
  prefix = INTERNAL_EAN13_PREFIX
): string {
  const p = prefix.replace(/\D/g, '')
  const b = body9.replace(/\D/g, '').padStart(9, '0').slice(-9)
  if (p.length !== 3) {
    throw new Error('Belső EAN prefix 3 számjegy legyen.')
  }
  return buildEan13(`${p}${b}`)
}

/** Véletlen 9 számjegy (crypto ha van). */
export function randomEan13Body9(): string {
  const buf = new Uint32Array(2)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf)
  } else {
    buf[0] = Math.floor(Math.random() * 0xffffffff)
    buf[1] = Math.floor(Math.random() * 0xffffffff)
  }
  const n = (buf[0]! * 0x100000000 + buf[1]!) % 1_000_000_000
  return String(n).padStart(9, '0')
}
