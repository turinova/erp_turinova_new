/**
 * HU / nemzetközi telefon normalizálás marketing űrlapokhoz.
 * Elfogad: +36…, 06…, szóköz/kötőjel; kimenet E.164 ha lehetséges.
 */

const FAKE_RE =
  /^(0{6,}|1{6,}|1234567|12345678|1111111|0000000|9999999)$/

export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * @returns E.164 string (pl. +36301234567) vagy null ha érvénytelen
 */
export function normalizePhoneE164(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let digits = digitsOnly(trimmed)
  if (!digits) return null

  // 00 előtag → nemzetközi
  if (digits.startsWith('00')) digits = digits.slice(2)

  // HU: 06XXXXXXXXX → 36XXXXXXXXX
  if (digits.startsWith('06') && digits.length >= 9) {
    digits = `36${digits.slice(2)}`
  }

  // HU: 9 számjegy országkód nélkül (30/20/70…) → 36…
  if (digits.length === 9 && /^[237]0/.test(digits)) {
    digits = `36${digits}`
  }

  // Már 36-tal kezdődik
  if (digits.startsWith('36')) {
    // mobil: 36 + 9 digit = 11; vezetékes változó
    if (digits.length < 10 || digits.length > 12) return null
    const national = digits.slice(2)
    if (FAKE_RE.test(national) || FAKE_RE.test(digits)) return null
    return `+${digits}`
  }

  // Egyéb ország: 8–15 digit (E.164 max 15)
  if (digits.length >= 8 && digits.length <= 15) {
    if (FAKE_RE.test(digits)) return null
    return `+${digits}`
  }

  return null
}

/** Megjelenítéshez: +36 30 123 4567 stílus (best-effort). */
export function formatPhoneDisplay(e164: string): string {
  if (e164.startsWith('+36') && e164.length === 12) {
    const n = e164.slice(3)
    return `+36 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`
  }
  return e164
}

function formatHuE164Display(digitsWith36: string): string {
  const national = digitsWith36.slice(2, 11) // max 9 nemzeti
  if (!national) return '+36'
  const parts = ['+36']
  parts.push(national.slice(0, Math.min(2, national.length)))
  if (national.length > 2) {
    parts.push(national.slice(2, Math.min(5, national.length)))
  }
  if (national.length > 5) {
    parts.push(national.slice(5, Math.min(9, national.length)))
  }
  return parts.join(' ')
}

/**
 * Élő maszkolás gépelés / beillesztés közben.
 * HU mobil (20/30/50/70) vagy 06… → `+36 XX XXX XXXX`.
 * Más `+` országkód érintetlen marad.
 */
export function formatPhoneInput(raw: string): string {
  const trimmed = raw.trimStart()
  if (!trimmed) return ''

  const wantsPlus = trimmed.startsWith('+')
  let digits = digitsOnly(trimmed)
  if (!digits) return wantsPlus ? '+' : ''

  if (digits.startsWith('00')) digits = digits.slice(2)

  // +36 felé gépelés: csak „+3”
  if (wantsPlus && digits === '3') return '+3'

  // Explicit külföld: +… és nem 36 / nem 06 (pl. +49, +30, +39)
  if (
    wantsPlus &&
    !digits.startsWith('36') &&
    !digits.startsWith('06') &&
    digits !== '3'
  ) {
    return `+${digits.slice(0, 15)}`
  }

  if (digits.startsWith('06')) digits = `36${digits.slice(2)}`

  // Bare HU national: 20/30/50/70…
  if (!digits.startsWith('36') && /^[2357]0/.test(digits)) {
    digits = `36${digits}`
  }

  if (digits.startsWith('36')) return formatHuE164Display(digits)

  // Még nem egyértelmű (pl. „1”, „5”) — nyers számjegyek
  return wantsPlus ? `+${digits}` : digits
}
