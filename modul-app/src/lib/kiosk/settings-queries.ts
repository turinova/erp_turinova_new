import type { SupabaseClient } from '@supabase/supabase-js'

import { parseEdgeTypeMap } from '@/lib/kiosk/edge-types'
import {
  DEFAULT_KIOSK_SETTINGS,
  isKioskCatalogMode,
  type KioskDeviceRow,
  type KioskEdgeOption,
  type KioskSettings,
  type KioskSheetOption
} from '@/lib/kiosk/settings-types'
import {
  formatEdgeMaterialLabel,
  listOptiEdgeMaterials,
  listOptiSheetMaterials
} from '@/lib/opti/queries'

type DbRow = {
  kiosk_enabled: boolean
  catalog_mode: string
  favorite_sheet_ids: string[] | null
  edge_type_map: unknown
  max_panel_rows: number
  max_qty_per_line: number
  idle_warn_sec: number
  idle_reset_sec: number
}

export function mapKioskSettings(row: DbRow): KioskSettings {
  const mode = isKioskCatalogMode(row.catalog_mode)
    ? row.catalog_mode
    : DEFAULT_KIOSK_SETTINGS.catalogMode

  return {
    enabled: Boolean(row.kiosk_enabled),
    catalogMode: mode,
    favoriteSheetIds: Array.isArray(row.favorite_sheet_ids)
      ? row.favorite_sheet_ids.filter((id) => typeof id === 'string' && id)
      : [],
    edgeTypeMap: parseEdgeTypeMap(row.edge_type_map),
    maxPanelRows: Number(row.max_panel_rows) || DEFAULT_KIOSK_SETTINGS.maxPanelRows,
    maxQtyPerLine:
      Number(row.max_qty_per_line) || DEFAULT_KIOSK_SETTINGS.maxQtyPerLine,
    idleWarnSec: Number(row.idle_warn_sec) || DEFAULT_KIOSK_SETTINGS.idleWarnSec,
    idleResetSec:
      Number(row.idle_reset_sec) || DEFAULT_KIOSK_SETTINGS.idleResetSec
  }
}

export function settingsToDbRow(tenantId: string, settings: KioskSettings) {
  return {
    tenant_id: tenantId,
    kiosk_enabled: settings.enabled,
    catalog_mode: settings.catalogMode,
    favorite_sheet_ids: settings.favoriteSheetIds,
    edge_type_map: settings.edgeTypeMap,
    max_panel_rows: settings.maxPanelRows,
    max_qty_per_line: settings.maxQtyPerLine,
    idle_warn_sec: settings.idleWarnSec,
    idle_reset_sec: settings.idleResetSec,
    updated_at: new Date().toISOString()
  }
}

export async function getKioskSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<KioskSettings | null> {
  const { data, error } = await supabase
    .from('tenant_kiosk_settings')
    .select(
      `
      kiosk_enabled,
      catalog_mode,
      favorite_sheet_ids,
      edge_type_map,
      max_panel_rows,
      max_qty_per_line,
      idle_warn_sec,
      idle_reset_sec
    `
    )
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    console.error('getKioskSettings', error.message)
    throw new Error('Nem sikerült betölteni a kiosk beállításokat.')
  }
  if (!data) return null
  return mapKioskSettings(data as DbRow)
}

export async function ensureKioskSettingsRow(
  supabase: SupabaseClient,
  tenantId: string
): Promise<KioskSettings> {
  const existing = await getKioskSettings(supabase, tenantId)
  if (existing) return existing

  const { error } = await supabase
    .from('tenant_kiosk_settings')
    .insert({ tenant_id: tenantId })

  if (error && error.code !== '23505') {
    console.error('ensureKioskSettingsRow', error.message)
    throw new Error('Nem sikerült létrehozni a kiosk beállításokat.')
  }

  const again = await getKioskSettings(supabase, tenantId)
  return again ?? { ...DEFAULT_KIOSK_SETTINGS }
}

export async function listKioskDevices(
  supabase: SupabaseClient,
  tenantId: string
): Promise<KioskDeviceRow[]> {
  const { data, error } = await supabase
    .from('kiosk_devices')
    .select('id, name, last_seen_at, revoked_at, created_at, token_hash')
    .eq('tenant_id', tenantId)
    .is('revoked_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('listKioskDevices', error.message)
    throw new Error('Nem sikerült betölteni a kiosk eszközöket.')
  }

  return (data ?? []).map((row) => {
    const r = row as {
      id: string
      name: string
      last_seen_at: string | null
      revoked_at: string | null
      created_at: string
      token_hash: string | null
    }
    return {
      id: r.id,
      name: r.name,
      lastSeenAt: r.last_seen_at,
      revokedAt: r.revoked_at,
      createdAt: r.created_at,
      hasToken: Boolean(r.token_hash)
    }
  })
}

export async function listKioskEdgeOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<KioskEdgeOption[]> {
  const edges = await listOptiEdgeMaterials(supabase, tenantId)
  return edges.map((e) => ({
    id: e.id,
    label: formatEdgeMaterialLabel(e)
  }))
}

export async function listKioskSheetOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<KioskSheetOption[]> {
  const sheets = await listOptiSheetMaterials(supabase, tenantId)
  return sheets.map((s) => ({
    id: s.id,
    name: s.name,
    thicknessMm: s.thickness_mm,
    onStock: s.on_stock,
    manufacturerName: s.manufacturer_name
  }))
}

export async function getTenantSlugAndName(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ slug: string; name: string } | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('slug, name')
    .eq('id', tenantId)
    .maybeSingle()

  if (error) {
    console.error('getTenantSlugAndName', error.message)
    return null
  }
  if (!data?.slug) return null
  return { slug: String(data.slug), name: String(data.name ?? '') }
}
