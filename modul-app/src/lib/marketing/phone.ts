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
