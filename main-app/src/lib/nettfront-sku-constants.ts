/** Shared Nettfront SKU labels / validation helpers */

export const NETTFRONT_FRONT_TYPES = [
  { value: 'inomat', label: 'Inomat' },
  { value: 'festett', label: 'Festett' },
  { value: 'folias', label: 'Fóliás' },
  { value: 'alu', label: 'Alu' },
  { value: 'akril', label: 'Akril' }
] as const

export const NETTFRONT_FINISHES = [
  { value: 'matt', label: 'Matt' },
  { value: 'hg', label: 'Fényes (HG)' }
] as const

export const NETTFRONT_VAT_RATE = 0.27

export type NettfrontSkuFormData = {
  id?: string
  front_type: string
  sku_code: string
  display_name: string
  finish: string | null
  swatch_hex: string | null
  cost_net_per_sqm: number
  sell_net_per_sqm: number
  is_active: boolean
  sort_order: number
}

export function frontTypeLabel(value: string): string {
  return NETTFRONT_FRONT_TYPES.find(t => t.value === value)?.label || value
}

export function finishLabel(value: string | null | undefined): string {
  if (!value) return '—'
  return NETTFRONT_FINISHES.find(f => f.value === value)?.label || value
}

export function sellGrossFromNet(sellNet: number): number {
  return Math.round(sellNet * (1 + NETTFRONT_VAT_RATE))
}

export function isValidHexColor(hex: string | null | undefined): boolean {
  if (!hex || !hex.trim()) return true
  return /^#[0-9A-Fa-f]{6}$/.test(hex.trim())
}
