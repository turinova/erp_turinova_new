export const DOCUMENT_KINDS = [
  'manual',
  'safety_data_sheet',
  'declaration_of_conformity',
  'datasheet',
  'warranty',
  'certificate',
  'other'
] as const

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  manual: 'Használati útmutató',
  safety_data_sheet: 'Biztonsági adatlap',
  declaration_of_conformity: 'Megfelelőségi nyilatkozat',
  datasheet: 'Műszaki adatlap',
  warranty: 'Jótállási jegy',
  certificate: 'Tanúsítvány',
  other: 'Egyéb dokumentum'
}

export const DOCUMENT_LANGUAGES: { code: string; label: string }[] = [
  { code: 'hu', label: 'Magyar' },
  { code: 'en', label: 'Angol' },
  { code: 'de', label: 'Német' },
  { code: 'sk', label: 'Szlovák' },
  { code: 'ro', label: 'Román' },
  { code: 'cs', label: 'Cseh' },
  { code: 'pl', label: 'Lengyel' },
  { code: 'hr', label: 'Horvát' },
  { code: 'sl', label: 'Szlovén' },
  { code: 'sr', label: 'Szerb' },
  { code: 'it', label: 'Olasz' },
  { code: 'fr', label: 'Francia' },
  { code: 'es', label: 'Spanyol' }
]

export const MAX_DOCUMENTS_PER_PRODUCT = 20

export const DOCUMENT_TITLE_MAX = 200

export function isDocumentKind(v: unknown): v is DocumentKind {
  return typeof v === 'string' && (DOCUMENT_KINDS as readonly string[]).includes(v)
}

export function documentLanguageLabel(code: string): string {
  return DOCUMENT_LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase()
}
