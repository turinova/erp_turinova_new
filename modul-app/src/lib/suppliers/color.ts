/** Beszállítói jelölőszínek — halvány háttér + erős sáv/pont. A szín sosem egyedüli jel (a név mindig kiírva). */
export const SUPPLIER_COLORS = {
  blue: { label: 'Kék', dot: '#3B82F6', soft: '#EFF6FF' },
  teal: { label: 'Türkiz', dot: '#14B8A6', soft: '#F0FDFA' },
  green: { label: 'Zöld', dot: '#22C55E', soft: '#F0FDF4' },
  lime: { label: 'Lime', dot: '#84CC16', soft: '#F7FEE7' },
  amber: { label: 'Borostyán', dot: '#F59E0B', soft: '#FFFBEB' },
  orange: { label: 'Narancs', dot: '#F97316', soft: '#FFF7ED' },
  rose: { label: 'Rózsa', dot: '#F43F5E', soft: '#FFF1F2' },
  pink: { label: 'Pink', dot: '#EC4899', soft: '#FDF2F8' },
  violet: { label: 'Lila', dot: '#8B5CF6', soft: '#F5F3FF' },
  slate: { label: 'Pala', dot: '#64748B', soft: '#F8FAFC' }
} as const

export type SupplierColorKey = keyof typeof SUPPLIER_COLORS
export const SUPPLIER_COLOR_KEYS = Object.keys(SUPPLIER_COLORS) as SupplierColorKey[]

export function isSupplierColorKey(v: unknown): v is SupplierColorKey {
  return typeof v === 'string' && v in SUPPLIER_COLORS
}

/** Kézzel beállított szín, különben az id-ből stabil hash (mindenhol ugyanaz). Beszállító nélkül: null. */
export function supplierColor(id: string | null, override?: string | null) {
  if (!id) return null
  if (isSupplierColorKey(override)) return SUPPLIER_COLORS[override]
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const keys = SUPPLIER_COLOR_KEYS.filter((k) => k !== 'slate')
  return SUPPLIER_COLORS[keys[Math.abs(h) % keys.length]!]
}
