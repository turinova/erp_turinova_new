#!/usr/bin/env node
/**
 * modul-app speed test — DB query path + optional HTTP TTFB.
 *
 * Usage:
 *   node --env-file=.env.local scripts/speed-test.mjs
 *   SPEED_TEST_BASE_URL=http://localhost:3010 SPEED_TEST_EMAIL=... SPEED_TEST_PASSWORD=... node --env-file=.env.local scripts/speed-test.mjs
 *
 * Targets (docs/05 + perf plan):
 *   DB listOrders (warm)     < 300 ms
 *   DB getQuoteDetail (warm) < 400 ms
 *   HTTP TTFB orders (warm)  < 800 ms  (auth + RSC; skeleton earlier)
 *   HTTP TTFB quote (warm)   < 900 ms
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const BASE = process.env.SPEED_TEST_BASE_URL || ''
const EMAIL = process.env.SPEED_TEST_EMAIL || ''
const PASSWORD = process.env.SPEED_TEST_PASSWORD || ''
const QUOTE_ID = process.env.SPEED_TEST_QUOTE_ID || ''
const TENANT_ID = process.env.SPEED_TEST_TENANT_ID || ''

const TARGETS = {
  listOrdersWarmMs: 300,
  quoteDetailWarmMs: 400,
  httpOrdersWarmMs: 800,
  httpQuoteWarmMs: 900
}

function ms(start) {
  return Math.round(performance.now() - start)
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
  // cold
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

function passFail(value, target, higherIsWorse = true) {
  if (value == null) return { ok: null, text: 'n/a' }
  const ok = higherIsWorse ? value <= target : value >= target
  return { ok, text: ok ? 'PASS' : 'FAIL' }
}

async function main() {
  if (!URL || !SERVICE) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  console.log('=== modul-app speed test ===\n')

  // Resolve tenant + quote
  let tenantId = TENANT_ID
  if (!tenantId) {
    const { data } = await admin
      .from('tenant_memberships')
      .select('tenant_id')
      .limit(1)
      .maybeSingle()
    tenantId = data?.tenant_id
  }
  if (!tenantId) {
    console.error('No tenant found. Set SPEED_TEST_TENANT_ID.')
    process.exit(1)
  }

  let quoteId = QUOTE_ID
  if (!quoteId) {
    const { data } = await admin
      .from('quotes')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    quoteId = data?.id
  }

  console.log(`tenant=${tenantId}`)
  console.log(`quote=${quoteId || '(none)'}\n`)

  const results = []

  // --- listOrders-shaped query (estimated count + joins) ---
  results.push(
    await timed('DB listOrders-shaped', async () => {
      const { error } = await admin
        .from('quotes')
        .select(
          `
          id, quote_number, order_number, status, payment_status, project_name,
          total_gross, currency, updated_at, production_machine_id, production_date, barcode,
          customers ( name, email, mobile ),
          production_machines ( name )
        `,
          { count: 'estimated' }
        )
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .not('order_number', 'is', null)
        .eq('status', 'in_production')
        .order('updated_at', { ascending: false })
        .range(0, 24)
      if (error) throw error
    })
  )

  if (quoteId) {
    results.push(
      await timed('DB getQuoteDetail-shaped', async () => {
        const quoteQ = admin
          .from('quotes')
          .select(
            `
            id, quote_number, order_number, status, payment_status, source,
            pricing_mode, currency, total_net, total_vat, total_gross, comment,
            project_name, created_at, updated_at, production_machine_id,
            production_date, barcode, portal_submitted_at,
            production_machines ( name ),
            customers (
              id, name, email, mobile, billing_name, billing_country,
              billing_city, billing_postal_code, billing_street,
              billing_house_number, billing_tax_number, billing_company_reg_number
            ),
            quote_panels (
              id, sheet_material_id, grain_mm, cross_mm, quantity, label, sort_index,
              sheet_materials ( name, machine_code ),
              edge_a:edge_materials!quote_panels_edge_a_id_fkey ( machine_code ),
              edge_b:edge_materials!quote_panels_edge_b_id_fkey ( machine_code ),
              edge_c:edge_materials!quote_panels_edge_c_id_fkey ( machine_code ),
              edge_d:edge_materials!quote_panels_edge_d_id_fkey ( machine_code )
            ),
            quote_material_lines (
              id, material_name, pricing_method, boards_charged, charged_sqm,
              waste_multi, board_grain_mm, board_cross_mm, material_net, material_gross,
              edge_length_m, edge_net, edge_gross, cutting_length_m, cutting_net,
              cutting_gross, total_gross,
              quote_edge_lines ( edge_name, length_m, gross_price )
            )
          `
          )
          .eq('tenant_id', tenantId)
          .eq('id', quoteId)
          .is('deleted_at', null)
          .maybeSingle()

        const payQ = admin
          .from('quote_payments')
          .select('id, amount, payment_method_name, comment, payment_date')
          .eq('quote_id', quoteId)
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('payment_date', { ascending: true })

        const [q, p] = await Promise.all([quoteQ, payQ])
        if (q.error) throw q.error
        if (p.error) throw p.error
      })
    )

    // Session waterfall simulation (memberships + entitlements + page_access + platform)
    results.push(
      await timed('DB session-parallel bundle', async () => {
        const { data: membership } = await admin
          .from('tenant_memberships')
          .select('id, role')
          .eq('tenant_id', tenantId)
          .limit(1)
          .maybeSingle()
        if (!membership) return
        await Promise.all([
          admin
            .from('tenant_entitlements')
            .select('feature_key, product_features(page_key)')
            .eq('tenant_id', tenantId),
          admin
            .from('tenant_membership_page_access')
            .select('page_key, can_access')
            .eq('membership_id', membership.id)
            .eq('can_access', true),
          admin
            .from('platform_admins')
            .select('user_id')
            .limit(1)
            .maybeSingle()
        ])
      })
    )
  }

  // --- optional HTTP TTFB ---
  if (BASE && EMAIL && PASSWORD && ANON) {
    const authClient = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
    const { data: signIn, error: signErr } =
      await authClient.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
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

      async function httpTtfb(path) {
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

      const orderSamples = []
      let orderCold = null
      {
        const r = await httpTtfb('/megrendelesek?status=in_production&page=1')
        orderCold = r
        for (let i = 0; i < 4; i++) {
          orderSamples.push(
            (await httpTtfb('/megrendelesek?status=in_production&page=1')).ms
          )
        }
      }
      results.push({
        label: 'HTTP /megrendelesek TTFB',
        coldMs: orderCold.ms,
        warmMedianMs: pct([...orderSamples].sort((a, b) => a - b), 50),
        warmP95Ms: pct([...orderSamples].sort((a, b) => a - b), 95),
        samples: orderSamples,
        note: `status=${orderCold.status} (3xx = cookie/session nonce missing — use SPEED_TEST_COOKIE from browser)`
      })

      if (quoteId) {
        const quoteSamples = []
        let quoteCold = null
        {
          const r = await httpTtfb(`/ajanlatok/${quoteId}`)
          quoteCold = r
          for (let i = 0; i < 4; i++) {
            quoteSamples.push((await httpTtfb(`/ajanlatok/${quoteId}`)).ms)
          }
        }
        results.push({
          label: 'HTTP /ajanlatok/[id] TTFB',
          coldMs: quoteCold.ms,
          warmMedianMs: pct([...quoteSamples].sort((a, b) => a - b), 50),
          warmP95Ms: pct([...quoteSamples].sort((a, b) => a - b), 95),
          samples: quoteSamples,
          note: `status=${quoteCold.status}`
        })
      }
    }
  } else {
    console.log(
      'HTTP TTFB skipped (set SPEED_TEST_BASE_URL + SPEED_TEST_EMAIL + SPEED_TEST_PASSWORD).\n' +
        'Tip: after browser login, SPEED_TEST_COOKIE="..." is more reliable for Next SSR.\n'
    )
  }

  console.log('Results:')
  console.log('-'.repeat(72))
  let failed = 0
  for (const r of results) {
    let target = null
    if (r.label.includes('listOrders')) target = TARGETS.listOrdersWarmMs
    if (r.label.includes('getQuoteDetail')) target = TARGETS.quoteDetailWarmMs
    if (r.label.includes('/megrendelesek')) target = TARGETS.httpOrdersWarmMs
    if (r.label.includes('/ajanlatok')) target = TARGETS.httpQuoteWarmMs

    const verdict =
      target == null
        ? { ok: null, text: 'info' }
        : passFail(r.warmMedianMs, target)

    if (verdict.ok === false) failed += 1

    console.log(
      `${verdict.text.padEnd(4)} ${r.label}\n` +
        `     cold=${r.coldMs}ms  warm_median=${r.warmMedianMs}ms  warm_p95=${r.warmP95Ms}ms` +
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
