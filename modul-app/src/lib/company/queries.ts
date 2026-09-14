import type { SupabaseClient } from '@supabase/supabase-js'

export type TenantCompanyRow = {
  tenant_id: string
  name: string
  country: string
  postal_code: string | null
  city: string | null
  address: string | null
  phone_number: string | null
  email: string | null
  website: string | null
  tax_number: string | null
  company_registration_number: string | null
  vat_id: string | null
  logo_url: string | null
  quote_validity_days: number
  created_at: string
  updated_at: string
}

const COMPANY_SELECT = `
  tenant_id,
  name,
  country,
  postal_code,
  city,
  address,
  phone_number,
  email,
  website,
  tax_number,
  company_registration_number,
  vat_id,
  logo_url,
  quote_validity_days,
  created_at,
  updated_at
`

function normalizeCompanyRow(row: TenantCompanyRow): TenantCompanyRow {
  return {
    ...row,
    quote_validity_days: row.quote_validity_days ?? 14
  }
}

export async function getTenantCompany(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantCompanyRow | null> {
  const { data, error } = await supabase
    .from('tenant_companies')
    .select(COMPANY_SELECT)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    console.error('getTenantCompany', error.message)
    throw new Error('Nem sikerült betölteni a cégadatokat.')
  }

  if (!data) return null
  return normalizeCompanyRow(data as TenantCompanyRow)
}

/** Lekérdezés; ha nincs sor és szabad írni, létrehoz a tenants.name alapján. */
export async function getOrCreateTenantCompany(
  supabase: SupabaseClient,
  tenantId: string,
  fallbackName: string,
  options?: { createIfMissing?: boolean }
): Promise<TenantCompanyRow | null> {
  const existing = await getTenantCompany(supabase, tenantId)
  if (existing) return existing

  if (options?.createIfMissing === false) return null

  const name = fallbackName.trim() || 'Cégem'
  const { data: inserted, error: insertError } = await supabase
    .from('tenant_companies')
    .insert({
      tenant_id: tenantId,
      name,
      country: 'Magyarország'
    })
    .select(COMPANY_SELECT)
    .single()

  if (insertError || !inserted) {
    const again = await getTenantCompany(supabase, tenantId)
    if (again) return again

    console.error('getOrCreateTenantCompany insert', insertError?.message)
    throw new Error('Nem sikerült létrehozni a cégadatokat.')
  }

  return normalizeCompanyRow(inserted as TenantCompanyRow)
}
