/**
 * Validates and sanitizes category GEO content (intro + footer SEO).
 */

export interface CategoryGeoValidationResult {
  valid: boolean
  warnings: string[]
  errors: string[]
  stats: {
    introWordCount: number
    introPlainCharCount: number
    footerWordCount: number
    footerFaqCount: number
    footerH2Count: number
    footerLinkCount: number
  }
}

const HU_LANG_ID = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ=='

const MARKDOWN_FENCE_PATTERN = /```[\s\S]*?```|```(?:html|xml|htm)?/i

export function stripMarkdownCodeFences(text: string): string {
  let result = (text || '').trim()
  result = result.replace(/^```(?:html|xml|htm)?\s*\n?/i, '')
  result = result.replace(/\n?```\s*$/i, '')
  result = result.replace(/```(?:html|xml|htm)?/gi, '')
  return result.trim()
}

export function stripHtmlToPlainText(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export function countWords(text: string): number {
  const plain = stripHtmlToPlainText(text)
  if (!plain) return 0
  return plain.split(/\s+/).filter(Boolean).length
}

function countMatches(html: string, pattern: RegExp): number {
  const matches = html.match(pattern)
  return matches ? matches.length : 0
}

function wrapPlainBlocksAsIntroHtml(text: string): string {
  const cleaned = stripMarkdownCodeFences(text)
  if (/<p\b/i.test(cleaned)) return cleaned

  const blocks = cleaned
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)

  if (blocks.length === 0) {
    const single = cleaned.trim()
    return single ? `<p>${single}</p>` : ''
  }

  return blocks.map((b) => `<p>${b.replace(/\n/g, ' ')}</p>`).join('\n')
}

export function sanitizeCategoryIntroHtml(raw: string): string {
  let html = wrapPlainBlocksAsIntroHtml(raw)
  html = html.replace(/<h[2-6][^>]*>[\s\S]*?<\/h[2-6]>/gi, '')
  html = html.replace(/<ul[\s\S]*?<\/ul>/gi, '')
  return html.trim()
}

export function sanitizeCategoryFooterHtml(raw: string): string {
  const html = stripMarkdownCodeFences(raw)
  if (/<h2\b/i.test(html)) return html.trim()

  // Minimal fallback: wrap plain paragraphs only (no fake headings)
  if (!/<[a-z][\s\S]*?>/i.test(html)) {
    const blocks = html
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean)
    if (blocks.length > 0) {
      return blocks.map((b) => `<p>${b.replace(/\n/g, ' ')}</p>`).join('\n')
    }
  }

  return html.trim()
}

export function hasMarkdownArtifacts(text: string): boolean {
  return MARKDOWN_FENCE_PATTERN.test(text || '') || /^```/m.test(text || '')
}

export function validateCategoryGeoContent(
  introHtml: string,
  footerHtml: string
): CategoryGeoValidationResult {
  const warnings: string[] = []
  const errors: string[] = []

  const introWordCount = countWords(introHtml)
  const introPlainCharCount = stripHtmlToPlainText(introHtml).length
  const footerWordCount = countWords(footerHtml)
  const footerFaqCount = countMatches(footerHtml, /<h3[^>]*>/gi)
  const footerH2Count = countMatches(footerHtml, /<h2[^>]*>/gi)
  const footerLinkCount = countMatches(footerHtml, /<a\s[^>]*href=/gi)

  if (!introHtml?.trim()) {
    errors.push('Hiányzik a rövid intro leírás (termékrács fölött).')
  } else {
    if (!/<p\b/i.test(introHtml)) {
      errors.push('Az intro nem tartalmaz <p> taget — érvénytelen HTML.')
    }
    if (introWordCount < 40) {
      warnings.push(`Az intro túl rövid (${introWordCount} szó). Cél: 50–100 szó.`)
    }
    if (introWordCount > 120) {
      errors.push(`Az intro túl hosszú (${introWordCount} szó). Max ~100 szó a rács fölött.`)
    }
    if (/<h[2-6]/i.test(introHtml)) {
      errors.push('Az intro nem tartalmazhat H2+ címsorokat.')
    }
  }

  if (!footerHtml?.trim()) {
    errors.push('Hiányzik a footer SEO szöveg (termékrács alatt).')
  } else {
    if (footerH2Count < 3) {
      errors.push(`A footerben kevés H2 szekció (${footerH2Count}). Legalább 3 kötelező.`)
    }
    if (footerFaqCount < 4) {
      warnings.push(`Kevés GYIK kérdés (${footerFaqCount}). Cél: legalább 5.`)
    }
    if (footerLinkCount < 1) {
      errors.push('A footerben nincs belső link (<a href>). Adj meg legalább 1 termék- vagy kategória linket.')
    }
    if (footerWordCount < 250) {
      warnings.push(`A footer SEO túl rövid (${footerWordCount} szó). Cél: 400+ szó.`)
    }
    if (!/<h3\b/i.test(footerHtml)) {
      warnings.push('A footer GYIK szekciója nem tartalmaz <h3> kérdéseket.')
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    stats: {
      introWordCount,
      introPlainCharCount,
      footerWordCount,
      footerFaqCount,
      footerH2Count,
      footerLinkCount
    }
  }
}

export { HU_LANG_ID }
