#!/usr/bin/env node
/**
 * customer-portal portal_customers → modul-app partner_profiles
 *
 * Default tenant: Hírös-Ablak Kft. (45dd7c02-…)
 * Auth user: random jelszó (user nem ismeri) + must_set_password=true
 *
 * Usage (modul-app dir):
 *   node --env-file=.env.local scripts/migrate-portal-partners.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-portal-partners.mjs --apply
 *   node --env-file=.env.local scripts/migrate-portal-partners.mjs --apply --limit=5
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { createReadStream } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { createInterface } from 'readline'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const HIROS_TENANT_ID = '45dd7c02-28e9-4f4a-b74c-704f63437927'
const LEGACY_COMPANY_ID = 'fa023793-d212-4a6c-9a2b-b3c1e9f94ea2'
const DEFAULT_CSV = path.join(__dirname, 'data', 'portal_customers.csv')

function argValue(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`))
  return hit ? hit.slice(name.length + 1) : fallback
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function randomPassword() {
  return randomBytes(24).toString('base64url')
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
      row[h] = (cols[i] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

function nullIfEmpty(s) {
  const t = (s || '').trim()
  return t || null
}

function csvEscape(c) {
  return `"${String(c ?? '').replace(/"/g, '""')}"`
}

async function resolveAuthUserId(admin, email) {
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200
    })
    if (error) {
      console.error('listUsers', error.message)
      return null
    }
    const hit = (data?.users ?? []).find(
      (u) => (u.email || '').toLowerCase() === email
    )
    if (hit) return hit.id
    if ((data?.users ?? []).length < 200) break
  }
  return null
}

/** Egy betöltés: meglévő partnerek + staff user_id-k (ne 453×2 query). */
async function loadExistingMaps(admin) {
  const byLegacy = new Map()
  const byEmail = new Map()
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('partner_profiles')
      .select('user_id, email, legacy_portal_customer_id')
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`partner_profiles load: ${error.message}`)
    const chunk = data ?? []
    for (const row of chunk) {
      if (row.legacy_portal_customer_id) {
        byLegacy.set(row.legacy_portal_customer_id, row.user_id)
      }
      if (row.email) {
        byEmail.set(String(row.email).toLowerCase(), row.user_id)
      }
    }
    if (chunk.length < pageSize) break
    from += pageSize
  }

  const staffIds = new Set()
  from = 0
  for (;;) {
    const { data, error } = await admin
      .from('tenant_memberships')
      .select('user_id')
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`tenant_memberships load: ${error.message}`)
    const chunk = data ?? []
    for (const row of chunk) {
      if (row.user_id) staffIds.add(row.user_id)
    }
    if (chunk.length < pageSize) break
    from += pageSize
  }

  return { byLegacy, byEmail, staffIds }
}

async function main() {
  const dryRun = !hasFlag('--apply')
  const limit = Number(argValue('--limit', '0')) || 0
  const csvPath = argValue('--csv', DEFAULT_CSV)
  const tenantId = argValue('--tenant', HIROS_TENANT_ID)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  console.log(dryRun ? '=== DRY-RUN ===' : '=== APPLY ===')
  console.log('csv:', csvPath)
  console.log('tenant:', tenantId)
  if (limit > 0) console.log('limit:', limit)

  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .select('id, name, status')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantErr || !tenant) {
    console.error('Tenant not found:', tenantErr?.message || tenantId)
    process.exit(1)
  }
  console.log('tenant:', tenant.name, '|', tenant.status)

  const { data: ent } = await admin
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .eq('feature_key', 'partner_orders')
    .maybeSingle()

  if (!ent) {
    console.warn('WARNING: partner_orders missing on tenant')
  } else {
    console.log('partner_orders: OK')
  }

  let rows = await readCsv(csvPath)
  console.log('csv rows:', rows.length)
  if (limit > 0) rows = rows.slice(0, limit)

  console.log('loading existing partners + staff…')
  const { byLegacy, byEmail, staffIds } = await loadExistingMaps(admin)
  console.log(
    `maps: partners=${byEmail.size}, legacy=${byLegacy.size}, staff=${staffIds.size}`
  )

  const report = []
  let created = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    const email = (row.email || '').trim().toLowerCase()
    const legacyId = (row.id || '').trim()
    const name = (row.name || '').trim() || email
    const base = { email, legacy_id: legacyId, name }

    if (!email || !legacyId) {
      failed++
      report.push({
        ...base,
        status: 'fail',
        new_user_id: '',
        error: 'missing email or id'
      })
      continue
    }

    if (
      row.selected_company_id &&
      row.selected_company_id !== LEGACY_COMPANY_ID
    ) {
      console.warn('unexpected company', email, row.selected_company_id)
    }

    if (byLegacy.has(legacyId)) {
      skipped++
      report.push({
        ...base,
        status: 'skip_legacy',
        new_user_id: byLegacy.get(legacyId),
        error: ''
      })
      continue
    }

    if (byEmail.has(email)) {
      skipped++
      report.push({
        ...base,
        status: 'skip_email',
        new_user_id: byEmail.get(email),
        error: ''
      })
      continue
    }

    if (dryRun) {
      created++
      report.push({
        ...base,
        status: 'would_create',
        new_user_id: '',
        error: ''
      })
      continue
    }

    let authUserId = null
    const password = randomPassword()
    const { data: createdAuth, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          migrated_from: 'customer-portal',
          legacy_portal_customer_id: legacyId
        }
      })

    if (createErr) {
      if (/already|registered|exists/i.test(createErr.message || '')) {
        authUserId = await resolveAuthUserId(admin, email)
        if (!authUserId) {
          failed++
          report.push({
            ...base,
            status: 'fail',
            new_user_id: '',
            error: `auth exists, id not found: ${createErr.message}`
          })
          continue
        }
      } else {
        failed++
        report.push({
          ...base,
          status: 'fail',
          new_user_id: '',
          error: createErr.message
        })
        continue
      }
    } else {
      authUserId = createdAuth.user?.id ?? null
    }

    if (!authUserId) {
      failed++
      report.push({
        ...base,
        status: 'fail',
        new_user_id: '',
        error: 'no auth user id'
      })
      continue
    }

    if (staffIds.has(authUserId)) {
      skipped++
      report.push({
        ...base,
        status: 'skip_staff',
        new_user_id: authUserId,
        error: 'staff membership'
      })
      continue
    }

    const { error: profileErr } = await admin.from('partner_profiles').insert({
      user_id: authUserId,
      name,
      email,
      mobile: nullIfEmpty(row.mobile),
      billing_name: nullIfEmpty(row.billing_name),
      billing_country: nullIfEmpty(row.billing_country) || 'Magyarország',
      billing_city: nullIfEmpty(row.billing_city),
      billing_postal_code: nullIfEmpty(row.billing_postal_code),
      billing_street: nullIfEmpty(row.billing_street),
      billing_house_number: nullIfEmpty(row.billing_house_number),
      billing_tax_number: nullIfEmpty(row.billing_tax_number),
      billing_company_reg_number: nullIfEmpty(row.billing_company_reg_number),
      selected_tenant_id: tenantId,
      status: 'active',
      terms_accepted_at: new Date().toISOString(),
      must_set_password: true,
      legacy_portal_customer_id: legacyId,
      updated_at: new Date().toISOString()
    })

    if (profileErr) {
      failed++
      report.push({
        ...base,
        status: 'fail',
        new_user_id: authUserId,
        error: profileErr.message
      })
      continue
    }

    byLegacy.set(legacyId, authUserId)
    byEmail.set(email, authUserId)
    created++
    report.push({
      ...base,
      status: 'created',
      new_user_id: authUserId,
      error: ''
    })
    if (created % 25 === 0) {
      console.log(`… created ${created}`)
    }
  }

  const outDir = path.join(__dirname, 'import-reports')
  await mkdir(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outPath = path.join(
    outDir,
    `portal_partners_${dryRun ? 'dryrun' : 'apply'}_${stamp}.csv`
  )
  const header = 'email,legacy_id,name,status,new_user_id,error\n'
  const body = report
    .map((r) =>
      [r.email, r.legacy_id, r.name, r.status, r.new_user_id, r.error]
        .map(csvEscape)
        .join(',')
    )
    .join('\n')
  await writeFile(outPath, header + body + '\n', 'utf8')

  console.log('---')
  console.log(dryRun ? 'would_create:' : 'created:', created)
  console.log('skipped:', skipped)
  console.log('failed:', failed)
  console.log('report:', outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
