import type { SupabaseClient } from '@supabase/supabase-js'

export type VariantGroupPrefs = {
  /** product_attributes.id vagy '__pack', sorrendben. Üres = automatikus. */
  axes: string[]
  mainAccessoryId: string | null
}

/** Változatcsoport beállítások (Bolt Excel „Változatcsoportok” lap). Hiányzó tábla / hiba → üres. */
export async function loadVariantGroupPrefs(
  admin: SupabaseClient,
  tenantId: string,
  codes: string[]
): Promise<Map<string, VariantGroupPrefs>> {
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))]
  const out = new Map<string, VariantGroupPrefs>()
  if (unique.length === 0) return out
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await admin
      .from('web_variant_groups')
      .select('code, axes, main_accessory_id')
      .eq('tenant_id', tenantId)
      .in('code', unique.slice(i, i + 200))
    if (error) {
      console.warn('loadVariantGroupPrefs', error.message)
      return out
    }
    for (const r of data ?? []) {
      out.set(String(r.code).toLowerCase(), {
        axes: Array.isArray(r.axes) ? (r.axes as string[]) : [],
        mainAccessoryId: (r.main_accessory_id as string | null) ?? null
      })
    }
  }
  return out
}
