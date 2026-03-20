import * as cheerio from 'cheerio'

const MAX_SIGNATURE_LENGTH = 50_000
const MAX_EMAIL_BODY_LENGTH = 200_000

/** Escape for use inside a double-quoted HTML attribute. */
function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/**
 * If the admin pastes a full document (<!DOCTYPE>, <html>, <body style="…">), cheerio
 * cannot keep that structure when we inject into a wrapper <div> — <body> styles and
 * layout are lost. Parse as a document, take <body> inner HTML, preserve <body> inline
 * styles on a wrapping <div>, and prepend <style> blocks from <head>.
 */
export function extractBodyFragmentFromFullDocument(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''

  const looksLikeFullDocument =
    /^\s*<!doctype\b/i.test(trimmed) ||
    /^\s*<html[\s>]/i.test(trimmed) ||
    /<body[\s>]/i.test(trimmed)

  if (!looksLikeFullDocument) {
    return trimmed
  }

  try {
    const $ = cheerio.load(trimmed)
    const body = $('body')
    if (body.length === 0) {
      return trimmed
    }

    let fromHead = ''
    $('head style').each((_, el) => {
      const h = $.html(el)
      if (h) fromHead += h
    })

    let inner = body.html() ?? ''
    if (fromHead) {
      inner = fromHead + inner
    }

    const style = (body.attr('style') || '').trim()
    const bgColor = (body.attr('bgcolor') || '').trim()
    const text = (body.attr('text') || '').trim()

    const extra: string[] = []
    if (style) extra.push(style)
    if (bgColor && !/background(-color)?\s*:/i.test(style)) {
      extra.push(`background-color:${bgColor}`)
    }
    if (text && !/(^|;)\s*color\s*:/i.test(style)) {
      extra.push(`color:${text}`)
    }

    if (extra.length) {
      const wrapperStyle = extra.join('; ')
      inner = `<div style="${escapeHtmlAttr(wrapperStyle)}">${inner}</div>`
    }

    return inner.trim()
  } catch {
    return trimmed
  }
}

/**
 * Strip dangerous tags from admin-supplied HTML (signatures, PO e-mail body, etc.).
 */
export function sanitizeEmailHtml(html: string, maxLength: number = MAX_SIGNATURE_LENGTH): string {
  const raw = (html || '').trim()
  if (!raw) return ''
  if (raw.length > maxLength) {
    throw new Error('Az e-mail HTML túl hosszú.')
  }

  const fragment = extractBodyFragmentFromFullDocument(raw)

  const $ = cheerio.load(`<div id="email-sig-root">${fragment}</div>`, null, false)
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
