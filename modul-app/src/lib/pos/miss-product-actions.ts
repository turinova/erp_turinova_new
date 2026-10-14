'use server'

import { revalidatePath } from 'next/cache'

import { allocateUniqueInternalEan13 } from '@/lib/barcodes/allocate-internal'
import {
  listAccessoryTaxOptions,
  listAccessoryUnitOptions
} from '@/lib/accessories/queries'
import { normalizeStoredBarcode } from '@/lib/pos/barcode'
import { getOrCreatePosSettings } from '@/lib/pos/settings'
import { resolveSellNetFromPricing } from '@/lib/pricing/margin'
import { getAccessoryOnHand } from '@/lib/stock/queries'
import type { SaleProductSearchItem } from '@/lib/sales/queries'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

const ACCESSORY_LIST = '/torzsadatok/alapanyagok/termekek'

export type PosMissTaxOption = {
  id: string
  name: string
  rate_percent: number
  is_default: boolean
}

export type PosMissUnitOption = {
  id: string
  name: string
  shortform: string
}

export type PosAssignSearchHit = {
  id: string
  name: string
  sku: string
  barcode: string | null
  barcode_internal: string | null
  sellable_pos: boolean
  price_net: number
  tax_rate_percent: number
  unit_shortform: string
}

function mapBarcodeDbError(message: string): string | null {
  if (
    message.includes('accessories_tenant_barcode_alive') ||
    (message.includes('duplicate key') && message.includes('barcode'))
  ) {
    return 'Ez a vonalkód már foglalt.'
  }
  if (message.includes('accessories_tenant_barcode_internal_alive')) {
    return 'Ez a belső vonalkód már foglalt.'
  }
  if (
    message.includes('accessories_tenant_sku_alive') ||
    (message.includes('duplicate key') && message.includes('sku'))
  ) {
    return 'A generált SKU foglalt — próbáld újra.'
  }
  return null
}

async function assertQuickCreateAllowed(
  supabase: Parameters<typeof getOrCreatePosSettings>[0],
  tenantId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const settings = await getOrCreatePosSettings(supabase, tenantId)
    if (settings.allow_pos_quick_create === false) {
      return {
        ok: false,
        message: 'A POS gyors felvétel ki van kapcsolva (Beállítások → Eladás).'
      }
    }
    return { ok: true }
  } catch (err) {
    // Migráció előtt: oszlop hiányzik → engedjük (default true)
    const msg = err instanceof Error ? err.message : ''
    if (/allow_pos_quick_create/i.test(msg)) return { ok: true }
    return {
      ok: false,
      message: msg || 'Nem sikerült ellenőrizni a POS beállításokat.'
    }
  }
}

async function resolveDefaults(
  supabase: Parameters<typeof listAccessoryTaxOptions>[0],
  tenantId: string,
  taxRateId?: string | null,
  unitId?: string | null
): Promise<
  | { ok: true; taxRateId: string; taxPct: number; unitId: string; unitShort: string }
  | { ok: false; message: string }
> {
  const [taxes, units] = await Promise.all([
    listAccessoryTaxOptions(supabase, tenantId),
    listAccessoryUnitOptions(supabase, tenantId)
  ])

  const tax =
    (taxRateId
      ? taxes.find((t) => t.id === taxRateId)
      : null) ??
    taxes.find((t) => t.is_default) ??
    taxes[0]
  if (!tax) {
    return {
      ok: false,
      message: 'Nincs adónem a cégben — Törzsadatok → Adónemek.'
    }
  }

  const unit =
    (unitId ? units.find((u) => u.id === unitId) : null) ??
    units.find((u) => u.shortform.toLowerCase() === 'db') ??
    units[0]
  if (!unit) {
    return {
      ok: false,
      message: 'Nincs mértékegység a cégben — Törzsadatok → Egységek.'
    }
  }

  return {
    ok: true,
    taxRateId: tax.id,
    taxPct: Number(tax.rate_percent) || 0,
    unitId: unit.id,
    unitShort: unit.shortform || 'db'
  }
}

function makeSku(barcode: string | null): string {
  const code = barcode?.trim()
  if (code && code.length <= 100) return code
  const stamp = Date.now().toString(36).toUpperCase()
  return `POS-${stamp}`
}

async function toSearchItem(
  supabase: Parameters<typeof getAccessoryOnHand>[0],
  tenantId: string,
  warehouseId: string,
  row: {
    id: string
    name: string
    sku: string
    price_net: number | string
    price_gross?: number | string | null
    tax_rate_percent: number
    unit_shortform: string
    image_url?: string | null
  }
): Promise<SaleProductSearchItem> {
  let onHand = 0
  try {
    onHand = await getAccessoryOnHand(
      supabase,
      tenantId,
      row.id,
      warehouseId
    )
  } catch {
    onHand = 0
  }
  const priceNet = Number(row.price_net) || 0
  const storedGross =
    row.price_gross != null && Number.isFinite(Number(row.price_gross))
      ? Math.round(Number(row.price_gross))
      : undefined
  return {
    kind: 'product',
    id: row.id,
    name: row.name,
    sku: row.sku,
    price_net: priceNet,
    ...(storedGross != null ? { price_gross: storedGross } : {}),
    tax_rate_percent: Number(row.tax_rate_percent) || 0,
    unit_shortform: row.unit_shortform || 'db',
    on_hand: onHand,
    image_url: row.image_url ?? null
  }
}

/** Egyedi belső EAN-13 (200…) — POS gyors felvétel / törzsadat gomb. */
export async function generatePosInternalBarcodeAction(): Promise<
  | { ok: true; barcode: string }
  | { ok: false; message: string }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  try {
    const barcode = await allocateUniqueInternalEan13(
      ctx.supabase,
      ctx.user.tenantId!
    )
    return { ok: true, barcode }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült vonalkódot generálni.'
    }
  }
}

export async function loadPosMissCreateDefaultsAction(): Promise<
  | {
      ok: true
      taxRates: PosMissTaxOption[]
      defaultTaxRateId: string
      units: PosMissUnitOption[]
      defaultUnitId: string
    }
  | { ok: false; message: string }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const allowed = await assertQuickCreateAllowed(
    ctx.supabase,
    ctx.user.tenantId!
  )
  if (!allowed.ok) return allowed

  try {
    const [taxes, units] = await Promise.all([
      listAccessoryTaxOptions(ctx.supabase, ctx.user.tenantId!),
      listAccessoryUnitOptions(ctx.supabase, ctx.user.tenantId!)
    ])
    if (taxes.length === 0) {
      return {
        ok: false,
        message: 'Nincs adónem a cégben — Törzsadatok → Adónemek.'
      }
    }
    if (units.length === 0) {
      return {
        ok: false,
        message: 'Nincs mértékegység a cégben — Törzsadatok → Egységek.'
      }
    }
    const defaultTax = taxes.find((t) => t.is_default) ?? taxes[0]!
    const defaultUnit =
      units.find((u) => u.shortform.toLowerCase() === 'db') ?? units[0]!
    return {
      ok: true,
      taxRates: taxes.map((t) => ({
        id: t.id,
        name: t.name,
        rate_percent: t.rate_percent,
        is_default: t.is_default
      })),
      defaultTaxRateId: defaultTax.id,
      units: units.map((u) => ({
        id: u.id,
        name: u.name,
        shortform: u.shortform
      })),
      defaultUnitId: defaultUnit.id
    }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült betölteni az alapértelmezéseket.'
    }
  }
}

export async function createPosQuickProductAction(input: {
  name: string
  /** Bruttó eladási ár — vagy leave null/NaN ha beszerzés×szorzóból jön. */
  unitPriceGross?: number | null
  sku?: string | null
  barcode?: string | null
  taxRateId?: string | null
  unitId?: string | null
  purchasePriceNet?: number | null
  marginFactor?: number | null
  warehouseId: string
}): Promise<
  | { ok: true; product: SaleProductSearchItem }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const allowed = await assertQuickCreateAllowed(
    ctx.supabase,
    ctx.user.tenantId!
  )
  if (!allowed.ok) return allowed

  const name = input.name?.trim() ?? ''
  if (!name) {
    return {
      ok: false,
      message: 'A termék neve kötelező.',
      fieldErrors: { name: 'A termék neve kötelező.' }
    }
  }
  if (name.length > 200) {
    return {
      ok: false,
      message: 'A név legfeljebb 200 karakter.',
      fieldErrors: { name: 'A név legfeljebb 200 karakter.' }
    }
  }

  const skuInput = input.sku?.trim() || null
  if (skuInput && skuInput.length > 100) {
    return {
      ok: false,
      message: 'A SKU legfeljebb 100 karakter.',
      fieldErrors: { sku: 'A SKU legfeljebb 100 karakter.' }
    }
  }

  let barcodeRaw = normalizeStoredBarcode(input.barcode)
  if (barcodeRaw && barcodeRaw.length > 64) {
    return {
      ok: false,
      message: 'A vonalkód legfeljebb 64 karakter.',
      fieldErrors: { barcode: 'A vonalkód legfeljebb 64 karakter.' }
    }
  }

  if (!input.warehouseId?.trim()) {
    return { ok: false, message: 'Válaszd ki a raktárat.' }
  }

  // Üres vonalkód → belső EAN-13 (POS / címke)
  if (!barcodeRaw) {
    try {
      barcodeRaw = normalizeStoredBarcode(
        await allocateUniqueInternalEan13(ctx.supabase, ctx.user.tenantId!)
      )
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Nem sikerült vonalkódot generálni.'
      }
    }
  }
  if (!barcodeRaw) {
    return { ok: false, message: 'Nem sikerült vonalkódot generálni.' }
  }

  const defaults = await resolveDefaults(
    ctx.supabase,
    ctx.user.tenantId!,
    input.taxRateId,
    input.unitId
  )
  if (!defaults.ok) return defaults

  let gross: number | null = null
  if (input.unitPriceGross != null) {
    const g = Math.round(Number(input.unitPriceGross))
    if (!Number.isFinite(g) || g < 0) {
      return {
        ok: false,
        message: 'Érvénytelen bruttó ár.',
        fieldErrors: { unitPriceGross: 'Érvénytelen bruttó ár.' }
      }
    }
    if (g > 99_999_999) {
      return {
        ok: false,
        message: 'A bruttó ár túl nagy.',
        fieldErrors: { unitPriceGross: 'A bruttó ár túl nagy.' }
      }
    }
    gross = g
  }

  const purchase =
    input.purchasePriceNet == null
      ? null
      : Math.round(Number(input.purchasePriceNet))
  const margin =
    input.marginFactor == null ? null : Number(input.marginFactor)

  if (purchase != null && (!Number.isFinite(purchase) || purchase < 0)) {
    return {
      ok: false,
      message: 'Érvénytelen beszerzési nettó.',
      fieldErrors: { purchasePriceNet: 'Érvénytelen beszerzési nettó.' }
    }
  }
  if (
    margin != null &&
    (!Number.isFinite(margin) || margin <= 0 || margin > 100)
  ) {
    return {
      ok: false,
      message: 'Érvényes árrés szorzót adj meg (pl. 1.35).',
      fieldErrors: { marginFactor: 'Érvényes szorzót adj meg (pl. 1.35).' }
    }
  }

  const priced = resolveSellNetFromPricing({
    priceGross: gross,
    purchasePriceNet: purchase,
    marginFactor: margin,
    vatPercent: defaults.taxPct
  })
  if (!priced.ok) {
    return {
      ok: false,
      message: priced.message,
      fieldErrors: {
        unitPriceGross: priced.message
      }
    }
  }

  let sku = skuInput || makeSku(barcodeRaw)

  // SKU ütközésnél fallback (barcode = SKU gyakori kis boltban)
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await ctx.supabase
      .from('accessories')
      .insert({
        tenant_id: ctx.user.tenantId!,
        name,
        sku,
        barcode: barcodeRaw,
        barcode_internal: null,
        tax_rate_id: defaults.taxRateId,
        unit_id: defaults.unitId,
        price_net: priced.priceNet,
        price_gross: gross,
        purchase_price_net: priced.purchasePriceNet,
        margin_factor: priced.marginFactor,
        image_url: null,
        active: true,
        sellable_pos: true,
        web_gallery: []
      })
      .select('id, name, sku, price_net, price_gross, image_url')
      .single()

    if (!error && data) {
      revalidatePath(ACCESSORY_LIST)
      const product = await toSearchItem(
        ctx.supabase,
        ctx.user.tenantId!,
        input.warehouseId,
        {
          id: data.id,
          name: data.name,
          sku: data.sku,
          price_net: data.price_net,
          price_gross: data.price_gross ?? gross,
          tax_rate_percent: defaults.taxPct,
          unit_shortform: defaults.unitShort,
          image_url: data.image_url
        }
      )
      return { ok: true, product }
    }

    if (error) {
      const skuClash =
        error.message.includes('accessories_tenant_sku_alive') ||
        (error.message.includes('duplicate key') &&
          error.message.includes('sku'))
      if (skuClash && attempt < 2 && !skuInput) {
        sku = `POS-${Date.now().toString(36).toUpperCase()}-${attempt + 1}`
        continue
      }
      const mapped = mapBarcodeDbError(error.message)
      if (skuClash && skuInput) {
        return {
          ok: false,
          message: 'Már van ilyen SKU ebben a cégben.',
          fieldErrors: { sku: 'Már van ilyen SKU ebben a cégben.' }
        }
      }
      return {
        ok: false,
        message: mapped ?? 'Nem sikerült létrehozni a terméket.',
        fieldErrors: mapped
          ? {
              [mapped.includes('SKU')
                ? 'sku'
                : mapped.includes('vonalkód')
                  ? 'barcode'
                  : 'barcode']: mapped
            }
          : undefined
      }
    }
  }

  return { ok: false, message: 'Nem sikerült létrehozni a terméket.' }
}

export async function searchPosAssignProductsAction(
  q: string,
  limit = 12
): Promise<
  | { ok: true; rows: PosAssignSearchHit[] }
  | { ok: false; message: string }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const allowed = await assertQuickCreateAllowed(
    ctx.supabase,
    ctx.user.tenantId!
  )
  if (!allowed.ok) return allowed

  const safe = q.trim().replace(/[%_,]/g, '')
  if (safe.length < 2) return { ok: true, rows: [] }

  const { data, error } = await ctx.supabase
    .from('accessories')
    .select(
      `
      id,
      name,
      sku,
      barcode,
      barcode_internal,
      sellable_pos,
      price_net,
      tax_rates ( rate_percent ),
      units ( shortform )
    `
    )
    .eq('tenant_id', ctx.user.tenantId!)
    .eq('active', true)
    .is('deleted_at', null)
    .or(
      `name.ilike.%${safe}%,sku.ilike.%${safe}%,barcode.ilike.%${safe}%,barcode_internal.ilike.%${safe}%`
    )
    .order('name', { ascending: true })
    .limit(Math.min(25, Math.max(1, limit)))

  if (error) {
    console.error('searchPosAssignProducts', error.message)
    return { ok: false, message: 'Nem sikerült keresni a termékek között.' }
  }

  const rows: PosAssignSearchHit[] = (data ?? []).map((row) => {
    const taxRates = row.tax_rates as
      | { rate_percent: number | string }
      | { rate_percent: number | string }[]
      | null
    const tax = Array.isArray(taxRates) ? taxRates[0] : taxRates
    const units = row.units as
      | { shortform: string }
      | { shortform: string }[]
      | null
    const unit = Array.isArray(units) ? units[0] : units
    return {
      id: row.id as string,
      name: row.name as string,
      sku: row.sku as string,
      barcode: (row.barcode as string | null) ?? null,
      barcode_internal: (row.barcode_internal as string | null) ?? null,
      sellable_pos: row.sellable_pos !== false,
      price_net: Number(row.price_net) || 0,
      tax_rate_percent: Number(tax?.rate_percent ?? 0),
      unit_shortform: unit?.shortform ?? 'db'
    }
  })

  return { ok: true, rows }
}

export async function assignPosBarcodeAction(input: {
  accessoryId: string
  barcode: string
  warehouseId: string
}): Promise<
  | { ok: true; product: SaleProductSearchItem; assignedAs: 'barcode' | 'barcode_internal' }
  | { ok: false; message: string }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const allowed = await assertQuickCreateAllowed(
    ctx.supabase,
    ctx.user.tenantId!
  )
  if (!allowed.ok) return allowed

  const accessoryId = input.accessoryId?.trim()
  const barcode = normalizeStoredBarcode(input.barcode)
  if (!accessoryId) return { ok: false, message: 'Hiányzó termék.' }
  if (!barcode) return { ok: false, message: 'Hiányzó vonalkód.' }
  if (barcode.length > 64) {
    return { ok: false, message: 'A vonalkód legfeljebb 64 karakter.' }
  }
  if (!input.warehouseId?.trim()) {
    return { ok: false, message: 'Válaszd ki a raktárat.' }
  }

  const { data: row, error: loadErr } = await ctx.supabase
    .from('accessories')
    .select(
      `
      id,
      name,
      sku,
      barcode,
      barcode_internal,
      price_net,
      price_gross,
      image_url,
      tax_rates ( rate_percent ),
      units ( shortform )
    `
    )
    .eq('id', accessoryId)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr) {
    console.error('assignPosBarcode load', loadErr.message)
    return { ok: false, message: 'Nem sikerült betölteni a terméket.' }
  }
  if (!row) return { ok: false, message: 'A termék nem található.' }

  const existingBarcode = normalizeStoredBarcode(
    row.barcode as string | null
  )
  const existingInternal = normalizeStoredBarcode(
    row.barcode_internal as string | null
  )

  if (existingBarcode === barcode || existingInternal === barcode) {
    // Már rajta van — csak POS-ra kapcsoljuk
    const { error: flagErr } = await ctx.supabase
      .from('accessories')
      .update({
        sellable_pos: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', accessoryId)
      .eq('tenant_id', ctx.user.tenantId!)

    if (flagErr) {
      console.error('assignPosBarcode flag', flagErr.message)
      return { ok: false, message: 'Nem sikerült POS-eladhatóvá tenni.' }
    }
  } else {
    let patch: Record<string, unknown>
    let assignedAs: 'barcode' | 'barcode_internal'

    if (!existingBarcode) {
      patch = { barcode, sellable_pos: true }
      assignedAs = 'barcode'
    } else if (!existingInternal) {
      patch = { barcode_internal: barcode, sellable_pos: true }
      assignedAs = 'barcode_internal'
    } else {
      return {
        ok: false,
        message:
          'Ennek a terméknek már van gyártói és belső vonalkódja. Szerkeszd a törzsadatban.'
      }
    }

    const { error: updErr } = await ctx.supabase
      .from('accessories')
      .update({
        ...patch,
        updated_at: new Date().toISOString()
      })
      .eq('id', accessoryId)
      .eq('tenant_id', ctx.user.tenantId!)

    if (updErr) {
      const mapped = mapBarcodeDbError(updErr.message)
      console.error('assignPosBarcode update', updErr.message)
      return {
        ok: false,
        message: mapped ?? 'Nem sikerült hozzárendelni a vonalkódot.'
      }
    }

    const taxRates = row.tax_rates as
      | { rate_percent: number | string }
      | { rate_percent: number | string }[]
      | null
    const tax = Array.isArray(taxRates) ? taxRates[0] : taxRates
    const units = row.units as
      | { shortform: string }
      | { shortform: string }[]
      | null
    const unit = Array.isArray(units) ? units[0] : units

    revalidatePath(ACCESSORY_LIST)
    revalidatePath(`${ACCESSORY_LIST}/${accessoryId}`)

    const product = await toSearchItem(
      ctx.supabase,
      ctx.user.tenantId!,
      input.warehouseId,
      {
        id: row.id as string,
        name: row.name as string,
        sku: row.sku as string,
        price_net: row.price_net as number | string,
        price_gross: row.price_gross as number | string | null,
        tax_rate_percent: Number(tax?.rate_percent ?? 0),
        unit_shortform: unit?.shortform ?? 'db',
        image_url: (row.image_url as string | null) ?? null
      }
    )
    return { ok: true, product, assignedAs }
  }

  const taxRates = row.tax_rates as
    | { rate_percent: number | string }
    | { rate_percent: number | string }[]
    | null
  const tax = Array.isArray(taxRates) ? taxRates[0] : taxRates
  const units = row.units as
    | { shortform: string }
    | { shortform: string }[]
    | null
  const unit = Array.isArray(units) ? units[0] : units

  revalidatePath(ACCESSORY_LIST)
  revalidatePath(`${ACCESSORY_LIST}/${accessoryId}`)

  const product = await toSearchItem(
    ctx.supabase,
    ctx.user.tenantId!,
    input.warehouseId,
    {
      id: row.id as string,
      name: row.name as string,
      sku: row.sku as string,
      price_net: row.price_net as number | string,
      price_gross: row.price_gross as number | string | null,
      tax_rate_percent: Number(tax?.rate_percent ?? 0),
      unit_shortform: unit?.shortform ?? 'db',
      image_url: (row.image_url as string | null) ?? null
    }
  )
  return {
    ok: true,
    product,
    assignedAs: existingBarcode === barcode ? 'barcode' : 'barcode_internal'
  }
}
