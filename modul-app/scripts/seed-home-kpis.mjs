#!/usr/bin/env node
/**
 * Home KPI demo seed — értékesítés + jelenlét widgetekhez.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-home-kpis.mjs --tenant-slug=demo
 *   node --env-file=.env.local scripts/seed-home-kpis.mjs --tenant-id=<uuid> --replace
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * --replace: törli a SEED-KPI-* prefixű eladásokat / ajánlatokat / PO-kat
 *            és a SEED-KPI kódú dolgozókat (+ kapcsolódó attendance/absence).
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

const args = parseArgs(process.argv.slice(2))
const TENANT_SLUG = args['tenant-slug'] || process.env.HOME_KPI_SEED_TENANT_SLUG || 'demo'
const TENANT_ID = args['tenant-id'] || process.env.HOME_KPI_SEED_TENANT_ID || ''
const REPLACE = Boolean(args.replace)
const DRY = Boolean(args['dry-run'])
const WITH_JELENLET = args['skip-jelenlet'] ? false : true

const PREFIX = 'SEED-KPI'

function parseArgs(argv) {
  const out = {}
  for (const a of argv) {
    if (a === '--replace') out.replace = true
    else if (a === '--dry-run') out['dry-run'] = true
    else if (a === '--skip-jelenlet') out['skip-jelenlet'] = true
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      out[k] = v === undefined ? true : v
    }
  }
  return out
}

function budapestYmd(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

function budapestOffsetMinutes(probe) {
  const y = probe.getUTCFullYear()
  const lastSun = (month) => {
    const d = new Date(Date.UTC(y, month + 1, 0))
    const day = d.getUTCDay()
    return new Date(Date.UTC(y, month + 1, 0 - day))
  }
  const start = lastSun(2)
  const end = lastSun(9)
  const t = probe.getTime()
  return t >= start.getTime() && t < end.getTime() ? 120 : 60
}

/** Local Budapest wall time → ISO timestamptz */
function bpIso(ymd, hour, minute = 0) {
  const [y, m, d] = ymd.split('-').map(Number)
  const localAsUtc = Date.UTC(y, m - 1, d, hour, minute, 0, 0)
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const offsetMin = budapestOffsetMinutes(probe)
  return new Date(localAsUtc - offsetMin * 60_000).toISOString()
}

function isWeekdayYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
  return dow >= 1 && dow <= 5
}

if (!URL || !SERVICE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function resolveTenant() {
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
    throw new Error(`Tenant slug "${TENANT_SLUG}" not found`)
  }
  return data
}

async function ensureWarehouse(tenantId) {
  const { data: existing } = await admin
    .from('warehouses')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing) return existing

  if (DRY) return { id: randomUUID(), name: 'SEED raktár' }
  const { data, error } = await admin
    .from('warehouses')
    .insert({
      tenant_id: tenantId,
      name: 'Fő raktár',
      code: 'FO',
      is_default: true,
      is_active: true
    })
    .select('id, name')
    .single()
  if (error) throw new Error(`warehouse: ${error.message}`)
  return data
}

async function ensureCustomer(tenantId, name) {
  const { data: existing } = await admin
    .from('customers')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .ilike('name', name)
    .maybeSingle()
  if (existing) return existing

  if (DRY) return { id: randomUUID(), name }
  const { data, error } = await admin
    .from('customers')
    .insert({
      tenant_id: tenantId,
      name,
      billing_name: name,
      billing_country: 'Magyarország',
      billing_city: 'Budapest',
      billing_postal_code: '1111',
      billing_street: 'Fő utca',
      billing_house_number: '1'
    })
    .select('id, name')
    .single()
  if (error) throw new Error(`customer ${name}: ${error.message}`)
  return data
}

async function ensureSupplier(tenantId) {
  const name = `${PREFIX} Beszállító`
  const { data: existing } = await admin
    .from('suppliers')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .eq('name', name)
    .maybeSingle()
  if (existing) return existing

  if (DRY) return { id: randomUUID(), name }
  const { data, error } = await admin
    .from('suppliers')
    .insert({ tenant_id: tenantId, name, status: 'active' })
    .select('id, name')
    .single()
  if (error) throw new Error(`supplier: ${error.message}`)
  return data
}

async function ensureJelenletAddon(tenantId) {
  const { data: addon } = await admin
    .from('product_addons')
    .select('id')
    .eq('key', 'jelenlet')
    .maybeSingle()
  if (!addon?.id) {
    console.warn('⚠ jelenlet addon hiányzik a katalógusból')
    return false
  }
  if (DRY) return true
  const { error } = await admin.from('tenant_addons').upsert(
    { tenant_id: tenantId, addon_id: addon.id },
    { onConflict: 'tenant_id,addon_id' }
  )
  if (error) console.warn('tenant_addons jelenlet:', error.message)

  const features = ['jelenlet', '/jelenlet', '/dolgozok', '/dolgozok/tipusok', '/jelenlet/naptar']
  for (const feature_key of features) {
    const { error: entErr } = await admin.from('tenant_entitlements').upsert(
      { tenant_id: tenantId, feature_key },
      { onConflict: 'tenant_id,feature_key' }
    )
    if (entErr) console.warn('tenant_entitlements', feature_key, entErr.message)
  }

  const { data: memberships } = await admin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)
  if (memberships?.length) {
    const pages = ['/jelenlet', '/jelenlet/naptar', '/dolgozok', '/dolgozok/tipusok']
    const rows = memberships.flatMap((m) =>
      pages.map((page_key) => ({
        tenant_id: tenantId,
        membership_id: m.id,
        page_key,
        can_access: true
      }))
    )
    const { error: pageErr } = await admin
      .from('tenant_membership_page_access')
      .upsert(rows, { onConflict: 'membership_id,page_key' })
    if (pageErr) console.warn('page_access:', pageErr.message)
  }
  return true
}

async function cleanup(tenantId) {
  console.log('Replace: törlés SEED-KPI* …')
  if (DRY) return

  await admin
    .from('sales_orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .like('sale_number', `${PREFIX}-%`)

  await admin
    .from('sales_quotes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .like('quote_number', `${PREFIX}-%`)

  await admin
    .from('purchase_orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .like('po_number', `${PREFIX}-%`)

  const { data: emps } = await admin
    .from('hr_employees')
    .select('id')
    .eq('tenant_id', tenantId)
    .like('code', `${PREFIX}-%`)

  const ids = (emps ?? []).map((e) => e.id)
  if (ids.length) {
    await admin.from('hr_attendance_days').delete().in('employee_id', ids)
    await admin.from('hr_absences').delete().in('employee_id', ids)
    await admin.from('hr_employees').delete().in('id', ids)
  }
}

async function seedSales(tenantId, warehouseId, customers, supplierId) {
  const today = budapestYmd()
  const dayAmounts = [
    [6, [22000, 41000]],
    [5, [18000, 55000, 12000]],
    [4, [67000, 29000]],
    [3, [34000, 88000, 15000, 21000]],
    [2, [45000, 72000]],
    [1, [31000, 19000, 54000]],
    [0, [18900, 45200, 128000, 6700, 33500, 89000, 21400, 56000]]
  ]

  const sales = []
  let n = 0
  for (const [daysAgo, amounts] of dayAmounts) {
    const ymd = addDaysYmd(today, -daysAgo)
    if (!isWeekdayYmd(ymd) && daysAgo > 0) {
      // hétvégén is legyen némi zaj a chartnak (szombat light)
      if (new Date(`${ymd}T12:00:00Z`).getUTCDay() !== 6) continue
    }
    for (let i = 0; i < amounts.length; i++) {
      n += 1
      const gross = amounts[i]
      const hour = 9 + (i % 7)
      const fulfilled = bpIso(ymd, hour, 10 + i)
      sales.push({
        tenant_id: tenantId,
        warehouse_id: warehouseId,
        customer_id: customers[n % customers.length].id,
        sale_number: `${PREFIX}-S${String(n).padStart(3, '0')}`,
        channel: n % 3 === 0 ? 'pos' : 'manual',
        status: 'fulfilled',
        payment_status: 'paid',
        customer_name_snapshot: customers[n % customers.length].name,
        subtotal_net: Math.round(gross / 1.27),
        total_vat: gross - Math.round(gross / 1.27),
        total_gross: gross,
        fulfilled_at: fulfilled,
        created_at: fulfilled,
        updated_at: fulfilled
      })
    }
  }

  const quotes = [
    {
      status: 'sent',
      valid_until: addDaysYmd(today, -2),
      gross: 145000,
      label: 'lejárt'
    },
    {
      status: 'sent',
      valid_until: today,
      gross: 82000,
      label: 'ma lejár'
    },
    {
      status: 'sent',
      valid_until: addDaysYmd(today, 14),
      gross: 210000,
      label: 'nyitott'
    },
    {
      status: 'draft',
      valid_until: addDaysYmd(today, 30),
      gross: 45000,
      label: 'vázlat'
    },
    {
      status: 'sent',
      valid_until: addDaysYmd(today, 7),
      gross: 99000,
      label: 'nyitott2'
    }
  ].map((q, i) => ({
    tenant_id: tenantId,
    warehouse_id: warehouseId,
    customer_id: customers[i % customers.length].id,
    quote_number: `${PREFIX}-Q${String(i + 1).padStart(3, '0')}`,
    status: q.status,
    customer_name_snapshot: customers[i % customers.length].name,
    subtotal_net: Math.round(q.gross / 1.27),
    total_vat: q.gross - Math.round(q.gross / 1.27),
    total_gross: q.gross,
    valid_until: q.valid_until,
    created_at: bpIso(addDaysYmd(today, -5 + i), 10, 0),
    updated_at: bpIso(today, 10, 0)
  }))

  const pos = [
    {
      po_number: `${PREFIX}-PO001`,
      status: 'ordered',
      expected_date: addDaysYmd(today, -3)
    },
    {
      po_number: `${PREFIX}-PO002`,
      status: 'ordered',
      expected_date: addDaysYmd(today, 5)
    },
    {
      po_number: `${PREFIX}-PO003`,
      status: 'partial',
      expected_date: addDaysYmd(today, -1)
    }
  ].map((p) => ({
    tenant_id: tenantId,
    supplier_id: supplierId,
    warehouse_id: warehouseId,
    po_number: p.po_number,
    status: p.status,
    expected_date: p.expected_date,
    ordered_at: bpIso(addDaysYmd(today, -10), 11, 0),
    created_at: bpIso(addDaysYmd(today, -10), 11, 0),
    updated_at: bpIso(today, 11, 0)
  }))

  console.log(
    `Sales: ${sales.length} (8 ma), Quotes: ${quotes.length}, POs: ${pos.length}`
  )
  if (DRY) return

  const { error: sErr } = await admin.from('sales_orders').insert(sales)
  if (sErr) throw new Error(`sales_orders: ${sErr.message}`)

  const { error: qErr } = await admin.from('sales_quotes').insert(quotes)
  if (qErr) throw new Error(`sales_quotes: ${qErr.message}`)

  const { error: pErr } = await admin.from('purchase_orders').insert(pos)
  if (pErr) throw new Error(`purchase_orders: ${pErr.message}`)
}

async function seedJelenlet(tenantId) {
  const today = budapestYmd()
  const { data: typeRow } = await admin
    .from('hr_employee_types')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  let typeId = typeRow?.id
  if (!typeId) {
    if (DRY) typeId = randomUUID()
    else {
      const { data, error } = await admin
        .from('hr_employee_types')
        .insert({
          tenant_id: tenantId,
          name: 'Bolt',
          code: 'bolt',
          sort_order: 10,
          is_default: true,
          active: true
        })
        .select('id')
        .single()
      if (error) throw new Error(`hr_employee_types: ${error.message}`)
      typeId = data.id
    }
  }

  const names = [
    'Kovács Anna',
    'Nagy Péter',
    'Szabó Éva',
    'Tóth Gábor',
    'Horváth Luca',
    'Varga István',
    'Kiss Judit',
    'Molnár Dániel'
  ]

  const employees = names.map((name, i) => ({
    tenant_id: tenantId,
    name,
    code: `${PREFIX}-${String(i + 1).padStart(2, '0')}`,
    employee_type_id: typeId,
    active: true,
    shift_start: '08:00',
    shift_end: '16:30',
    lunch_start: '12:00',
    lunch_end: '12:30',
    works_on_saturday: false
  }))

  console.log(`Jelenlét: ${employees.length} dolgozó`)
  if (DRY) return

  const { data: inserted, error } = await admin
    .from('hr_employees')
    .insert(employees)
    .select('id, name, code')
  if (error) throw new Error(`hr_employees: ${error.message}`)

  const emps = inserted ?? []
  const attendance = []
  const absences = []

  // Ma: első 2 távollét, többi ~beírva
  absences.push({
    tenant_id: tenantId,
    employee_id: emps[0].id,
    start_date: today,
    end_date: today,
    absence_type: 'vacation',
    note: 'SEED'
  })
  absences.push({
    tenant_id: tenantId,
    employee_id: emps[1].id,
    start_date: today,
    end_date: addDaysYmd(today, 1),
    absence_type: 'sick',
    note: 'SEED'
  })

  for (let i = 2; i < emps.length; i++) {
    if (i === emps.length - 1) continue // 1 hiányzik ma (nincs beírva)
    attendance.push({
      tenant_id: tenantId,
      employee_id: emps[i].id,
      work_date: today,
      arrival_time: '08:02',
      departure_time: i < 5 ? null : '16:28',
      lunch_start: '12:00',
      lunch_end: '12:30',
      source: 'manual',
      manually_edited: true
    })
  }

  // Múlt munkanapok: szándékos hiányok (missing KPI)
  for (let back = 1; back <= 10; back++) {
    const ymd = addDaysYmd(today, -back)
    if (!isWeekdayYmd(ymd)) continue
    for (let i = 0; i < emps.length; i++) {
      // ~30% hiány néhány embernek
      if ((i + back) % 3 === 0 && i >= 4) continue
      if (i === 0 && back <= 3) {
        // Anna szabadság múltban is
        continue
      }
      attendance.push({
        tenant_id: tenantId,
        employee_id: emps[i].id,
        work_date: ymd,
        arrival_time: '07:55',
        departure_time: '16:30',
        lunch_start: '12:00',
        lunch_end: '12:30',
        source: 'manual',
        manually_edited: true
      })
    }
  }

  // Anna 3 nap szabadság múltban
  absences.push({
    tenant_id: tenantId,
    employee_id: emps[0].id,
    start_date: addDaysYmd(today, -3),
    end_date: addDaysYmd(today, -1),
    absence_type: 'vacation',
    note: 'SEED'
  })

  const { error: aErr } = await admin.from('hr_attendance_days').insert(attendance)
  if (aErr) throw new Error(`hr_attendance_days: ${aErr.message}`)

  const { error: absErr } = await admin.from('hr_absences').insert(absences)
  if (absErr) throw new Error(`hr_absences: ${absErr.message}`)

  console.log(
    `  attendance rows: ${attendance.length}, absences: ${absences.length}`
  )
}

async function main() {
  const tenant = await resolveTenant()
  console.log(`Tenant: ${tenant.name} (${tenant.slug}) ${tenant.id}`)
  if (DRY) console.log('DRY RUN — nincs írás')

  if (REPLACE) await cleanup(tenant.id)

  const warehouse = await ensureWarehouse(tenant.id)
  const customers = await Promise.all([
    ensureCustomer(tenant.id, `${PREFIX} Ügyfél Alfa`),
    ensureCustomer(tenant.id, `${PREFIX} Ügyfél Béta`),
    ensureCustomer(tenant.id, `${PREFIX} Ügyfél Gamma`)
  ])
  const supplier = await ensureSupplier(tenant.id)

  await seedSales(tenant.id, warehouse.id, customers, supplier.id)

  if (WITH_JELENLET) {
    const ok = await ensureJelenletAddon(tenant.id)
    if (ok) await seedJelenlet(tenant.id)
  }

  console.log('Kész. Nyisd meg a /home oldalt a KPI strippel.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
