/**
 * Táblás anyag — ugyanaz a séma, mint a `getAllMaterials()` (`@/lib/supabase-server`) visszatérése.
 * Opti `/opti` oldal „Táblás anyag” mezőjének adatai számításokhoz (ár, vágás, stb.).
 */
export type FronttervezoBoardMaterial = {
  id: string
  name: string
  brand_name: string
  material_name: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  grain_direction: boolean
  on_stock: boolean
  active: boolean
  image_url?: string | null
  kerf_mm: number
  trim_top_mm: number
  trim_right_mm: number
  trim_bottom_mm: number
  trim_left_mm: number
  rotatable: boolean
  waste_multi: number
  usage_limit: number
  base_price: number
  multiplier: number
  price_per_sqm: number
  partner_name: string | null
  unit_name: string | null
  unit_shortform: string | null
  vat_percent: number
  created_at: string
  updated_at: string
}

export type PanthelyConfig = {
  oldal: 'hosszu' | 'rovid'
  mennyiseg: number
  tavolsagokAlulMm: number[]
}
