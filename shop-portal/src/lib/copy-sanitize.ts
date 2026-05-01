/**
 * Strip common LLM typography that reads unnatural in Hungarian shop copy.
 * Safe on HTML strings (does not collapse newlines between tags).
 */

export interface SanitizeAiTypographyOptions {
  /** True for HTML product descriptions; skips aggressive space collapsing */
  isHtml?: boolean
}

export function sanitizeAiTypography(
  text: string,
  options: SanitizeAiTypographyOptions = {}
): string {
  const isHtml = options.isHtml === true
  let s = text
  if (!s) return s

  // HTML entities (common in rich text)
  s = s.replace(/(\d)\s*(?:&ndash;|&mdash;)\s*(\d)/gi, '$1-$2')
  s = s.replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, '$1-$2')

  s = s.replace(/&mdash;/gi, ', ')
  s = s.replace(/&ndash;/gi, ', ')

  // Clause-style em/en dash → Hungarian comma (remaining after numeric cleanup)
  s = s.replace(/\s*[\u2014\u2013]\s*/g, ', ')

  s = s.replace(/,\s*,+/g, ',')
  s = s.replace(/,\s*\./g, '.')
  s = s.replace(/\u2026/g, '...')

  if (!isHtml) {
    s = s.replace(/[ \t]+/g, ' ')
  }

  return s.trim()
}
