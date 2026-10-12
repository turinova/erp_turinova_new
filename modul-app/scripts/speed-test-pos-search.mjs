#!/usr/bin/env node
/**
 * POS typeahead speed — legacy ILIKE vs search_pos_products RPC
 * (+ optional per-row on_hand simulation vs batch).
 *
 * Usage (modul-app):
 *   node --env-file=.env.local scripts/speed-test-pos-search.mjs
 *
 * Optional: SPEED_TEST_TENANT_ID, SPEED_TEST_WAREHOUSE_ID, SPEED_TEST_Q, ROUNDS
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const ROUNDS = Math.max(1, Math.min(20, Number(process.env.ROUNDS ?? '7') || 7))

function ms(t0) {
  return Math.round(performance.now() - t0)
}

async function time(label, fn, rounds = ROUNDS) {
  await fn() // warm
  const times = []
  for (let i = 0; i < rounds; i++) {
    const t0 = performance.now()
    await fn()
    times.push(ms(t0))
  }
  times.sort((a, b) => a - b)
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
  const p50 = times[Math.floor(times.length / 2)]
  const p95 =
    times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)]
  console.log(
    `${label}: avg=${avg}ms p50=${p50}ms p95=${p95}ms raw=[${times.join(',')}]`
  )
  return { label, avg, p50, p95, raw: times }
}

async function main() {
  let tenantId = process.env.SPEED_TEST_TENANT_ID || ''
  let warehouseId = process.env.SPEED_TEST_WAREHOUSE_ID || ''
  let q = (process.env.SPEED_TEST_Q || '').trim()

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

  if (!q) {
    const { data: a } = await admin
      .from('accessories')
      .select('name, sku')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()
    const name = (a?.name || a?.sku || 'csavar').trim()
    q = name.split(/\s+/)[0]?.slice(0, 8) || 'csavar'
    console.log('sample q:', JSON.stringify(q), 'from', a?.name)
  }

  if (!warehouseId) {
    console.error('Need warehouse')
    process.exit(1)
  }

  console.log('\n=== POS search speedtest ===')
  console.log(`q=${JSON.stringify(q)} rounds=${ROUNDS}\n`)

  const legacy = await time('A) legacy ILIKE + batch on_hand', async () => {
    const safe = q.replace(/[%_,]/g, '')
    const { data: rows, error } = await admin
      .from('accessories')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .or(
        `name.ilike.%${safe}%,sku.ilike.%${safe}%,barcode.ilike.%${safe}%,barcode_internal.ilike.%${safe}%`
      )
      .limit(30)
    if (error) throw new Error(error.message)
    const ids = (rows ?? []).map((r) => r.id)
    if (ids.length === 0) return { n: 0 }
    const { error: ohErr } = await admin.rpc('accessories_on_hand', {
      p_tenant_id: tenantId,
      p_warehouse_id: warehouseId,
      p_accessory_ids: ids
    })
    if (ohErr) throw new Error(ohErr.message)
    return { n: ids.length }
  })

  // Simulate OLD RPC cost: ILIKE candidates + N× accessory_on_hand (per row)
  const perRow = await time(
    'B) ILIKE + per-row accessory_on_hand (old RPC shape)',
    async () => {
      const safe = q.replace(/[%_,]/g, '')
      const { data: rows, error } = await admin
        .from('accessories')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .is('deleted_at', null)
        .or(
          `name.ilike.%${safe}%,sku.ilike.%${safe}%,barcode.ilike.%${safe}%,barcode_internal.ilike.%${safe}%`
        )
        .limit(15)
      if (error) throw new Error(error.message)
      const ids = (rows ?? []).map((r) => r.id)
      await Promise.all(
        ids.map((id) =>
          admin.rpc('accessory_on_hand', {
            p_tenant_id: tenantId,
            p_warehouse_id: warehouseId,
            p_accessory_id: id
          })
        )
      )
      return { n: ids.length }
    }
  )

  let rpc = null
  const { data: rpcProbe, error: rpcErr } = await admin.rpc(
    'search_pos_products',
    {
      p_tenant_id: tenantId,
      p_warehouse_id: warehouseId,
      p_q: q,
      p_limit: 15,
      p_stock_first: true
    }
  )
  if (rpcErr) {
    console.log(
      `C) search_pos_products RPC: SKIP (${rpcErr.message}) — run migrations 20260589–20260591`
    )
  } else {
    console.log(`C warm: ${Array.isArray(rpcProbe) ? rpcProbe.length : 0} hits`)
    rpc = await time('C) search_pos_products RPC (batch on_hand)', async () => {
      const { data, error } = await admin.rpc('search_pos_products', {
        p_tenant_id: tenantId,
        p_warehouse_id: warehouseId,
        p_q: q,
        p_limit: 15,
        p_stock_first: true
      })
      if (error) throw new Error(error.message)
      return { n: (data ?? []).length }
    })
  }

  console.log('\n=== delta ===')
  if (rpc) {
    const vsLegacy = legacy.p50 - rpc.p50
    const vsPerRow = perRow.p50 - rpc.p50
    const pctLegacy =
      legacy.p50 > 0 ? Math.round((vsLegacy / legacy.p50) * 100) : 0
    const pctPerRow =
      perRow.p50 > 0 ? Math.round((vsPerRow / perRow.p50) * 100) : 0
    console.log(
      `RPC vs legacy ILIKE: ${vsLegacy > 0 ? '-' : '+'}${Math.abs(vsLegacy)}ms p50 (${pctLegacy}% ${vsLegacy >= 0 ? 'faster' : 'slower'})`
    )
    console.log(
      `RPC vs per-row on_hand: ${vsPerRow > 0 ? '-' : '+'}${Math.abs(vsPerRow)}ms p50 (${pctPerRow}% ${vsPerRow >= 0 ? 'faster' : 'slower'})`
    )
    console.log(
      'UI path also drops Server Action POST overhead (GET /api/pos/search) + 45s LRU cache on repeat keys.'
    )
  } else {
    console.log('Apply 20260591_search_pos_products_fast.sql then re-run.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
