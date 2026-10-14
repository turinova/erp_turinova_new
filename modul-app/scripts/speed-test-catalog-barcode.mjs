#!/usr/bin/env node
/**
 * Catalog barcode → ID path speed (kereső / termékek wedge).
 *
 * Measures:
 *   - DB exact accessory barcode .eq. lookup
 *   - DB accessory_stock_by_warehouse RPC vs unbounded movements select
 *   - optional HTTP /api/barcode-lookup + /termekek/[id] TTFB
 *
 * Usage (modul-app):
 *   node --env-file=.env.local scripts/speed-test-catalog-barcode.mjs
 *   SPEED_TEST_BASE_URL=http://localhost:3010 SPEED_TEST_EMAIL=... SPEED_TEST_PASSWORD=... \
 *     node --env-file=.env.local scripts/speed-test-catalog-barcode.mjs
 *
 * Targets:
 *   barcode .eq. warm ≤ 80 ms
 *   stock RPC warm ≤ 120 ms
 *   HTTP barcode-lookup warm ≤ 250 ms (lean auth)
 *   HTTP termek ID shell warm ≤ 900 ms (stock deferred)
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const BASE = process.env.SPEED_TEST_BASE_URL || ''
const EMAIL = process.env.SPEED_TEST_EMAIL || ''
const PASSWORD = process.env.SPEED_TEST_PASSWORD || ''

const TARGETS = {
  barcodeEqWarmMs: 80,
  stockRpcWarmMs: 120,
  httpBarcodeLookupWarmMs: 250,
  httpTermekIdWarmMs: 900
}

function ms(t0) {
  return Math.round(performance.now() - t0)
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
  const cold = ms(coldStart)
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    await fn()
    samples.push(ms(t0))
  }
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    label,
    coldMs: cold,
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

function barcodeExactOrFilter(safe) {
  const u = safe.toUpperCase()
  return [
    `barcode.eq.${u}`,
    `barcode_internal.eq.${u}`,
    `sku.eq.${u}`,
    `barcode.eq.${safe}`,
    `barcode_internal.eq.${safe}`,
    `sku.eq.${safe}`
  ].join(',')
}

async function main() {
  if (!URL || !SERVICE) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  console.log('=== catalog barcode → ID speed test ===\n')

  let tenantId = process.env.SPEED_TEST_TENANT_ID || ''
  if (!tenantId) {
    const { data } = await admin
      .from('tenant_memberships')
      .select('tenant_id')
      .limit(1)
      .maybeSingle()
    tenantId = data?.tenant_id
  }
  if (!tenantId) {
    console.error('No tenant. Set SPEED_TEST_TENANT_ID.')
    process.exit(1)
  }

  let barcode = process.env.SPEED_TEST_BARCODE || ''
  let accessoryId = process.env.SPEED_TEST_ACCESSORY_ID || ''
  if (!barcode || !accessoryId) {
    const { data: a } = await admin
      .from('accessories')
      .select('id, barcode, barcode_internal, sku, name')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .or('barcode.not.is.null,barcode_internal.not.is.null,sku.not.is.null')
      .limit(1)
      .maybeSingle()
    if (!a) {
      console.error('No sample accessory with barcode/sku')
      process.exit(1)
    }
    accessoryId = accessoryId || a.id
    barcode =
      barcode ||
      a.barcode ||
      a.barcode_internal ||
      a.sku
    console.log(`sample: ${a.name}`)
  }

  const code = String(barcode).trim().toUpperCase()
  console.log(`tenant=${tenantId}`)
  console.log(`code=${code}`)
  console.log(`accessory=${accessoryId}\n`)

  const results = []

  results.push(
    await timed('DB accessory barcode .eq. lookup', async () => {
      const { error } = await admin
        .from('accessories')
        .select('id, name, sku, barcode, barcode_internal')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .is('deleted_at', null)
        .or(barcodeExactOrFilter(code))
        .limit(5)
      if (error) throw error
    })
  )

  try {
    results.push(
      await timed('DB accessory_stock_by_warehouse RPC', async () => {
        const { error } = await admin.rpc('accessory_stock_by_warehouse', {
          p_tenant_id: tenantId,
          p_accessory_id: accessoryId
        })
        if (error) throw error
      })
    )
  } catch (err) {
    results.push({
      label: 'DB accessory_stock_by_warehouse RPC',
      coldMs: null,
      warmMedianMs: null,
      warmP95Ms: null,
      samples: [],
      note: `SKIP — apply 20260606 (${err?.message || err})`
    })
  }

  results.push(
    await timed(
      'DB stock_movements unbounded select (legacy balance shape)',
      async () => {
        const { error } = await admin
          .from('stock_movements')
          .select('quantity, movement_type, warehouse_id')
          .eq('tenant_id', tenantId)
          .eq('accessory_id', accessoryId)
        if (error) throw error
      }
    )
  )

  results.push(
    await timed(
      'DB warehouse×accessory_on_hand fallback (pre-20260606)',
      async () => {
        const { data: warehouses, error: whErr } = await admin
          .from('warehouses')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .is('deleted_at', null)
        if (whErr) throw whErr
        await Promise.all(
          (warehouses ?? []).map((w) =>
            admin.rpc('accessory_on_hand', {
              p_tenant_id: tenantId,
              p_accessory_id: accessoryId,
              p_warehouse_id: w.id
            })
          )
        )
      }
    )
  )

  results.push(
    await timed('DB getAccessory shell (no stock/shop)', async () => {
      const { error } = await admin
        .from('accessories')
        .select(
          `
          id, name, sku, barcode, barcode_internal, active,
          manufacturer_id, tax_rate_id, unit_id,
          price_net, price_gross, purchase_price_net, image_url
        `
        )
        .eq('tenant_id', tenantId)
        .eq('id', accessoryId)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) throw error
    })
  )

  if (BASE && EMAIL && PASSWORD && ANON) {
    const authClient = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
    const { data: signIn, error: signErr } =
      await authClient.auth.signInWithPassword({
        email: EMAIL,
        password: PASSWORD
      })
    if (signErr || !signIn.session) {
      console.warn('HTTP skip: login failed —', signErr?.message)
    } else {
      const projectRef = new URL(URL).hostname.split('.')[0]
      const authCookieName = `sb-${projectRef}-auth-token`
      const sessionPayload = encodeURIComponent(
        JSON.stringify({
          access_token: signIn.session.access_token,
          refresh_token: signIn.session.refresh_token,
          expires_at: signIn.session.expires_at,
          expires_in: signIn.session.expires_in,
          token_type: signIn.session.token_type,
          user: signIn.session.user
        })
      )
      const cookieHeader =
        process.env.SPEED_TEST_COOKIE ||
        `${authCookieName}=${sessionPayload}`

      async function httpJson(path) {
        const t0 = performance.now()
        const res = await fetch(`${BASE.replace(/\/$/, '')}${path}`, {
          headers: {
            Cookie: cookieHeader,
            Accept: 'application/json'
          },
          redirect: 'manual'
        })
        const timing = res.headers.get('server-timing') || ''
        await res.arrayBuffer()
        return { status: res.status, ms: ms(t0), timing }
      }

      async function httpHtml(path) {
        const t0 = performance.now()
        const res = await fetch(`${BASE.replace(/\/$/, '')}${path}`, {
          headers: {
            Cookie: cookieHeader,
            Accept: 'text/html'
          },
          redirect: 'manual'
        })
        await res.arrayBuffer()
        return { status: res.status, ms: ms(t0) }
      }

      const lookupPath = `/api/barcode-lookup?q=${encodeURIComponent(code)}`
      const lookupSamples = []
      let lookupCold = null
      let lastTiming = ''
      {
        const r = await httpJson(lookupPath)
        lookupCold = r
        lastTiming = r.timing
        for (let i = 0; i < 4; i++) {
          const w = await httpJson(lookupPath)
          lookupSamples.push(w.ms)
          lastTiming = w.timing || lastTiming
        }
      }
      results.push({
        label: 'HTTP /api/barcode-lookup',
        coldMs: lookupCold.ms,
        warmMedianMs: pct([...lookupSamples].sort((a, b) => a - b), 50),
        warmP95Ms: pct([...lookupSamples].sort((a, b) => a - b), 95),
        samples: lookupSamples,
        note: `status=${lookupCold.status} Server-Timing=${lastTiming || '(none)'}`
      })

      const idPath = `/torzsadatok/alapanyagok/termekek/${accessoryId}`
      const idSamples = []
      let idCold = null
      {
        const r = await httpHtml(idPath)
        idCold = r
        for (let i = 0; i < 4; i++) {
          idSamples.push((await httpHtml(idPath)).ms)
        }
      }
      results.push({
        label: 'HTTP /termekek/[id] TTFB',
        coldMs: idCold.ms,
        warmMedianMs: pct([...idSamples].sort((a, b) => a - b), 50),
        warmP95Ms: pct([...idSamples].sort((a, b) => a - b), 95),
        samples: idSamples,
        note: `status=${idCold.status} (3xx = cookie/session — use SPEED_TEST_COOKIE)`
      })
    }
  } else {
    console.log(
      'HTTP skipped (set SPEED_TEST_BASE_URL + SPEED_TEST_EMAIL + SPEED_TEST_PASSWORD).\n'
    )
  }

  console.log('Results:')
  console.log('-'.repeat(72))
  let failed = 0
  for (const r of results) {
    let target = null
    if (r.label.includes('barcode .eq.')) target = TARGETS.barcodeEqWarmMs
    if (r.label.includes('accessory_stock_by_warehouse'))
      target = TARGETS.stockRpcWarmMs
    if (r.label.includes('/api/barcode-lookup'))
      target = TARGETS.httpBarcodeLookupWarmMs
    if (r.label.includes('/termekek/[id]')) target = TARGETS.httpTermekIdWarmMs

    const verdict =
      r.warmMedianMs == null
        ? { ok: null, text: 'skip' }
        : target == null
          ? { ok: null, text: 'info' }
          : passFail(r.warmMedianMs, target)

    if (verdict.ok === false) failed += 1

    console.log(
      `${verdict.text.padEnd(4)} ${r.label}\n` +
        `     cold=${r.coldMs ?? 'n/a'}ms  warm_median=${r.warmMedianMs ?? 'n/a'}ms  warm_p95=${r.warmP95Ms ?? 'n/a'}ms` +
        (target != null ? `  target≤${target}ms` : '') +
        (r.note ? `\n     ${r.note}` : '')
    )
  }
  console.log('-'.repeat(72))
  console.log(
    failed === 0
      ? '\nAll gated targets PASS (or info-only).'
      : `\n${failed} target(s) FAILED.`
  )
  process.exit(failed === 0 ? 0 : 2)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
