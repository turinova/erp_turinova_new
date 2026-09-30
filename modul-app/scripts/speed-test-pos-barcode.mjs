#!/usr/bin/env node
/**
 * POS barcode lookup speed — old path vs RPC path.
 *
 * Usage (modul-app):
 *   node --env-file=.env.local scripts/speed-test-pos-barcode.mjs
 *
 * Optional: SPEED_TEST_TENANT_ID, SPEED_TEST_WAREHOUSE_ID, SPEED_TEST_BARCODE
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false }
})

function ms(t0) {
  return Math.round(performance.now() - t0)
}

async function time(label, fn, rounds = 5) {
  const times = []
  // warm
  await fn()
  for (let i = 0; i < rounds; i++) {
    const t0 = performance.now()
    await fn()
    times.push(ms(t0))
  }
  times.sort((a, b) => a - b)
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
  const p50 = times[Math.floor(times.length / 2)]
  const p95 = times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)]
  console.log(`${label}: avg=${avg}ms p50=${p50}ms p95=${p95}ms raw=[${times.join(',')}]`)
  return { avg, p50, p95 }
}

function normalizeScannerBarcode(raw) {
  const WEDGE = { ö: '0', Ö: '0', ü: '-', Ü: '-' }
  let remapped = raw
    .normalize('NFC')
    .split('')
    .map((ch) => WEDGE[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/o\u0308/gi, '0')
    .replace(/u\u0308/gi, '-')
    .normalize('NFC')
  remapped = remapped.replace(/[^\x20-\x7E]/g, '').trim()
  return remapped
}

async function main() {
  let tenantId = process.env.SPEED_TEST_TENANT_ID || ''
  let warehouseId = process.env.SPEED_TEST_WAREHOUSE_ID || ''
  let barcode = process.env.SPEED_TEST_BARCODE || ''

  if (!tenantId) {
    const { data: t } = await admin
      .from('tenants')
      .select('id, name')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    tenantId = t?.id
    console.log('tenant:', t?.name, tenantId)
  }
  if (!tenantId) {
    console.error('No tenant')
    process.exit(1)
  }

  if (!warehouseId) {
    const { data: w } = await admin
      .from('warehouses')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle()
    warehouseId = w?.id
    console.log('warehouse:', w?.name, warehouseId)
  }

  if (!barcode) {
    const { data: a } = await admin
      .from('accessories')
      .select('id, barcode, sku, name')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .not('barcode', 'is', null)
      .limit(1)
      .maybeSingle()
    barcode = a?.barcode || a?.sku
    console.log('sample product:', a?.name, 'code=', barcode, 'id=', a?.id)
  }

  if (!warehouseId || !barcode) {
    console.error('Need warehouse + barcode sample')
    process.exit(1)
  }

  const code = normalizeScannerBarcode(barcode)
  const huSim = code.replace(/0/g, 'ö')
  console.log('code:', code, '| HU-sim:', huSim, '→', normalizeScannerBarcode(huSim))

  console.log('\n=== OLD PATH: accessories query + stock_movements sum ===')
  const old = await time('old', async () => {
    const safe = code.replace(/[%_,]/g, '')
    const { data: rows } = await admin
      .from('accessories')
      .select(
        'id, name, sku, price_net, barcode, barcode_internal, image_url, tax_rates(rate_percent), units(shortform)'
      )
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .or(`barcode.eq.${safe},barcode_internal.eq.${safe},sku.eq.${safe}`)
      .limit(5)
    const row = rows?.[0]
    if (!row) return
    const { data: mov } = await admin
      .from('stock_movements')
      .select('quantity, movement_type')
      .eq('tenant_id', tenantId)
      .eq('accessory_id', row.id)
      .eq('warehouse_id', warehouseId)
    let total = 0
    for (const m of mov ?? []) {
      const q = Number(m.quantity)
      if (m.movement_type === 'in') total += q
      else if (m.movement_type === 'out') total -= q
    }
    void total
  })

  console.log('\n=== HYBRID: accessories + accessory_on_hand RPC (partial fix) ===')
  const hybrid = await time('hybrid', async () => {
    const safe = code.replace(/[%_,]/g, '')
    const { data: rows } = await admin
      .from('accessories')
      .select(
        'id, name, sku, price_net, barcode, barcode_internal, image_url, tax_rates(rate_percent), units(shortform)'
      )
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .or(`barcode.eq.${safe},barcode_internal.eq.${safe},sku.eq.${safe}`)
      .limit(5)
    const row = rows?.[0]
    if (!row) return
    await admin.rpc('accessory_on_hand', {
      p_tenant_id: tenantId,
      p_accessory_id: row.id,
      p_warehouse_id: warehouseId
    })
  })

  console.log('\n=== NEW PATH: lookup_pos_barcode RPC ===')
  let rpcOk = true
  const neu = await time('rpc', async () => {
    const { data, error } = await admin.rpc('lookup_pos_barcode', {
      p_tenant_id: tenantId,
      p_code: code,
      p_warehouse_id: warehouseId
    })
    if (error) {
      rpcOk = false
      throw new Error(error.message)
    }
    void data
  }).catch((e) => {
    console.error('RPC failed — run migration 20260570:', e.message)
    return null
  })

  console.log('\n=== accessory_on_hand RPC alone ===')
  const { data: acc } = await admin
    .from('accessories')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('barcode', code)
    .maybeSingle()
  if (acc?.id) {
    await time('on_hand_rpc', async () => {
      await admin.rpc('accessory_on_hand', {
        p_tenant_id: tenantId,
        p_accessory_id: acc.id,
        p_warehouse_id: warehouseId
      })
    })
  }

  console.log('\n--- summary ---')
  const improveHybrid =
    old.p50 > 0 ? Math.round((1 - hybrid.p50 / old.p50) * 100) : 0
  console.log(
    `OLD→HYBRID p50: ${old.p50}ms → ${hybrid.p50}ms (${improveHybrid}% faster), p95: ${old.p95}ms → ${hybrid.p95}ms`
  )
  if (neu && rpcOk) {
    const improve = old.p50 > 0 ? Math.round((1 - neu.p50 / old.p50) * 100) : 0
    console.log(
      `OLD→RPC   p50: ${old.p50}ms → ${neu.p50}ms (${improve}% faster), p95: ${old.p95}ms → ${neu.p95}ms`
    )
  } else {
    console.log(
      'Full lookup_pos_barcode RPC: futtasd a 20260570_lookup_pos_barcode.sql-t a Modul Supabase SQL editorben, majd: npm run speed-test:pos-barcode'
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
