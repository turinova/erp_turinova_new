export type ManualLineType = 'shipping' | 'assembly' | 'hardware' | 'fee' | 'other'

export type ManualLineDraft = {
  id: string
  type: ManualLineType
  title: string
  quantity: string
  unit: string
  unitPriceGross: string
}

export type BuyerDraft = {
  name: string
  phone: string
  email: string
  postalCode: string
  city: string
  street: string
  taxNumber: string
}

export type SellerProfile = {
  name: string
  email: string
  mobile: string
  billing_name: string
  billing_postal_code: string
  billing_city: string
  billing_street: string
  billing_house_number: string
  billing_tax_number: string
  /** Profilból (Beállítások) — ügyfélajánlat PDF logo. */
  workshop_logo_data_url?: string
}

export type PaymentScheduleId = '40-40-20' | '50-50' | 'none'

export type PdfPaletteId = 'mono' | 'forest' | 'navy' | 'walnut' | 'slate' | 'custom'

export type CustomerFacingPdfPayload = {
  preparedBy: string
  /** Ajánlat érvényesség (YYYY-MM-DD). */
  validUntil: string
  /** Analytics only; preview ignores it. */
  generatedFrom?: 'saved' | 'orders' | 'studio'
  /** Mentett ügyfélajánlat id (frissítés). */
  customerQuoteId?: string
  /** Opcionális projektnév (pl. „Konyha – Kovács”). */
  projectTitle?: string
  /** Fizetési ütem sablon. */
  paymentSchedule?: PaymentScheduleId
  /** Saját fizetési szöveg — felülírja a presetet, ha nem üres. */
  paymentCustomText?: string
  /** Várható idő tipp (szabad szöveg). */
  leadTimeNote?: string
  /** Megjegyzés az ügyfélnek (PDF-en). */
  customerNotes?: string
  /** PDF színpaletta preset. */
  paletteId?: PdfPaletteId
  /** Egyedi accent hex (#RRGGBB) — ha van, ez nyeri a palettát. */
  accentHex?: string
  /** „ÁFA-t tartalmaz (27%)” tájékoztató sor. */
  showVatNote?: boolean
  /** Asztalos logo data URL (data:image/...;base64,...). */
  workshopLogoDataUrl?: string
  buyer: BuyerDraft
  pricing: {
    markupPercent: number
    lineDisplay: 'collapsed' | 'detailed'
    roundTo: 0 | 100 | 1000
  }
  /**
   * Portál források a kombinált PDF-hez (max. 8).
   * lineDisplay: collapsed = 1 összegző sor; detailed = bontott tételek.
   */
  portalSources?: Array<{
    type: QuoteSourceType
    id: string
    markupPercent: number
    roundTo: 0 | 100 | 1000
    lineDisplay?: 'collapsed' | 'detailed'
  }>
  manualLines: Array<{
    type: ManualLineType
    title: string
    quantity: number
    unit: string
    unitPriceGross: number
  }>
}

export type QuoteSourceType = 'nettfront' | 'lapszabaszat'

export type QuoteSourceInfo = {
  type: QuoteSourceType
  id: string
  quoteNumber: string
  boardGross: number
  productLabel: string
  previewUrl: string
  pdfUrl: string
}

export function sourceKey(s: { type: QuoteSourceType; id: string }) {
  return `${s.type}:${s.id}`
}

export function sourceProductLabel(type: QuoteSourceType): string {
  return type === 'nettfront' ? 'Nettfront (frontok)' : 'Lapszabászat (korpusz)'
}

/** Soft cap — UI + server. */
export const MAX_PORTAL_SOURCES = 8

export type StudioSourceRef = { type: QuoteSourceType; id: string }

/** Parse `s=lapszabaszat:uuid,nettfront:uuid` (+ legacy query keys). */
export function parseStudioSourceRefs(params: {
  s?: string | null
  lapszabaszat?: string | null
  nettfront?: string | null
  from?: string | null
  id?: string | null
}): StudioSourceRef[] {
  const out: StudioSourceRef[] = []
  const seen = new Set<string>()

  const push = (type: QuoteSourceType, id: string) => {
    const trimmed = id.trim()
    if (!trimmed) return
    const key = `${type}:${trimmed}`
    if (seen.has(key)) return
    if (out.length >= MAX_PORTAL_SOURCES) return
    seen.add(key)
    out.push({ type, id: trimmed })
  }

  const raw = String(params.s || '').trim()
  if (raw) {
    for (const part of raw.split(',')) {
      const [typeRaw, ...rest] = part.trim().split(':')
      const id = rest.join(':').trim()
      if (typeRaw === 'lapszabaszat' || typeRaw === 'nettfront') {
        push(typeRaw, id)
      }
    }
  }

  // Legacy single keys (only if `s` empty — avoid duplicates)
  if (!raw) {
    if (params.lapszabaszat) push('lapszabaszat', params.lapszabaszat)
    if (params.nettfront) push('nettfront', params.nettfront)
    const legacyFrom =
      params.from === 'nettfront' || params.from === 'lapszabaszat' ? params.from : null
    const legacyId = params.id?.trim() || null
    if (legacyFrom && legacyId) push(legacyFrom, legacyId)
  }

  return out
}

/** Studio URL with repeatable sources via `s=` (+ optional mentett `cid`). */
export function buildStudioSourcesUrl(
  sources: StudioSourceRef[],
  opts?: { customerQuoteId?: string | null }
): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const s of sources) {
    if (s.type !== 'lapszabaszat' && s.type !== 'nettfront') continue
    const id = s.id.trim()
    if (!id) continue
    const key = `${s.type}:${id}`
    if (seen.has(key)) continue
    seen.add(key)
    parts.push(key)
    if (parts.length >= MAX_PORTAL_SOURCES) break
  }
  const qs = new URLSearchParams()
  const cid = String(opts?.customerQuoteId || '').trim()
  if (cid) qs.set('cid', cid)
  if (parts.length > 0) qs.set('s', parts.join(','))
  const q = qs.toString()
  return q ? `/ugyfel-ajanlat/uj?${q}` : '/ugyfel-ajanlat/uj'
}

export type RecentSavedQuote = {
  id: string
  quote_number: string
  final_total_after_discount: number
  updated_at: string
  type: 'opti' | 'nettfront'
  /** draft = mentett; ordered = megrendelt / submitted */
  origin: 'draft' | 'ordered'
}

export const PREPARED_BY_KEY = 'muhely_ugyfel_pdf_prepared_by'
export const BUYER_KEY = 'muhely_ugyfel_pdf_buyer'
export const LOGO_KEY = 'muhely_ugyfel_pdf_logo'
export const PAYMENT_KEY = 'muhely_ugyfel_pdf_payment'
export const PAYMENT_CUSTOM_KEY = 'muhely_ugyfel_pdf_payment_custom'
export const PALETTE_KEY = 'muhely_ugyfel_pdf_palette'
export const ACCENT_HEX_KEY = 'muhely_ugyfel_pdf_accent_hex'
export const VAT_NOTE_KEY = 'muhely_ugyfel_pdf_vat_note'
export const NOTES_KEY = 'muhely_ugyfel_pdf_notes'
/** ~500 KB binary → safe data-URL length cap */
export const LOGO_MAX_DATA_URL_CHARS = 700_000
export const NOTES_MAX_CHARS = 500
export const PAYMENT_CUSTOM_MAX_CHARS = 240
export const SOFT_GREEN = '#2E7D32'
export const SOFT_GREEN_HOVER = '#1B5E20'
export const PREVIEW_ZOOM_DEFAULT = 0.78
export const PREVIEW_ZOOM_MIN = 0.4
export const PREVIEW_ZOOM_MAX = 1.4
export const PREVIEW_ZOOM_STEP = 0.1
export const PREVIEW_PAGE_W = 794
export const PREVIEW_PAGE_H = 2300

export const LINE_TYPE_LABEL: Record<ManualLineType, string> = {
  shipping: 'Szállítás',
  assembly: 'Szerelés',
  hardware: 'Vasalat',
  fee: 'Díj',
  other: 'Egyéb'
}

export const LINE_TEMPLATES: Array<{
  type: ManualLineType
  title: string
  unit: string
  quantity: string
}> = [
  { type: 'shipping', title: 'Szállítás', unit: 'db', quantity: '1' },
  { type: 'assembly', title: 'Szerelés', unit: 'nap', quantity: '1' },
  { type: 'hardware', title: 'Vasalat összesen', unit: 'db', quantity: '1' },
  { type: 'fee', title: 'Felár / kezelési díj', unit: 'db', quantity: '1' }
]

export const PAYMENT_SCHEDULE_OPTIONS: Array<{
  id: PaymentScheduleId
  label: string
  pdfText: string
}> = [
  {
    id: '40-40-20',
    label: '40% · 40% · 20%',
    pdfText: 'Fizetés: 40% előleg, 40% gyártás előtt, 20% átadáskor.'
  },
  {
    id: '50-50',
    label: '50% · 50%',
    pdfText: 'Fizetés: 50% előleg, 50% átadáskor.'
  },
  {
    id: 'none',
    label: 'Nincs megadva',
    pdfText: ''
  }
]

export const PDF_PALETTE_OPTIONS: Array<{
  id: Exclude<PdfPaletteId, 'custom'>
  label: string
  swatch: string
}> = [
  { id: 'mono', label: 'Klasszikus', swatch: '#212121' },
  { id: 'forest', label: 'Zöld', swatch: '#2E7D32' },
  { id: 'navy', label: 'Kék', swatch: '#1A365D' },
  { id: 'walnut', label: 'Dió', swatch: '#5D4037' },
  { id: 'slate', label: 'Szürke', swatch: '#455A64' }
]

export function normalizeAccentHex(raw: string): string | null {
  const m = String(raw || '')
    .trim()
    .match(/^#?([0-9a-fA-F]{6})$/)
  if (!m) return null
  return `#${m[1].toUpperCase()}`
}

export function paymentSchedulePdfText(id: PaymentScheduleId | undefined): string {
  return PAYMENT_SCHEDULE_OPTIONS.find(o => o.id === id)?.pdfText || ''
}

export function loadLogoDataUrl(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = localStorage.getItem(LOGO_KEY) || ''
    return raw.startsWith('data:image/') ? raw : ''
  } catch {
    return ''
  }
}

export function saveLogoDataUrl(dataUrl: string) {
  if (typeof window === 'undefined') return
  try {
    if (!dataUrl) localStorage.removeItem(LOGO_KEY)
    else localStorage.setItem(LOGO_KEY, dataUrl)
  } catch {
    /* ignore quota */
  }
}

export function loadPaymentSchedule(): PaymentScheduleId {
  if (typeof window === 'undefined') return '50-50'
  try {
    const raw = localStorage.getItem(PAYMENT_KEY)
    if (raw === '40-40-20' || raw === '50-50' || raw === 'none') return raw
  } catch {
    /* ignore */
  }
  return '50-50'
}

export function savePaymentSchedule(id: PaymentScheduleId) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PAYMENT_KEY, id)
  } catch {
    /* ignore */
  }
}

export function loadPaymentCustomText(): string {
  if (typeof window === 'undefined') return ''
  try {
    return (localStorage.getItem(PAYMENT_CUSTOM_KEY) || '').slice(0, PAYMENT_CUSTOM_MAX_CHARS)
  } catch {
    return ''
  }
}

export function savePaymentCustomText(text: string) {
  if (typeof window === 'undefined') return
  try {
    const t = text.trim().slice(0, PAYMENT_CUSTOM_MAX_CHARS)
    if (!t) localStorage.removeItem(PAYMENT_CUSTOM_KEY)
    else localStorage.setItem(PAYMENT_CUSTOM_KEY, t)
  } catch {
    /* ignore */
  }
}

export function loadPaletteId(): PdfPaletteId {
  if (typeof window === 'undefined') return 'mono'
  try {
    const raw = localStorage.getItem(PALETTE_KEY)
    if (
      raw === 'mono' ||
      raw === 'forest' ||
      raw === 'navy' ||
      raw === 'walnut' ||
      raw === 'slate' ||
      raw === 'custom'
    ) {
      return raw
    }
  } catch {
    /* ignore */
  }
  return 'mono'
}

export function savePaletteId(id: PdfPaletteId) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PALETTE_KEY, id)
  } catch {
    /* ignore */
  }
}

export function loadAccentHex(): string {
  if (typeof window === 'undefined') return '#212121'
  try {
    const stored = normalizeAccentHex(localStorage.getItem(ACCENT_HEX_KEY) || '')
    if (stored) return stored
    const pid = loadPaletteId()
    if (pid !== 'custom') {
      const opt = PDF_PALETTE_OPTIONS.find(o => o.id === pid)
      if (opt) return opt.swatch
    }
  } catch {
    /* ignore */
  }
  return '#212121'
}

export function saveAccentHex(hex: string) {
  if (typeof window === 'undefined') return
  try {
    const normalized = normalizeAccentHex(hex)
    if (!normalized) return
    localStorage.setItem(ACCENT_HEX_KEY, normalized)
  } catch {
    /* ignore */
  }
}

export function loadShowVatNote(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = localStorage.getItem(VAT_NOTE_KEY)
    if (raw === null) return true
    return raw === '1' || raw === 'true'
  } catch {
    return true
  }
}

export function saveShowVatNote(on: boolean) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(VAT_NOTE_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function loadCustomerNotes(): string {
  if (typeof window === 'undefined') return ''
  try {
    return (sessionStorage.getItem(NOTES_KEY) || '').slice(0, NOTES_MAX_CHARS)
  } catch {
    return ''
  }
}

export function saveCustomerNotes(text: string) {
  if (typeof window === 'undefined') return
  try {
    const t = text.slice(0, NOTES_MAX_CHARS)
    if (!t.trim()) sessionStorage.removeItem(NOTES_KEY)
    else sessionStorage.setItem(NOTES_KEY, t)
  } catch {
    /* ignore */
  }
}

/** Client-side: file → data URL, max ~500 KB. */
export function readLogoFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) {
      reject(new Error('Csak PNG, JPG vagy WEBP kép tölthető fel'))
      return
    }
    if (file.size > 500 * 1024) {
      reject(new Error('A logo max. 500 KB lehet'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      if (!result.startsWith('data:image/') || result.length > LOGO_MAX_DATA_URL_CHARS) {
        reject(new Error('A kép túl nagy vagy érvénytelen'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error('Nem sikerült beolvasni a képet'))
    reader.readAsDataURL(file)
  })
}

export function emptyBuyer(): BuyerDraft {
  return {
    name: '',
    phone: '',
    email: '',
    postalCode: '',
    city: '',
    street: '',
    taxNumber: ''
  }
}

export function loadBuyer(): BuyerDraft {
  if (typeof window === 'undefined') return emptyBuyer()
  try {
    const raw = sessionStorage.getItem(BUYER_KEY)
    if (!raw) return emptyBuyer()
    return { ...emptyBuyer(), ...JSON.parse(raw) }
  } catch {
    return emptyBuyer()
  }
}

export function loadPreparedBy(fallback: string): string {
  if (typeof window === 'undefined') return fallback
  try {
    return sessionStorage.getItem(PREPARED_BY_KEY) || fallback
  } catch {
    return fallback
  }
}

export function newLine(partial?: Partial<ManualLineDraft>): ManualLineDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'other',
    title: '',
    quantity: '1',
    unit: 'db',
    unitPriceGross: '',
    ...partial
  }
}

export function formatFt(n: number) {
  return (
    new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(n)) + ' Ft'
  )
}

export function parseNum(value: string): number {
  return Number(String(value).replace(/\s/g, '').replace(',', '.')) || 0
}

export function applyRounding(n: number, roundTo: 0 | 100 | 1000): number {
  const rounded = Math.round(n)
  if (!roundTo) return rounded
  return Math.round(rounded / roundTo) * roundTo
}

export function defaultValidUntil(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function sellerDisplayName(seller: SellerProfile): string {
  return seller.billing_name || seller.name || ''
}

export function sellerAddressLine(seller: SellerProfile): string {
  return [
    seller.billing_postal_code,
    seller.billing_city,
    [seller.billing_street, seller.billing_house_number].filter(Boolean).join(' ')
  ]
    .filter(Boolean)
    .join(' ')
}

export function sellerFromPortalCustomer(c: Record<string, unknown> | null | undefined): SellerProfile {
  const str = (v: unknown) => (v == null ? '' : String(v))
  const logoRaw = str(c?.workshop_logo_data_url)
  const logo = logoRaw.startsWith('data:image/') ? logoRaw : ''
  return {
    name: str(c?.name),
    email: str(c?.email),
    mobile: str(c?.mobile),
    billing_name: str(c?.billing_name || c?.name),
    billing_postal_code: str(c?.billing_postal_code),
    billing_city: str(c?.billing_city),
    billing_street: str(c?.billing_street),
    billing_house_number: str(c?.billing_house_number),
    billing_tax_number: str(c?.billing_tax_number),
    workshop_logo_data_url: logo || undefined
  }
}
