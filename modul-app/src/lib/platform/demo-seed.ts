import { readFile } from 'fs/promises'
import path from 'path'

import type { SupabaseClient } from '@supabase/supabase-js'

import { TENANT_COMPANY_LOGOS_BUCKET } from '@/lib/company/logo-upload'
import { JELENLET_ADDON_KEY } from '@/lib/jelenlet/types'
import { LINEAR_MATERIALS_BUCKET } from '@/lib/linear-materials/image-upload'
import { TENANT_MEDIA_BUCKET } from '@/lib/media/types'
import { SHEET_MATERIALS_BUCKET } from '@/lib/sheet-materials/image-upload'

export type DemoSeedRpcResult = {
  ok?: boolean
  skipped?: boolean
  message?: string
}

const DEMO_DIR = path.join(process.cwd(), 'public/images/demo-seed')

async function uploadLocalJpeg(
  admin: SupabaseClient,
  bucket: string,
  storagePath: string,
  localFile: string
): Promise<string | null> {
  try {
    const buffer = await readFile(path.join(DEMO_DIR, localFile))
    const { error } = await admin.storage.from(bucket).upload(storagePath, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
      cacheControl: '3600'
    })
    if (error) {
      console.error('demo upload', bucket, storagePath, error.message)
      return null
    }
    const { data } = admin.storage.from(bucket).getPublicUrl(storagePath)
    return `${data.publicUrl}?v=${Date.now()}`
  } catch (err) {
    console.error('demo upload read', localFile, err)
    return null
  }
}

async function lookupIds(admin: SupabaseClient, tenantId: string) {
  const [
    { data: manufacturers },
    { data: tax },
    { data: equipment },
    { data: unit }
  ] = await Promise.all([
    admin
      .from('manufacturers')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    admin
      .from('tax_rates')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('rate_percent', 27)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('equipment')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', 'Korpus')
      .is('deleted_at', null)
      .maybeSingle(),
    admin
      .from('units')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('shortform', 'db')
      .is('deleted_at', null)
      .maybeSingle()
  ])

  const byName = (name: string) =>
    manufacturers?.find((m) => m.name.toLowerCase() === name.toLowerCase())
      ?.id ?? null

  return {
    egger: byName('Egger'),
    falco: byName('Falco'),
    kronospan: byName('Kronospan'),
    taxId: tax?.id ?? null,
    equipmentId: equipment?.id ?? null,
    unitId: unit?.id ?? null
  }
}

/** Optinova logo → tenant company logo (demó). */
export async function uploadDemoCompanyLogo(
  admin: SupabaseClient,
  tenantId: string
): Promise<{ ok: true; publicUrl: string } | { ok: false; message: string }> {
  try {
    const logoPath = path.join(
      process.cwd(),
      'public/images/optinova-logo.png'
    )
    const buffer = await readFile(logoPath)
    const storagePath = `${tenantId}/logo.png`

    const { error: uploadError } = await admin.storage
      .from(TENANT_COMPANY_LOGOS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'image/png',
        upsert: true,
        cacheControl: '3600'
      })

    if (uploadError) {
      console.error('uploadDemoCompanyLogo', uploadError.message)
      return {
        ok: false,
        message: 'A demó logo feltöltése sikertelen.'
      }
    }

    const { data } = admin.storage
      .from(TENANT_COMPANY_LOGOS_BUCKET)
      .getPublicUrl(storagePath)

    const publicUrl = `${data.publicUrl}?v=${Date.now()}`

    const { error: updateError } = await admin
      .from('tenant_companies')
      .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)

    if (updateError) {
      console.error('uploadDemoCompanyLogo update', updateError.message)
      return {
        ok: false,
        message: 'A logo URL mentése sikertelen.'
      }
    }

    return { ok: true, publicUrl }
  } catch (err) {
    console.error('uploadDemoCompanyLogo', err)
    return { ok: false, message: 'A demó logo nem érhető el a szerveren.' }
  }
}

/** Jelenlét addon bekapcsolása (ha van a katalógusban). */
export async function enableJelenletAddonForDemo(
  admin: SupabaseClient,
  tenantId: string,
  actorUserId: string
): Promise<void> {
  const { data: addon } = await admin
    .from('product_addons')
    .select('id, key')
    .eq('key', JELENLET_ADDON_KEY)
    .maybeSingle()

  if (!addon?.id) {
    console.warn('enableJelenletAddonForDemo: jelenlet addon missing')
    return
  }

  const { error } = await admin.from('tenant_addons').upsert(
    {
      tenant_id: tenantId,
      addon_id: addon.id,
      enabled_at: new Date().toISOString(),
      enabled_by: actorUserId
    },
    { onConflict: 'tenant_id,addon_id' }
  )

  if (error) {
    console.error('enableJelenletAddonForDemo upsert', error.message)
    return
  }

  try {
    const { materializeTenantEntitlements } = await import(
      '@/lib/platform/entitlements'
    )
    await materializeTenantEntitlements(admin, tenantId)
  } catch (e) {
    console.error('enableJelenletAddonForDemo materialize', e)
  }

  try {
    const { grantJelenletPageAccess } = await import(
      '@/lib/jelenlet/entitlement'
    )
    await grantJelenletPageAccess(admin, tenantId)
  } catch (e) {
    console.error('enableJelenletAddonForDemo grant', e)
  }
}

/**
 * Demó katalógus: tábla / él / szálas / termék + képek.
 * Idempotens (név / SKU szerint). Egy gomb a törzs seeddel.
 */
export async function seedDemoCatalog(
  admin: SupabaseClient,
  tenantId: string
): Promise<{ ok: true; skipped: boolean; message: string } | { ok: false; message: string }> {
  const ids = await lookupIds(admin, tenantId)
  if (!ids.taxId || !ids.equipmentId || !ids.unitId || !ids.egger) {
    return {
      ok: false,
      message:
        'Hiányzik a demó törzs (ÁFA / Korpus / Egger / db). Futtasd előbb a törzs seedet.'
    }
  }

  const { count: existingSku } = await admin
    .from('accessories')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('sku', 'ZSL-001')
    .is('deleted_at', null)

  if ((existingSku ?? 0) > 0) {
    return { ok: true, skipped: true, message: 'Már van demó katalógus.' }
  }

  const mfg = {
    egger: ids.egger,
    falco: ids.falco ?? ids.egger,
    kronospan: ids.kronospan ?? ids.egger
  }

  // --- Images ---
  const sheetU220 = await uploadLocalJpeg(
    admin,
    SHEET_MATERIALS_BUCKET,
    `${tenantId}/demo-u220.jpg`,
    'sheet-u220.jpg'
  )
  const sheetH1367 = await uploadLocalJpeg(
    admin,
    SHEET_MATERIALS_BUCKET,
    `${tenantId}/demo-h1367.jpg`,
    'sheet-h1367.jpg'
  )
  const linearF206 = await uploadLocalJpeg(
    admin,
    LINEAR_MATERIALS_BUCKET,
    `${tenantId}/demo-f206.jpg`,
    'linear-f206.jpg'
  )
  const linearH197 = await uploadLocalJpeg(
    admin,
    LINEAR_MATERIALS_BUCKET,
    `${tenantId}/demo-h197.jpg`,
    'linear-h197.jpg'
  )
  const prodFlash = await uploadLocalJpeg(
    admin,
    TENANT_MEDIA_BUCKET,
    `${tenantId}/demo-zseblampa.jpg`,
    'product-zseblampa.jpg'
  )
  const prodWand = await uploadLocalJpeg(
    admin,
    TENANT_MEDIA_BUCKET,
    `${tenantId}/demo-varazspalca.jpg`,
    'product-varazspalca.jpg'
  )
  const prodBin = await uploadLocalJpeg(
    admin,
    TENANT_MEDIA_BUCKET,
    `${tenantId}/demo-kuka.jpg`,
    'product-kuka.jpg'
  )

  // --- Sheets ---
  const { error: sheetErr } = await admin.from('sheet_materials').insert([
    {
      tenant_id: tenantId,
      manufacturer_id: mfg.egger,
      tax_rate_id: ids.taxId,
      equipment_id: ids.equipmentId,
      name: 'U220 ST9 Gyengéd Bézs',
      length_mm: 2800,
      width_mm: 2070,
      thickness_mm: 18,
      on_stock: true,
      active: true,
      image_url: sheetU220,
      trim_top_mm: 20,
      trim_right_mm: 20,
      trim_bottom_mm: 0,
      trim_left_mm: 0,
      kerf_mm: 3,
      waste_multi: 1.2,
      usage_limit: 0.65,
      grain_direction: false,
      rotatable: true,
      price_net: 15600,
      machine_code: 'U220',
      purchase_price_net: 12000,
      margin_factor: 1.3
    },
    {
      tenant_id: tenantId,
      manufacturer_id: mfg.egger,
      tax_rate_id: ids.taxId,
      equipment_id: ids.equipmentId,
      name: 'H1367 ST40 Casella Világos Natúr Tölgy',
      length_mm: 2800,
      width_mm: 2070,
      thickness_mm: 18,
      on_stock: true,
      active: true,
      image_url: sheetH1367,
      trim_top_mm: 20,
      trim_right_mm: 20,
      trim_bottom_mm: 0,
      trim_left_mm: 0,
      kerf_mm: 3,
      waste_multi: 1.2,
      usage_limit: 0.65,
      grain_direction: true,
      rotatable: false,
      price_net: 15000,
      machine_code: 'H1367',
      purchase_price_net: 10000,
      margin_factor: 1.5
    }
  ])
  if (sheetErr) {
    console.error('seedDemoCatalog sheets', sheetErr.message)
    return { ok: false, message: 'Táblás anyagok seed sikertelen.' }
  }

  // --- Edges ---
  const { error: edgeErr } = await admin.from('edge_materials').insert([
    {
      tenant_id: tenantId,
      manufacturer_id: mfg.egger,
      tax_rate_id: ids.taxId,
      equipment_id: ids.equipmentId,
      type: 'ABS',
      decor: 'U708',
      width_mm: 22,
      thickness_mm: 1,
      price_net: 315,
      allowance_mm: 50,
      active: true,
      machine_code: 'U708'
    },
    {
      tenant_id: tenantId,
      manufacturer_id: mfg.egger,
      tax_rate_id: ids.taxId,
      equipment_id: ids.equipmentId,
      type: 'ABS',
      decor: 'U115',
      width_mm: 22,
      thickness_mm: 2,
      price_net: 354,
      allowance_mm: 30,
      active: true,
      machine_code: 'U115'
    }
  ])
  if (edgeErr) {
    console.error('seedDemoCatalog edges', edgeErr.message)
    return { ok: false, message: 'Élzárók seed sikertelen.' }
  }

  // --- Linear ---
  const { error: linearErr } = await admin.from('linear_materials').insert([
    {
      tenant_id: tenantId,
      manufacturer_id: mfg.egger,
      tax_rate_id: ids.taxId,
      name: 'F206 PM Fekete Pietra Grigia',
      material_type: 'munkalap',
      length_mm: 4100,
      width_mm: 600,
      thickness_mm: 36,
      on_stock: true,
      active: true,
      image_url: linearF206,
      price_net: 12000,
      purchase_price_net: 10000,
      margin_factor: 1.2
    },
    {
      tenant_id: tenantId,
      manufacturer_id: mfg.egger,
      tax_rate_id: ids.taxId,
      name: 'H197 ST10 Natúr Vintage Wood',
      material_type: 'munkalap',
      length_mm: 4100,
      width_mm: 600,
      thickness_mm: 36,
      on_stock: true,
      active: true,
      image_url: linearH197,
      price_net: 24200,
      purchase_price_net: 22000,
      margin_factor: 1.1
    }
  ])
  if (linearErr) {
    console.error('seedDemoCatalog linear', linearErr.message)
    return { ok: false, message: 'Szálas anyagok seed sikertelen.' }
  }

  // --- Accessories / termékek ---
  const { error: accErr } = await admin.from('accessories').insert([
    {
      tenant_id: tenantId,
      manufacturer_id: mfg.falco,
      tax_rate_id: ids.taxId,
      unit_id: ids.unitId,
      name: 'Zseblámpa',
      sku: 'ZSL-001',
      barcode: '123456799',
      barcode_internal: '997654321',
      price_net: 5400,
      active: true,
      image_url: prodFlash,
      purchase_price_net: 4500,
      margin_factor: 1.2
    },
    {
      tenant_id: tenantId,
      manufacturer_id: mfg.egger,
      tax_rate_id: ids.taxId,
      unit_id: ids.unitId,
      name: 'Varázspálca',
      sku: 'VZS-001',
      barcode: '123456789',
      barcode_internal: '987654321',
      price_net: 4500,
      active: true,
      image_url: prodWand,
      purchase_price_net: 3000,
      margin_factor: 1.5
    },
    {
      tenant_id: tenantId,
      manufacturer_id: mfg.kronospan,
      tax_rate_id: ids.taxId,
      unit_id: ids.unitId,
      name: 'Hulladéktároló',
      sku: 'HT-001',
      barcode: '113456789',
      barcode_internal: '987654311',
      price_net: 15000,
      active: true,
      image_url: prodBin,
      purchase_price_net: 12500,
      margin_factor: 1.2
    }
  ])
  if (accErr) {
    console.error('seedDemoCatalog accessories', accErr.message)
    return { ok: false, message: 'Termékek seed sikertelen.' }
  }

  return { ok: true, skipped: false, message: 'Demó katalógus kész.' }
}

export async function tenantHasDemoMasterData(
  admin: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await admin.rpc('demo_master_has_data', {
    p_tenant_id: tenantId
  })
  if (error) {
    console.error('tenantHasDemoMasterData', error.message)
    return false
  }
  if (!data) return false

  const { count } = await admin
    .from('accessories')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('sku', 'ZSL-001')
    .is('deleted_at', null)

  return (count ?? 0) > 0
}
