const HUNGARIAN_ASCII_MAP: Record<string, string> = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ö: 'o', ő: 'o', ú: 'u', ü: 'u', ű: 'u',
  Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ö: 'O', Ő: 'O', Ú: 'U', Ü: 'U', Ű: 'U',
}

/**
 * Convert text to GSM-7 friendly ASCII for SMS (Hungarian accents folded).
 */
export function toAsciiSmsText(value: string): string {
  if (!value) return ''

  let result = value
  for (const [from, to] of Object.entries(HUNGARIAN_ASCII_MAP)) {
    result = result.split(from).join(to)
  }

  // NFKD strips combining marks; remove remaining non-ASCII (e.g. Greek omicron lookalikes).
  result = result
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '')

  return result.replace(/\s+/g, ' ').trim()
}

/** Format price for SMS using regular ASCII spaces (not hu-HU narrow no-break space). */
export function formatSmsPrice(amount: number): string {
  const rounded = Math.round(amount)
  const formatted = new Intl.NumberFormat('hu-HU').format(rounded)
  return `${toAsciiSmsText(formatted.replace(/[\u00a0\u202f]/g, ' '))} Ft`
}

/**
 * Replace {placeholders} in an SMS template with ASCII-sanitized values.
 */
export function renderSmsTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  let message = template

  for (const [key, rawValue] of Object.entries(variables)) {
    const value = toAsciiSmsText(String(rawValue ?? ''))
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }

  return message
}
