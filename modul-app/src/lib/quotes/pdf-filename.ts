/**
 * Letöltött lapszabászat PDF fájlnév — emberi rész + egyedi szám.
 * Stack: projekt → megrendelő → dátum; mindig __{AJ|MR-szám}.
 */

const MAX_HUMAN_LEN = 40

/** Ékezet / zaj → ASCII slug (Windows / email barát). */
export function slugForPdfFilename(raw: string, maxLen = MAX_HUMAN_LEN): string {
  const mapped = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  if (!mapped) return ''
  return mapped.slice(0, maxLen).replace(/-+$/g, '')
}

function isoDateOnly(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/)
    return m?.[1] ?? ''
  }
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

export type QuotePdfFilenameInput = {
  projectName?: string | null
  customerName?: string | null
  quoteNumber: string
  orderNumber?: string | null
  createdAt?: string | null
}

/**
 * pl. Konyha-Kovacs__Q-2026-016.pdf
 *     Nagy-Janos__Q-2026-016.pdf
 *     2026-10-29__Q-2026-016.pdf
 */
export function buildQuotePdfFilename(input: QuotePdfFilenameInput): string {
  const docId = slugForPdfFilename(
    (input.orderNumber || input.quoteNumber || 'ajanlat').trim(),
    48
  )
  const project = slugForPdfFilename((input.projectName || '').trim())
  const customer = slugForPdfFilename((input.customerName || '').trim())
  const date = isoDateOnly(input.createdAt)
  const human = project || customer || date || 'Arajanlat'
  return `${human}__${docId || 'ajanlat'}.pdf`
}
