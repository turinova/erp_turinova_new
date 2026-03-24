import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { getTenantSupabase } from '@/lib/tenant-supabase'
import type { SupplierImportRow } from '@/lib/data-operations/suppliers-xlsx'

type ExecutePayload = {
  rows: SupplierImportRow[]
}

type FailedRow = {
  rowNumber: number
  name: string | null
  reason: string
}

function normalizeLookupKey(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function extractVatRateCandidates(value: string | null | undefined): string[] {
  const source = normalizeLookupKey(value)
  if (!source) return []

  const set = new Set<string>([source])
  const numberMatch = source.match(/(\d+(?:[.,]\d+)?)/)
  if (numberMatch) {
    const raw = numberMatch[1].replace(',', '.')
    const parsed = Number(raw)
    if (!Number.isNaN(parsed)) {
      const fixed = Number.isInteger(parsed) ? String(parsed) : String(parsed)
      set.add(fixed)
      set.add(`${fixed}%`)
    }
  }

  return [...set]
}

function trimOrNull(value: string | null | undefined): string | null {
  if (!value) return null
  const t = String(value).trim()

  
return t.length > 0 ? t : null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as ExecutePayload
    const rows = Array.isArray(body?.rows) ? body.rows : []

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Nincs feldolgozható sor.' }, { status: 400 })
    }

    let created = 0
    let updated = 0
    let skipped = 0
    const failed: FailedRow[] = []

    const [{ data: paymentMethods }, { data: vatRates }, { data: currencies }] = await Promise.all([
      supabase.from('payment_methods').select('id, name, code').is('deleted_at', null),
      supabase.from('vat').select('id, name, kulcs').is('deleted_at', null),
      supabase.from('currencies').select('id, code, name').is('deleted_at', null)
    ])

    const paymentMethodLookup = new Map<string, string>()
    for (const pm of paymentMethods || []) {
      const keys = [normalizeLookupKey(pm.name), normalizeLookupKey(pm.code)].filter(Boolean)
      keys.forEach(key => paymentMethodLookup.set(key, pm.id))
    }

    const vatLookup = new Map<string, string>()
    for (const vat of vatRates || []) {
      const numeric = vat.kulcs === null || vat.kulcs === undefined ? '' : String(vat.kulcs)
      const numericAsNumber = numeric ? String(Number(numeric)) : ''
      const keys = [
        normalizeLookupKey(vat.name),
        normalizeLookupKey(numeric),
        normalizeLookupKey(numericAsNumber),
        normalizeLookupKey(numeric ? `${numeric}%` : ''),
        normalizeLookupKey(numericAsNumber ? `${numericAsNumber}%` : '')
      ].filter(Boolean)
      keys.forEach(key => vatLookup.set(key, vat.id))
    }

    const currencyLookup = new Map<string, string>()
    for (const currency of currencies || []) {
      const keys = [normalizeLookupKey(currency.code), normalizeLookupKey(currency.name)].filter(Boolean)
      keys.forEach(key => currencyLookup.set(key, currency.id))
    }

    for (const row of rows) {
      if (row.errors && row.errors.length > 0) {
        skipped += 1
        failed.push({
          rowNumber: row.rowNumber,
          name: row.normalized?.name || null,
          reason: `Validációs hiba: ${row.errors.join('; ')}`
        })
        continue
      }

      const n = row.normalized

      if (!n || !n.name || !n.supplier_code) {
        skipped += 1
        failed.push({
          rowNumber: row.rowNumber,
          name: null,
          reason: 'Hiányzó kötelező mező: supplier_code vagy name'
        })
        continue
      }

      const payload = {
        name: n.name.trim(),
        short_name: trimOrNull(n.supplier_code),
        email: trimOrNull(n.email),
        phone: trimOrNull(n.phone),
        website: trimOrNull(n.website),
        tax_number: trimOrNull(n.tax_number),
        eu_tax_number: trimOrNull(n.eu_tax_number),
        status: n.status || 'active',
        default_payment_terms_days: n.default_payment_terms_days ?? null,
        default_payment_method_id: null as string | null,
        default_vat_id: null as string | null,
        default_currency_id: null as string | null,
        updated_at: new Date().toISOString(),
        deleted_at: null as string | null
      }

      if (n.payment_method) {
        const paymentMethodId = paymentMethodLookup.get(normalizeLookupKey(n.payment_method))
        if (paymentMethodId) {
          payload.default_payment_method_id = paymentMethodId
        } else {
          row.errors.push(`Ismeretlen fizetési mód: ${n.payment_method}`)
        }
      }

      if (n.vat) {
        const vatCandidates = extractVatRateCandidates(n.vat)
        const vatId = vatCandidates.map(candidate => vatLookup.get(candidate)).find(Boolean)
        if (vatId) {
          payload.default_vat_id = vatId
        } else {
          row.errors.push(`Ismeretlen ÁFA: ${n.vat}`)
        }
      }

      if (n.currency) {
        const currencyId = currencyLookup.get(normalizeLookupKey(n.currency))
        if (currencyId) {
          payload.default_currency_id = currencyId
        } else {
          row.errors.push(`Ismeretlen pénznem: ${n.currency}`)
        }
      }

      if (row.errors.length > 0) {
        skipped += 1
        failed.push({
          rowNumber: row.rowNumber,
          name: n.name,
          reason: `Validációs hiba: ${row.errors.join('; ')}`
        })
        continue
      }

      try {
        let targetId: string | null = null

        const { data: byCode } = await supabase
          .from('suppliers')
          .select('id')
          .ilike('short_name', n.supplier_code.trim())
          .is('deleted_at', null)
          .maybeSingle()

        if (byCode?.id) {
          targetId = byCode.id
        } else if (n.tax_number) {
          const { data: byTax } = await supabase
            .from('suppliers')
            .select('id')
            .eq('tax_number', n.tax_number.trim())
            .is('deleted_at', null)
            .maybeSingle()

          if (byTax?.id) {
            targetId = byTax.id
          }
        }

        if (!targetId) {
          const { data: byName } = await supabase
            .from('suppliers')
            .select('id')
            .eq('name', n.name.trim())
            .is('deleted_at', null)
            .maybeSingle()

          if (byName?.id) {
            targetId = byName.id
          }
        }

        if (targetId) {
          const { error } = await supabase
            .from('suppliers')
            .update(payload)
            .eq('id', targetId)

          if (error) {
            failed.push({
              rowNumber: row.rowNumber,
              name: n.name,
              reason: error.message || 'Frissítési hiba'
            })
            skipped += 1
            continue
          }

          updated += 1
        } else {
          const { error } = await supabase
            .from('suppliers')
            .insert({
              ...payload,
              created_at: new Date().toISOString()
            })

          if (error) {
            failed.push({
              rowNumber: row.rowNumber,
              name: n.name,
              reason: error.message || 'Létrehozási hiba'
            })
            skipped += 1
            continue
          }

          created += 1
        }
      } catch (error: any) {
        skipped += 1
        failed.push({
          rowNumber: row.rowNumber,
          name: n.name,
          reason: error?.message || 'Ismeretlen feldolgozási hiba'
        })
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: rows.length,
        created,
        updated,
        skipped,
        failed: failed.length
      },
      failedRows: failed
    })
  } catch (error: any) {
    console.error('Supplier import execute error:', error)
    
return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
