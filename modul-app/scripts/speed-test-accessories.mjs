#!/usr/bin/env node
/**
 * Termék lista/kereső speed test (Hírös-skála).
 *
 * Usage:
 *   node --env-file=.env.local scripts/speed-test-accessories.mjs
 *   SPEED_TEST_TENANT_ID=... node --env-file=.env.local scripts/speed-test-accessories.mjs
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const TENANT =
  process.env.SPEED_TEST_TENANT_ID ||
  '45dd7c02-28e9-4f4a-b74c-704f63437927'

const TARGETS = {
  listWarmMs: 200,
  searchRareWarmMs: 200,
  rpcListWarmMs: 180,
  rpcSearchWarmMs: 220
}

function pct(sorted, p) {
  if (sorted.length === 0) return null
  const i = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  )
  return sorted[i]
}

async function timed(label, fn, runs = 5) {
  const samples = []
  const coldStart = performance.now()
  await fn()
  const coldMs = Math.round(performance.now() - coldStart)
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    await fn()
    samples.push(Math.round(performance.now() - t0))
  }
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    label,
    coldMs,
    warmMedianMs: pct(sorted, 50),
    warmP95Ms: pct(sorted, 95),
    samples
  }
}

function passFail(value, target) {
  if (value == null) return { ok: null, text: 'n/a' }
  const ok = value <= target
  return { ok, text: ok ? 'PASS' : 'FAIL' }
}

async function authedClient(admin, tenantId) {
  const { data: m, error: mErr } = await admin
    .from('tenant_memberships')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (mErr || !m) throw new Error(mErr?.message || 'no membership for RPC auth')

  const { data: uRes, error: uErr } = await admin.auth.admin.getUserById(
    m.user_id
  )
  if (uErr) throw uErr
  const email = uRes?.user?.email
  if (!email) throw new Error('no email for membership user')

  const { data: link, error: lErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email
  })
  if (lErr) throw lErr

  const tokenHash = link.properties?.hashed_token
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const { error: oErr } = await client.auth.verifyOtp({
    type: 'email',
    token_hash: tokenHash
  })
  if (oErr) throw oErr
  return client
}

async function main() {
  if (!URL || !SERVICE || !ANON) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or ANON key'
    )
    process.exit(1)
  }

  const admin = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  console.log('Tenant', TENANT)
  console.log('Targets', TARGETS)
  console.log('Auth…')
  const sb = await authedClient(admin, TENANT)
  console.log('OK\n')

  const results = []

  results.push(
    await timed('RPC list (empty q)', async () => {
      const { error } = await sb.rpc('search_accessories_page', {
        p_tenant_id: TENANT,
        p_q: '',
        p_limit: 25,
        p_offset: 0
      })
      if (error) throw new Error(error.message)
    })
  )

  results.push(
    await timed('RPC search common (riex)', async () => {
      const { error } = await sb.rpc('search_accessories_page', {
        p_tenant_id: TENANT,
        p_q: 'riex',
        p_limit: 25,
        p_offset: 0
      })
      if (error) throw new Error(error.message)
    })
  )

  results.push(
    await timed('RPC search rare (MIDILIGHT)', async () => {
      const { error } = await sb.rpc('search_accessories_page', {
        p_tenant_id: TENANT,
        p_q: 'MIDILIGHT',
        p_limit: 25,
        p_offset: 0
      })
      if (error) throw new Error(error.message)
    })
  )

  results.push(
    await timed('RPC search SKU prefix (F0001)', async () => {
      const { error } = await sb.rpc('search_accessories_page', {
        p_tenant_id: TENANT,
        p_q: 'F0001',
        p_limit: 25,
        p_offset: 0
      })
      if (error) throw new Error(error.message)
    })
  )

  results.push(
    await timed('PostgREST list lean 25', async () => {
      const { error } = await admin
        .from('accessories')
        .select(
          'id,name,sku,price_net,tax_rate_id,unit_id,image_url,active,manufacturers(name),tax_rates(rate_percent),units(shortform)'
        )
        .eq('tenant_id', TENANT)
        .is('deleted_at', null)
        .order('name')
        .order('id')
        .range(0, 24)
      if (error) throw new Error(error.message)
    })
  )

  console.log('Results:')
  console.log('-'.repeat(72))
  let failed = 0
  for (const r of results) {
    let target = null
    if (r.label.includes('RPC list')) target = TARGETS.rpcListWarmMs
    if (r.label.includes('common')) target = TARGETS.rpcSearchWarmMs
    if (r.label.includes('rare') || r.label.includes('SKU'))
      target = TARGETS.searchRareWarmMs
    if (r.label.includes('PostgREST')) target = TARGETS.listWarmMs

    const verdict =
      target == null
        ? { ok: null, text: 'info' }
        : passFail(r.warmMedianMs, target)
    if (verdict.ok === false) failed += 1

    console.log(
      `${verdict.text.padEnd(4)} ${r.label}\n` +
        `     cold=${r.coldMs}ms  warm_median=${r.warmMedianMs}ms  warm_p95=${r.warmP95Ms}ms` +
        (target != null ? `  target≤${target}ms` : '')
    )
  }

  console.log('-'.repeat(72))
  if (failed > 0) {
    console.log(`FAIL ${failed} check(s)`)
    process.exit(2)
  }
  console.log('All targeted checks PASS (or info-only)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
