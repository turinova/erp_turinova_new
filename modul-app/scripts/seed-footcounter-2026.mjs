#!/usr/bin/env node
/**
 * Belépők demo seed — teljes 2026 (jan–dec) synthetic crossings.
 *
 * Mintázat a main-app Pi adatból (2026-04…09):
 * - H–P ~150–220 belépő (IN); Szerda/Csütörtök csúcs
 * - Szombat ~fele; Vasárnap zárva
 * - Óránként: reggel 8–11 + délután 14–16 (Europe/Budapest)
 * - Szezonalitás: tél gyengébb, máj–aug erős, aug/dec ünnep dip
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-footcounter-2026.mjs --tenant-slug=demo
 *   node --env-file=.env.local scripts/seed-footcounter-2026.mjs --tenant-id=<uuid> --replace
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

const args = parseArgs(process.argv.slice(2))
const TENANT_SLUG = args['tenant-slug'] || process.env.FOOTCOUNTER_SEED_TENANT_SLUG || 'demo'
const TENANT_ID = args['tenant-id'] || process.env.FOOTCOUNTER_SEED_TENANT_ID || ''
const DEVICE_SLUG = args['device-slug'] || 'bejarat'
const REPLACE = Boolean(args.replace)
const DRY = Boolean(args['dry-run'])
const YEAR = 2026

/** DOW multipliers (Mon=0 … Sat=5). Wed/Thu strongest; Sat light. */
const DOW_IN_MULT = [1.05, 0.98, 1.18, 1.14, 1.04, 0.55]

/**
 * Month multipliers from real Apr–Sep curve + extrapolated winter/autumn.
 * Real IN/day ~: Apr 189, May 208, Jun 204, Jul 195, Aug 201, Sep 172
 */
const MONTH_MULT = {
  1: 0.72,
  2: 0.78,
  3: 0.88,
  4: 0.95,
  5: 1.05,
  6: 1.08,
  7: 1.02,
  8: 0.98,
  9: 0.92,
  10: 0.96,
  11: 0.88,
  12: 0.8
}

/** Local hour weights (Europe/Budapest) — share of daily crossings. */
const HOUR_WEIGHTS = [
  [7, 0.05],
  [8, 0.14],
  [9, 0.13],
  [10, 0.12],
  [11, 0.11],
  [12, 0.08],
  [13, 0.08],
  [14, 0.1],
  [15, 0.1],
  [16, 0.07],
  [17, 0.02]
]

/** Hungarian public holidays 2026 — closed (0 traffic). */
const CLOSED = new Set([
  '2026-01-01',
  '2026-03-15',
  '2026-04-06', // Húsvét hétfő
  '2026-05-01',
  '2026-05-24', // Pünkösd hétfő
  '2026-08-20',
  '2026-10-23',
  '2026-11-01',
  '2026-12-25',
  '2026-12-26'
])

function parseArgs(argv) {
  const out = {}
  for (const a of argv) {
    if (a === '--replace') out.replace = true
    else if (a === '--dry-run') out['dry-run'] = true
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      out[k] = v === undefined ? true : v
    }
  }
  return out
}

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(str) {
  const h = createHash('sha256').update(str).digest()
  return h.readUInt32LE(0)
}

function ymd(d) {
  return d.toISOString().slice(0, 10)
}

function budapestOffsetMinutes(date) {
  // CEST (UTC+2) roughly Mar last Sun – Oct last Sun; else CET +1
  const y = date.getUTCFullYear()
  const lastSun = (month) => {
    const d = new Date(Date.UTC(y, month + 1, 0))
    const day = d.getUTCDay()
    return new Date(Date.UTC(y, month + 1, 0 - day))
  }
  const start = lastSun(2) // March
  const end = lastSun(9) // October
  const t = date.getTime()
  return t >= start.getTime() && t < end.getTime() ? 120 : 60
}

function toTimestamptz(year, month, day, hour, minute, second, ms) {
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const offsetMin = budapestOffsetMinutes(probe)
  return new Date(localAsUtc - offsetMin * 60_000).toISOString()
}

function pickHour(rand) {
  const total = HOUR_WEIGHTS.reduce((s, [, w]) => s + w, 0)
  let x = rand() * total
  for (const [h, w] of HOUR_WEIGHTS) {
    x -= w
    if (x <= 0) return h
  }
  return HOUR_WEIGHTS[HOUR_WEIGHTS.length - 1][0]
}

/**
 * Target IN count for a calendar day.
 * Midweek baseline ~175; DOW + month + noise → mostly 150–220 H–P.
 */
function targetIns(date, rand) {
  const key = ymd(date)
  if (CLOSED.has(key)) return 0
  // date is Date at UTC midnight representing calendar day
  const jsDow = date.getUTCDay() // 0=Sun … 6=Sat
  if (jsDow === 0) return 0

  const dowIdx = jsDow === 6 ? 5 : jsDow - 1 // Mon=0 … Sat=5
  const month = date.getUTCMonth() + 1
  const base = 175
  const mult = DOW_IN_MULT[dowIdx] * (MONTH_MULT[month] ?? 1)
  // Soft Christmas week + mid-August factory week dip
  let seasonal = 1
  if (month === 12 && date.getUTCDate() >= 20 && date.getUTCDate() <= 24) seasonal = 0.55
  if (month === 8 && date.getUTCDate() >= 10 && date.getUTCDate() <= 20) seasonal = 0.85

  const noise = 0.88 + rand() * 0.24 // ±12%
  const n = Math.round(base * mult * seasonal * noise)
  if (jsDow === 6) return Math.max(60, Math.min(130, n))
  return Math.max(130, Math.min(240, n))
}

function generateDayEvents(deviceId, date, rand) {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const ins = targetIns(date, rand)
  if (ins === 0) return []

  // OUT ≈ IN (real data ~1:1), slight afternoon bias via hour pick
  const outs = Math.max(0, Math.round(ins * (0.94 + rand() * 0.1)))

  const events = []
  for (let i = 0; i < ins; i++) {
    const hour = pickHour(rand)
    // mornings bias slightly earlier for IN
    const h = hour <= 11 ? hour : hour
    const minute = Math.floor(rand() * 60)
    const second = Math.floor(rand() * 60)
    const ms = Math.floor(rand() * 1000)
    events.push({
      device_id: deviceId,
      client_event_id: deterministicUuid(`${deviceId}:${ymd(date)}:in:${i}`),
      occurred_at: toTimestamptz(year, month, day, h, minute, second, ms),
      direction: 'in',
      confidence: roundConf(0.75 + rand() * 0.2)
    })
  }
  for (let i = 0; i < outs; i++) {
    let hour = pickHour(rand)
    // OUT bias afternoon
    if (rand() < 0.35) hour = Math.min(17, Math.max(12, hour + 2))
    const minute = Math.floor(rand() * 60)
    const second = Math.floor(rand() * 60)
    const ms = Math.floor(rand() * 1000)
    events.push({
      device_id: deviceId,
      client_event_id: deterministicUuid(`${deviceId}:${ymd(date)}:out:${i}`),
      occurred_at: toTimestamptz(year, month, day, hour, minute, second, ms),
      direction: 'out',
      confidence: roundConf(0.72 + rand() * 0.22)
    })
  }
  return events
}

function deterministicUuid(key) {
  const h = createHash('sha256').update(key).digest()
  const bytes = Buffer.from(h.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function roundConf(n) {
  return Math.round(n * 1e6) / 1e6
}

function eachDayOfYear(year) {
  const days = []
  let d = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year, 11, 31))
  while (d <= end) {
    days.push(new Date(d))
    d = new Date(d.getTime() + 86400000)
  }
  return days
}

async function resolveTenant(admin) {
  if (TENANT_ID) {
    const { data, error } = await admin
      .from('tenants')
      .select('id, slug, name')
      .eq('id', TENANT_ID)
      .maybeSingle()
    if (error || !data) throw new Error(`Tenant not found: ${TENANT_ID}`)
    return data
  }
  const { data, error } = await admin
    .from('tenants')
    .select('id, slug, name')
    .eq('slug', TENANT_SLUG)
    .maybeSingle()
  if (error || !data) {
    throw new Error(
      `Tenant slug "${TENANT_SLUG}" not found. Pass --tenant-id=… or --tenant-slug=…`
    )
  }
  return data
}

async function ensureAddon(admin, tenantId) {
  const { data: addon } = await admin
    .from('product_addons')
    .select('id')
    .eq('key', 'footcounter')
    .maybeSingle()
  if (!addon?.id) {
    console.warn('⚠ product_addons.footcounter hiányzik — futtasd a 20260429 migrationt.')
    return
  }
  const { error: addonErr } = await admin.from('tenant_addons').upsert(
    { tenant_id: tenantId, addon_id: addon.id },
    { onConflict: 'tenant_id,addon_id' }
  )
  if (addonErr) console.warn('tenant_addons:', addonErr.message)

  const { error: entErr } = await admin.from('tenant_entitlements').upsert(
    { tenant_id: tenantId, feature_key: 'footcounter' },
    { onConflict: 'tenant_id,feature_key' }
  )
  if (entErr) console.warn('tenant_entitlements:', entErr.message)

  // Page access for all memberships (same as grantBelepokPageAccess)
  const { data: memberships } = await admin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)
  if (memberships?.length) {
    const rows = memberships.map((m) => ({
      tenant_id: tenantId,
      membership_id: m.id,
      page_key: '/belepok',
      can_access: true
    }))
    const { error: pageErr } = await admin
      .from('tenant_membership_page_access')
      .upsert(rows, { onConflict: 'membership_id,page_key' })
    if (pageErr) console.warn('page_access:', pageErr.message)
  }
}

async function ensureDevice(admin, tenantId) {
  const { data: existing } = await admin
    .from('footcounter_devices')
    .select('id, slug, name')
    .eq('tenant_id', tenantId)
    .eq('slug', DEVICE_SLUG)
    .maybeSingle()
  if (existing?.id) return existing

  const { data, error } = await admin
    .from('footcounter_devices')
    .insert({
      tenant_id: tenantId,
      slug: DEVICE_SLUG,
      name: 'Bejárat',
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('id, slug, name')
    .single()
  if (error || !data) throw new Error(`Device create failed: ${error?.message}`)
  return data
}

async function main() {
  if (!URL || !SERVICE) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const tenant = await resolveTenant(admin)
  console.log(`Tenant: ${tenant.name} (${tenant.slug}) ${tenant.id}`)

  if (!DRY) {
    await ensureAddon(admin, tenant.id)
  }

  const device = DRY
    ? { id: randomUUID(), slug: DEVICE_SLUG, name: 'Bejárat' }
    : await ensureDevice(admin, tenant.id)
  console.log(`Device: ${device.name} (${device.slug}) ${device.id}`)

  if (REPLACE && !DRY) {
    console.log('Replace: törlöm a meglévő crossings-ot erre az eszközre…')
    const { error } = await admin
      .from('footcounter_crossings')
      .delete()
      .eq('device_id', device.id)
    if (error) throw new Error(error.message)
  }

  const rand = mulberry32(hashSeed(`footcounter-2026:${tenant.id}:${device.id}`))
  const days = eachDayOfYear(YEAR)
  const all = []
  let sumIn = 0
  let openDays = 0
  const byDowIn = Array(7).fill(0)
  const byDowDays = Array(7).fill(0)
  const byMonthIn = Array(13).fill(0)

  for (const d of days) {
    const events = generateDayEvents(device.id, d, rand)
    const ins = events.filter((e) => e.direction === 'in').length
    if (ins > 0) {
      openDays += 1
      sumIn += ins
      const dow = d.getUTCDay()
      byDowIn[dow] += ins
      byDowDays[dow] += 1
      byMonthIn[d.getUTCMonth() + 1] += ins
    }
    all.push(...events)
  }

  console.log(
    `Generated ${all.length} events (${sumIn} IN) across ${openDays} open days · avg IN/open day ${
      openDays ? (sumIn / openDays).toFixed(1) : 0
    }`
  )
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  for (let i = 0; i < 7; i++) {
    if (!byDowDays[i]) continue
    console.log(
      `  ${names[i]}: avg IN ${(byDowIn[i] / byDowDays[i]).toFixed(1)} (${byDowDays[i]} days)`
    )
  }
  console.log(
    '  months IN total:',
    byMonthIn
      .slice(1)
      .map((n, i) => `${i + 1}=${n}`)
      .join(' ')
  )

  if (DRY) {
    console.log('Dry-run — nothing written.')
    return
  }

  const BATCH = 500
  let written = 0
  for (let i = 0; i < all.length; i += BATCH) {
    const chunk = all.slice(i, i + BATCH)
    const { error } = await admin.from('footcounter_crossings').upsert(chunk, {
      onConflict: 'device_id,client_event_id',
      ignoreDuplicates: false
    })
    if (error) {
      console.error('Upsert failed at', i, error.message)
      process.exit(1)
    }
    written += chunk.length
    if (written % 5000 === 0 || written === all.length) {
      console.log(`  … ${written}/${all.length}`)
    }
  }

  await admin
    .from('footcounter_devices')
    .update({
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', device.id)

  console.log('Done. Tenant UI: /belepok')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
