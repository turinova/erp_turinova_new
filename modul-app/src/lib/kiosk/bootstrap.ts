import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  KioskBootstrapPayload,
  KioskBootstrapResult,
  KioskMappedEdge,
  KioskSheetCard
} from '@/lib/kiosk/bootstrap-types'
import { KIOSK_EDGE_TYPES, parseEdgeTypeMap } from '@/lib/kiosk/edge-types'
import {
  ensureKioskSettingsRow,
  getKioskSettings
} from '@/lib/kiosk/settings-queries'
import type { KioskCatalogMode } from '@/lib/kiosk/settings-types'
import { tenantHasLapszabaszat } from '@/lib/lapszabaszat/entitlement'
import {
  pickFeaturedSheets,
  listPopularSheetMaterialIds
} from '@/lib/kiosk/popular-sheets'
import {
  formatEdgeMaterialLabel,
  listOptiEdgeMaterials,
  listOptiSheetMaterials,
  type OptiEdgeMaterialOption,
  type OptiSheetMaterialOption
} from '@/lib/opti/queries'

function sheetSwatch(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  const hue = Math.abs(hash) % 360
  return `linear-gradient(145deg, hsl(${hue} 18% 72%), hsl(${hue} 22% 42%))`
}

function toSheetCard(s: OptiSheetMaterialOption): KioskSheetCard {
  const vat = s.vat_rate_percent / 100
  const gross = Math.round(s.price_net * (1 + vat))
  return {
    id: s.id,
    name: s.name,
    thicknessMm: s.thickness_mm,
    lengthMm: s.length_mm,
    widthMm: s.width_mm,
    onStock: s.on_stock,
    grainDirection: s.grain_direction,
    manufacturerName: s.manufacturer_name,
    machineCode: s.machine_code,
    imageUrl: s.image_url,
    swatch: sheetSwatch(s.id),
    pricePerSqmGross: gross,
    trimTopMm: s.trim_top_mm,
    trimRightMm: s.trim_right_mm,
    trimBottomMm: s.trim_bottom_mm,
    trimLeftMm: s.trim_left_mm
  }
}

function filterSheetsByCatalog(
  sheets: OptiSheetMaterialOption[],
  mode: KioskCatalogMode,
  favoriteIds: string[]
): OptiSheetMaterialOption[] {
  const fav = new Set(favoriteIds)
  switch (mode) {
    case 'stock_only':
      return sheets.filter((s) => s.on_stock)
    case 'favorites':
      return sheets.filter((s) => fav.has(s.id))
    case 'stock_and_favorites':
      return sheets.filter((s) => s.on_stock || fav.has(s.id))
    case 'all':
    default:
      return sheets
  }
}

function buildMappedEdges(
  edgeMap: ReturnType<typeof parseEdgeTypeMap>,
  edgeMaterials: OptiEdgeMaterialOption[]
): KioskMappedEdge[] {
  const byId = new Map(edgeMaterials.map((e) => [e.id, e]))
  const out: KioskMappedEdge[] = []
  for (const type of KIOSK_EDGE_TYPES) {
    const materialId = edgeMap[type.id]
    if (!materialId) continue
    const material = byId.get(materialId)
    if (!material) continue
    out.push({
      typeId: type.id,
      name: type.name,
      shortLabel: type.shortLabel,
      color: type.color,
      requiresDuplung: type.requiresDuplung,
      edgeMaterialId: material.id,
      edgeMaterialLabel: formatEdgeMaterialLabel(material)
    })
  }
  return out
}

/** Publikus kiosk bootstrap — service role client. */
export async function loadKioskBootstrap(
  admin: SupabaseClient,
  slugRaw: string
): Promise<KioskBootstrapResult> {
  const slug = decodeURIComponent(slugRaw).trim().toLowerCase()
  if (!slug) {
    return { ok: false, code: 'not_found', message: 'Ismeretlen kiosk cím.' }
  }

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id, name, slug, status')
    .eq('slug', slug)
    .maybeSingle()

  if (tenantError) {
    console.error('loadKioskBootstrap tenant', tenantError.message)
    return {
      ok: false,
      code: 'config',
      message: 'Nem sikerült betölteni a boltot.'
    }
  }
  if (!tenant?.id) {
    return { ok: false, code: 'not_found', message: 'Ez a kiosk nem található.' }
  }
  if (tenant.status && tenant.status !== 'active') {
    return {
      ok: false,
      code: 'disabled',
      message: 'Ez a bolt jelenleg nem érhető el.'
    }
  }

  const tenantId = tenant.id as string

  if (!(await tenantHasLapszabaszat(admin, tenantId))) {
    return {
      ok: false,
      code: 'no_lapszabaszat',
      message: 'A lapszabászat nincs bekapcsolva ennél a boltnál.'
    }
  }

  let settings
  try {
    settings = await ensureKioskSettingsRow(admin, tenantId)
  } catch (err) {
    // Tábla még nincs (migráció előtt)
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('tenant_kiosk_settings') || msg.includes('schema cache')) {
      return {
        ok: false,
        code: 'config',
        message:
          'A kiosk beállítások tábla hiányzik. Futtasd a 20261020 migrációt.'
      }
    }
    try {
      settings = await getKioskSettings(admin, tenantId)
    } catch {
      return {
        ok: false,
        code: 'config',
        message: 'Nem sikerült betölteni a kiosk beállításokat.'
      }
    }
    if (!settings) {
      return {
        ok: false,
        code: 'config',
        message: 'Nincs kiosk beállítás ehhez a bolthoz.'
      }
    }
  }

  if (!settings.enabled) {
    return {
      ok: false,
      code: 'disabled',
      message: 'A kiosk ki van kapcsolva. Kapcsold be a Beállítások → Kiosk oldalon.'
    }
  }

  const [allSheets, allEdges, company, popularIds] = await Promise.all([
    listOptiSheetMaterials(admin, tenantId),
    listOptiEdgeMaterials(admin, tenantId),
    admin
      .from('tenant_companies')
      .select('logo_url, name')
      .eq('tenant_id', tenantId)
      .maybeSingle()
      .then((r) => r.data),
    listPopularSheetMaterialIds(admin, tenantId, { limit: 40 })
  ])

  const filtered = filterSheetsByCatalog(
    allSheets,
    settings.catalogMode,
    settings.favoriteSheetIds
  )
  const sheetCards = filtered.map(toSheetCard)
  const featuredSheets = pickFeaturedSheets(sheetCards, popularIds, 8)
  const edges = buildMappedEdges(settings.edgeTypeMap, allEdges)

  const payload: KioskBootstrapPayload = {
    tenant: {
      id: tenantId,
      slug: String(tenant.slug),
      name: String(
        (company as { name?: string } | null)?.name || tenant.name || slug
      ),
      logoUrl:
        ((company as { logo_url?: string | null } | null)?.logo_url as
          | string
          | null) ?? null
    },
    settings: {
      enabled: settings.enabled,
      catalogMode: settings.catalogMode,
      maxPanelRows: settings.maxPanelRows,
      maxQtyPerLine: settings.maxQtyPerLine,
      idleWarnSec: settings.idleWarnSec,
      idleResetSec: settings.idleResetSec
    },
    sheets: sheetCards,
    featuredSheets,
    edges
  }

  return { ok: true, data: payload }
}
