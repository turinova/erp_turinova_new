#!/usr/bin/env node
/**
 * POS search golden cases — compound / spaced / typo expectations.
 *
 * Usage (modul-app):
 *   node --env-file=.env.local scripts/golden-test-pos-search.mjs
 *
 * Optional: SPEED_TEST_TENANT_ID, SPEED_TEST_WAREHOUSE_ID
 * Optional seed name: GOLDEN_NAME="Korpusz összehúzó"
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

function compact(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '')
}

async function main() {
  let tenantId = process.env.SPEED_TEST_TENANT_ID || ''
  let warehouseId = process.env.SPEED_TEST_WAREHOUSE_ID || ''
  const wantName = process.env.GOLDEN_NAME || 'Korpusz összehúzó'

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

  const { data: product } = await admin
    .from('accessories')
    .select('id, name, sellable_pos, active')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .ilike('name', `%${wantName.split(/\s+/)[0]}%`)
    .limit(20)

  const target =
    (product ?? []).find(
      (p) => compact(p.name) === compact(wantName) || compact(p.name).includes(compact(wantName))
    ) ?? (product ?? [])[0]

  if (!target) {
    console.warn(
      `No product matching ~"${wantName}" — create one or set GOLDEN_NAME. Skipping assert.`
    )
    process.exit(0)
  }

  console.log('target:', target.id, target.name, {
    sellable_pos: target.sellable_pos,
    active: target.active
  })

  const queries = [
    wantName,
    wantName.replace(/\s+/g, ''),
    wantName.split(/\s+/).slice(-1)[0],
    wantName.split(/\s+/)[0]
  ].filter(Boolean)

  let failed = 0
  for (const q of queries) {
    const { data, error } = await admin.rpc('search_pos_products', {
      p_tenant_id: tenantId,
      p_warehouse_id: warehouseId,
      p_q: q,
      p_limit: 15,
      p_stock_first: true
    })
    if (error) {
      console.error('RPC error for', JSON.stringify(q), error.message)
      console.error('→ Run migration 20260596_search_pos_products_compact.sql')
      failed++
      continue
    }
    const hit = (data ?? []).some((r) => r.id === target.id)
    const names = (data ?? []).slice(0, 5).map((r) => r.name)
    console.log(
      hit ? 'OK ' : 'FAIL',
      JSON.stringify(q),
      '→',
      hit ? 'found' : 'missing',
      names
    )
    if (!hit) failed++
  }

  if (failed) {
    console.error(`\n${failed} golden case(s) failed`)
    process.exit(1)
  }
  console.log('\nAll golden cases passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
