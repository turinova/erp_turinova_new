/** Shared helpers for customer-facing (ügyfélajánlat) PDFs. */

const LOGO_MAX_CHARS = 700_000
const LOGO_RE = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/i

export function sanitizeWorkshopLogoDataUrl(raw: unknown): string | undefined {
  const s = String(raw || '').trim()
  if (!s) return undefined
  if (s.length > LOGO_MAX_CHARS) return undefined
  if (!LOGO_RE.test(s)) return undefined
  return s.replace(/\s/g, '')
}

export type PaymentScheduleId = '40-40-20' | '50-50' | 'none'

export type PdfPaletteId = 'mono' | 'forest' | 'navy' | 'walnut' | 'slate' | 'custom'

export type PdfPaletteTokens = {
  ink: string
  muted: string
  rule: string
  thBg: string
  accent: string
  totalBg: string
  totalFg: string
}

const PAYMENT_TEXT: Record<PaymentScheduleId, string> = {
  '40-40-20': 'Fizetés: 40% előleg, 40% gyártás előtt, 20% átadáskor.',
  '50-50': 'Fizetés: 50% előleg, 50% átadáskor.',
  none: ''
}

const NOTES_MAX = 500
const PAYMENT_CUSTOM_MAX = 240
const LEAD_MAX = 200
const TITLE_MAX = 120

export const PDF_PALETTES: Record<Exclude<PdfPaletteId, 'custom'>, PdfPaletteTokens> = {
  mono: {
    ink: '#212121',
    muted: '#424242',
    rule: '#000000',
    thBg: '#f5f5f5',
    accent: '#212121',
    totalBg: '#212121',
    totalFg: '#ffffff'
  },
  forest: {
    ink: '#1B2E1C',
    muted: '#3E5C40',
    rule: '#2E7D32',
    thBg: '#E8F5E9',
    accent: '#2E7D32',
    totalBg: '#2E7D32',
    totalFg: '#ffffff'
  },
  navy: {
    ink: '#0F1C2E',
    muted: '#3D4F66',
    rule: '#1A365D',
    thBg: '#E8EEF5',
    accent: '#1A365D',
    totalBg: '#1A365D',
    totalFg: '#ffffff'
  },
  walnut: {
    ink: '#2C1810',
    muted: '#5D4037',
    rule: '#6D4C41',
    thBg: '#EFEBE9',
    accent: '#5D4037',
    totalBg: '#5D4037',
    totalFg: '#ffffff'
  },
  slate: {
    ink: '#263238',
    muted: '#546E7A',
    rule: '#455A64',
    thBg: '#ECEFF1',
    accent: '#455A64',
    totalBg: '#455A64',
    totalFg: '#ffffff'
  }
}

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b]
      .map(v => clampByte(v).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = String(hex || '')
    .trim()
    .match(/^#?([0-9a-fA-F]{6})$/)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function mixRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number
) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  }
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const lin = [r, g, b].map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

/** Build printable tokens from a single accent hex. */
export function derivePaletteFromAccent(hex: string): PdfPaletteTokens | null {
  const rgb = parseHexRgb(hex)
  if (!rgb) return null
  const accent = rgbToHex(rgb.r, rgb.g, rgb.b)
  const white = { r: 255, g: 255, b: 255 }
  const black = { r: 0, g: 0, b: 0 }
  const inkRgb = mixRgb(rgb, black, 0.72)
  const mutedRgb = mixRgb(rgb, black, 0.35)
  const thRgb = mixRgb(rgb, white, 0.88)
  const ruleRgb = mixRgb(rgb, black, 0.15)
  const lightAccent = relativeLuminance(rgb) > 0.55
  return {
    ink: rgbToHex(inkRgb.r, inkRgb.g, inkRgb.b),
    muted: rgbToHex(mutedRgb.r, mutedRgb.g, mutedRgb.b),
    rule: rgbToHex(ruleRgb.r, ruleRgb.g, ruleRgb.b),
    thBg: rgbToHex(thRgb.r, thRgb.g, thRgb.b),
    accent,
    totalBg: accent,
    totalFg: lightAccent ? '#212121' : '#FFFFFF'
  }
}

export function resolvePaymentScheduleText(raw: unknown): string {
  const id = String(raw || '').trim() as PaymentScheduleId
  return PAYMENT_TEXT[id] || ''
}

/** Custom text wins; otherwise preset schedule text. */
export function resolvePaymentText(schedule: unknown, customText: unknown): string {
  const custom = String(customText || '')
    .trim()
    .slice(0, PAYMENT_CUSTOM_MAX)
  if (custom) return custom
  return resolvePaymentScheduleText(schedule)
}

export function resolveProjectTitle(raw: unknown): string {
  return String(raw || '')
    .trim()
    .slice(0, TITLE_MAX)
}

export function resolveLeadTimeNote(raw: unknown): string {
  return String(raw || '')
    .trim()
    .slice(0, LEAD_MAX)
}

export function resolveCustomerNotes(raw: unknown): string {
  return String(raw || '')
    .trim()
    .slice(0, NOTES_MAX)
}

export function resolvePdfPaletteId(raw: unknown): PdfPaletteId {
  const id = String(raw || '').trim()
  if (
    id === 'forest' ||
    id === 'navy' ||
    id === 'walnut' ||
    id === 'slate' ||
    id === 'mono' ||
    id === 'custom'
  ) {
    return id
  }
  return 'mono'
}

/** Normalize to #RRGGBB or undefined. */
export function resolveAccentHex(raw: unknown): string | undefined {
  const rgb = parseHexRgb(String(raw || ''))
  if (!rgb) return undefined
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

export function resolveShowVatNote(raw: unknown): boolean {
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true
  return true
}

export function resolvePdfPaletteTokens(opts: {
  paletteId?: unknown
  accentHex?: unknown
}): PdfPaletteTokens {
  const fromAccent = resolveAccentHex(opts.accentHex)
  if (fromAccent) {
    return derivePaletteFromAccent(fromAccent) || PDF_PALETTES.mono
  }
  const id = resolvePdfPaletteId(opts.paletteId)
  if (id === 'custom') return PDF_PALETTES.mono
  return PDF_PALETTES[id]
}

/** CSS custom properties + class overrides for all customer-facing templates. */
export function renderPaletteCss(opts?: {
  paletteId?: PdfPaletteId | string
  accentHex?: string
}): string {
  const p = resolvePdfPaletteTokens({
    paletteId: opts?.paletteId,
    accentHex: opts?.accentHex
  })
  return `
      :root {
        --pdf-ink: ${p.ink};
        --pdf-muted: ${p.muted};
        --pdf-rule: ${p.rule};
        --pdf-th-bg: ${p.thBg};
        --pdf-accent: ${p.accent};
        --pdf-total-bg: ${p.totalBg};
        --pdf-total-fg: ${p.totalFg};
      }
      body { color: var(--pdf-ink) !important; }
      .header { border-bottom-color: var(--pdf-rule) !important; }
      .title { color: var(--pdf-accent) !important; }
      .project-title, .quote-number { color: var(--pdf-muted) !important; }
      .column-title { color: var(--pdf-accent) !important; }
      th {
        background-color: var(--pdf-th-bg) !important;
        color: var(--pdf-ink) !important;
        border-color: var(--pdf-rule) !important;
      }
      td { border-bottom-color: var(--pdf-rule) !important; color: var(--pdf-ink) !important; }
      .summary-row-total {
        background-color: var(--pdf-total-bg) !important;
        color: var(--pdf-total-fg) !important;
      }
      .summary-row-bold {
        border-top-color: var(--pdf-accent) !important;
        color: var(--pdf-ink) !important;
      }
      .chip {
        border-color: var(--pdf-accent) !important;
        color: var(--pdf-accent) !important;
      }
      .notes-section {
        border-top-color: var(--pdf-rule) !important;
        color: var(--pdf-ink) !important;
      }
      .footer { border-top-color: var(--pdf-rule) !important; }
  `
}

/** Shared closing blocks for all customer-facing PDFs (asztalos-simple). */
export function renderCustomerFacingClosingHtml(opts: {
  workshopPhone?: string | null
  workshopEmail?: string | null
  paymentText?: string
  leadTimeNote?: string
  customerNotes?: string
  showVatNote?: boolean
}): string {
  const escape = (t: string) =>
    String(t || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const contactBits = [
    opts.workshopPhone ? `Telefon: ${escape(opts.workshopPhone)}` : '',
    opts.workshopEmail ? `E-mail: ${escape(opts.workshopEmail)}` : ''
  ].filter(Boolean)

  const notes = opts.customerNotes
    ? `<div style="margin-bottom: 0.75em;">
        <div style="font-weight: 700; margin-bottom: 0.25em;">Megjegyzés</div>
        <div style="white-space: pre-wrap;">${escape(opts.customerNotes)}</div>
      </div>`
    : ''

  const payment = opts.paymentText
    ? `<div style="margin-bottom: 0.4em;">${escape(opts.paymentText)}</div>`
    : ''
  const lead = opts.leadTimeNote
    ? `<div style="margin-bottom: 0.4em;">Várható idő: ${escape(opts.leadTimeNote)}</div>`
    : ''
  const vat = opts.showVatNote
    ? `<div style="margin-bottom: 0.4em; font-size: 9px; color: var(--pdf-muted, #424242);">Az árak bruttó összegek, ÁFÁ-t tartalmaznak (27%).</div>`
    : ''

  return `
    <div class="notes-section" style="margin-top: 1.25em;">
      ${notes}
      ${payment}
      ${lead}
      ${vat}
      <div style="font-weight: 700; margin-bottom: 0.35em;">Következő lépés</div>
      <div>Az ajánlat elfogadásához hívjon vagy írjon${contactBits.length ? ':' : '.'}</div>
      ${contactBits.map(b => `<div>${b}</div>`).join('')}
      <div style="margin-top: 0.75em; font-size: 9px; color: var(--pdf-muted, #424242);">
        Ez tájékoztató árajánlat, nem számla és nem díjbekérő.
      </div>
    </div>
  `
}

export function renderWorkshopLogoHtml(logoDataUrl?: string): string {
  if (!logoDataUrl) return ''
  const safe = logoDataUrl.replace(/"/g, '')
  return `<img src="${safe}" alt="Logo" class="header-logo" />`
}
