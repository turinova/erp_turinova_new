const HUNGARIAN_ASCII_MAP: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ö: 'o',
  ő: 'o',
  ú: 'u',
  ü: 'u',
  ű: 'u',
  Á: 'A',
  É: 'E',
  Í: 'I',
  Ó: 'O',
  Ö: 'O',
  Ő: 'O',
  Ú: 'U',
  Ü: 'U',
  Ű: 'U'
}

/** GSM-7 barát ASCII (magyar ékezetek fold). */
export function toAsciiSmsText(value: string): string {
  if (!value) return ''

  let result = value
  for (const [from, to] of Object.entries(HUNGARIAN_ASCII_MAP)) {
    result = result.split(from).join(to)
  }

  result = result
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '')

  return result.replace(/\s+/g, ' ').trim()
}

export function renderSmsTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  let message = template

  for (const [key, rawValue] of Object.entries(variables)) {
    const value = toAsciiSmsText(String(rawValue ?? ''))
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }

  return toAsciiSmsText(message)
}

/** E.164: + és számjegyek, szóköz nélkül. */
export function normalizeE164(mobile: string | null | undefined): string | null {
  if (!mobile) return null
  const normalized = mobile.replace(/\s+/g, '').trim()
  if (!/^\+[1-9]\d{1,14}$/.test(normalized)) return null
  return normalized
}

/** GSM-7 segment becslés (ASCII fold után). */
export function smsSegments(body: string): number {
  const len = body.length
  if (len <= 0) return 0
  if (len <= 160) return 1
  return Math.ceil(len / 153)
}

const MATERIAL_NAME_MAX = 120

export function joinMaterialNames(names: string[]): string {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  if (unique.length === 0) return ''
  let joined = unique.map((n) => toAsciiSmsText(n)).join(', ')
  if (joined.length > MATERIAL_NAME_MAX) {
    joined = `${joined.slice(0, MATERIAL_NAME_MAX - 1)}…`
  }
  return joined
}
