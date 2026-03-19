import * as cheerio from 'cheerio'

const MAX_SIGNATURE_LENGTH = 50_000
const MAX_EMAIL_BODY_LENGTH = 200_000

/**
 * Strip dangerous tags from admin-supplied HTML (signatures, PO e-mail body, etc.).
 */
export function sanitizeEmailHtml(html: string, maxLength: number = MAX_SIGNATURE_LENGTH): string {
  const raw = (html || '').trim()
  if (!raw) return ''
  if (raw.length > maxLength) {
    throw new Error('Az e-mail HTML túl hosszú.')
  }
  const $ = cheerio.load(`<div id="email-sig-root">${raw}</div>`, null, false)
  $('#email-sig-root script, #email-sig-root iframe, #email-sig-root object, #email-sig-root embed').remove()
  return $('#email-sig-root').html() || ''
}

/**
 * Strip dangerous tags from HTML email signatures (admin-supplied).
 */
export function sanitizeSignatureHtml(html: string): string {
  return sanitizeEmailHtml(html, MAX_SIGNATURE_LENGTH)
}

/** Full outbound e-mail body (intro + table + signature) — larger limit. */
export function sanitizeEmailBodyHtml(html: string): string {
  return sanitizeEmailHtml(html, MAX_EMAIL_BODY_LENGTH)
}
