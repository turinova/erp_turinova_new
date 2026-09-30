#!/usr/bin/env node
/**
 * main-app employees CSV → modul-app hr_employees (PIN/RFID + műszak).
 *
 * Usage (modul-app dir):
 *   npm run import:hr-employees -- --tenant-slug=demo --csv=./employees_rows.csv --dry-run
 *   npm run import:hr-employees -- --tenant-id=<uuid> --csv=./employees_rows.csv --apply
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Match: tenant + code (CSV employee_code). Soft-deleted CSV sorok kihagyva.
 * Típus: CSV employee_type → hr_employee_types.code (alias map; ismeretlen → default).
 */

import { createClient } from '@supabase/supabase-js'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

/** main-app employee_type → modul-app hr_employee_types.code */
const TYPE_ALIASES = {
  muhely: 'muhely',
  bolt: 'bolt',
  bolti_dolgozo: 'bolt',
  iroda: 'iroda',
  lapszabasz: 'lapszabasz',
  lapszabaszat: 'lapszabasz',
  elzaro: 'egyeb',
  asztalos: 'muhely',
  egyeb: 'egyeb'
}

function parseArgs(argv) {
  const out = {}
  for (const a of argv) {
    if (a === '--dry-run') out['dry-run'] = true
    else if (a === '--apply') out.apply = true
    else if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq === -1) out[a.slice(2)] = true
      else {
        out[a.slice(2, eq)] = a.slice(eq + 1)
      }
    }
  }
  return out
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

async function readCsv(filePath) {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity
  })
  let headers = null
  const rows = []
  for await (const line of rl) {
    if (!line.trim()) continue
    const cols = parseCsvLine(line)
    if (!headers) {
      headers = cols.map((h) => h.trim())
      continue
    }
    const row = {}
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? ''
    })
    rows.push(row)
  }
  return rows
}

function normalizeTime(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

function normalizePin(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return null
  if (!/^\d{4}$/.test(t)) return null
  return t
}

function normalizeRfid(raw) {
  const t = String(raw ?? '').trim().toUpperCase()
  if (!t) return null
  if (t.length < 4 || t.length > 64) return null
  return t
}

function mapTypeCode(raw) {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  return TYPE_ALIASES[key] ?? null
}

function bool(raw, fallback = true) {
  const t = String(raw ?? '').trim().toLowerCase()
  if (t === 'true' || t === '1' || t === 't') return true
  if (t === 'false' || t === '0' || t === 'f') return false
  return fallback
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dry = Boolean(args['dry-run']) || !args.apply
  const tenantSlug = args['tenant-slug'] || ''
  const tenantIdArg = args['tenant-id'] || ''
  if (!args.csv) {
    console.error('Need --csv=/path/to/employees_rows.csv')
    process.exit(1)
  }
  const csvPath = path.resolve(args.csv)

  if (!URL || !SERVICE) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  if (!tenantSlug && !tenantIdArg) {
    console.error('Need --tenant-slug=… or --tenant-id=…')
    process.exit(1)
  }

  const admin = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  let tenantId = tenantIdArg
  if (!tenantId) {
    const { data, error } = await admin
      .from('tenants')
      .select('id, slug, name')
      .eq('slug', tenantSlug)
      .maybeSingle()
    if (error || !data) {
      console.error('Tenant not found:', tenantSlug, error?.message)
      process.exit(1)
    }
    tenantId = data.id
    console.log(`Tenant: ${data.name} (${data.slug}) ${tenantId}`)
  } else {
    console.log(`Tenant id: ${tenantId}`)
  }

  // Ensure types exist
  await admin.rpc('seed_hr_employee_types_for_tenant', {
    p_tenant_id: tenantId
  })

  const { data: typeRows, error: typeErr } = await admin
    .from('hr_employee_types')
    .select('id, code, name, is_default')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  if (typeErr || !typeRows?.length) {
    console.error('No employee types:', typeErr?.message)
    process.exit(1)
  }

  const typeByCode = new Map(
    typeRows.map((t) => [String(t.code).toLowerCase(), t])
  )
  const defaultType =
    typeRows.find((t) => t.is_default) || typeRows[typeRows.length - 1]

  const { data: existing, error: exErr } = await admin
    .from('hr_employees')
    .select('id, code, pin_code, rfid_card_id')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  if (exErr) {
    console.error('List employees failed:', exErr.message)
    process.exit(1)
  }

  const byCode = new Map(
    (existing || [])
      .filter((e) => e.code)
      .map((e) => [String(e.code).toLowerCase(), e])
  )

  const rows = await readCsv(csvPath)
  console.log(`CSV: ${csvPath} (${rows.length} rows)`)

  const stats = {
    skipDeleted: 0,
    skipEmpty: 0,
    skipBadPin: 0,
    create: 0,
    update: 0,
    typeFallback: 0,
    errors: []
  }

  const planned = []

  for (const raw of rows) {
    if (String(raw.deleted_at || '').trim()) {
      stats.skipDeleted++
      continue
    }
    const name = String(raw.name || '').trim()
    const code = String(raw.employee_code || '').trim()
    if (!name) {
      stats.skipEmpty++
      continue
    }

    const pinRaw = String(raw.pin_code || '').trim()
    const pin = normalizePin(pinRaw)
    if (pinRaw && !pin) {
      stats.skipBadPin++
      stats.errors.push(`${name}: invalid pin ${pinRaw}`)
    }

    const mapped = mapTypeCode(raw.employee_type)
    let type = mapped ? typeByCode.get(mapped) : null
    if (!type) {
      type = defaultType
      stats.typeFallback++
    }

    const payload = {
      tenant_id: tenantId,
      name,
      code,
      employee_type_id: type.id,
      active: bool(raw.active, true),
      shift_start: normalizeTime(raw.shift_start_time),
      shift_end: normalizeTime(raw.shift_end_time),
      lunch_start: normalizeTime(raw.lunch_break_start),
      lunch_end: normalizeTime(raw.lunch_break_end),
      works_on_saturday: bool(raw.works_on_saturday, false),
      overtime_enabled: bool(raw.overtime_enabled, false),
      overtime_grace_minutes: Number(raw.overtime_grace_minutes) || 15,
      overtime_daily_cap_minutes: Number(raw.overtime_daily_cap_minutes) || 180,
      pin_code: pin,
      rfid_card_id: normalizeRfid(raw.rfid_card_id),
      updated_at: new Date().toISOString()
    }

    const existingRow = code ? byCode.get(code.toLowerCase()) : null
    planned.push({
      action: existingRow ? 'update' : 'create',
      id: existingRow?.id ?? null,
      payload
    })
    if (existingRow) stats.update++
    else stats.create++
  }

  console.log(
    JSON.stringify(
      {
        dry,
        create: stats.create,
        update: stats.update,
        skipDeleted: stats.skipDeleted,
        skipEmpty: stats.skipEmpty,
        skipBadPin: stats.skipBadPin,
        typeFallback: stats.typeFallback,
        sample: planned.slice(0, 3).map((p) => ({
          action: p.action,
          name: p.payload.name,
          code: p.payload.code,
          pin: p.payload.pin_code,
          rfid: p.payload.rfid_card_id,
          type: p.payload.employee_type_id
        })),
        errors: stats.errors.slice(0, 10)
      },
      null,
      2
    )
  )

  if (dry) {
    console.log('Dry-run only. Pass --apply to write.')
    return
  }

  let written = 0
  for (const item of planned) {
    if (item.action === 'update') {
      const { error } = await admin
        .from('hr_employees')
        .update(item.payload)
        .eq('id', item.id)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
      if (error) {
        console.error('Update failed', item.payload.code, error.message)
        continue
      }
    } else {
      const { error } = await admin.from('hr_employees').insert(item.payload)
      if (error) {
        console.error('Insert failed', item.payload.code, error.message)
        continue
      }
    }
    written++
  }

  console.log(`Wrote ${written}/${planned.length} employees.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
