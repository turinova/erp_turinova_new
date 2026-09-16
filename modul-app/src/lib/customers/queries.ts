import type { SupabaseClient } from '@supabase/supabase-js'

export type CustomerListItem = {
  id: string
  name: string
  email: string | null
  mobile: string | null
  billing_city: string | null
  updated_at: string
}

export type CustomerDetail = {
  id: string
  name: string
  email: string | null
  mobile: string | null
  sms_notification: boolean
  billing_name: string | null
  billing_country: string
  billing_city: string | null
  billing_postal_code: string | null
  billing_street: string | null
  billing_house_number: string | null
  billing_tax_number: string | null
  billing_company_reg_number: string | null
  created_at: string
  updated_at: string
}

export type CustomerListParams = {
  tenantId: string
  q?: string
  page?: number
  limit?: number
}

export type CustomerListResult = {
  rows: CustomerListItem[]
  total: number
  page: number
  limit: number
}

export async function listCustomers(
  supabase: SupabaseClient,
  params: CustomerListParams
): Promise<CustomerListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('customers')
    .select(
      'id, name, email, mobile, billing_city, updated_at',
      { count: 'exact' }
    )
    .eq('tenant_id', params.tenantId)
    .is('deleted_at', null)

  const q = params.q?.trim()
  if (q) {
    const safe = q.replace(/[%_,]/g, '')
    if (safe) {
      query = query.or(
        `name.ilike.%${safe}%,email.ilike.%${safe}%,mobile.ilike.%${safe}%,billing_city.ilike.%${safe}%`
      )
    }
  }

  const { data, error, count } = await query
    .order('name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('listCustomers', error.message)
    throw new Error('Nem sikerült betölteni az ügyfeleket.')
  }

  return {
    rows: (data ?? []) as CustomerListItem[],
    total: count ?? 0,
    page,
    limit
  }
}

export async function getCustomer(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<CustomerDetail | null> {
  const { data, error } = await supabase
    .from('customers')
    .select(
      `
      id,
      name,
      email,
      mobile,
      sms_notification,
      billing_name,
      billing_country,
      billing_city,
      billing_postal_code,
      billing_street,
      billing_house_number,
      billing_tax_number,
      billing_company_reg_number,
      created_at,
      updated_at
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getCustomer', error.message)
    throw new Error('Nem sikerült betölteni az ügyfelet.')
  }

  if (!data) return null

  return {
    ...data,
    sms_notification: Boolean(data.sms_notification),
    billing_country: data.billing_country || 'Magyarország'
  }
}

/** Opti ügyfél választó — név + számlázási mezők. */
export type OptiCustomerOption = {
  id: string
  name: string
  email: string | null
  mobile: string | null
  billing_name: string | null
  billing_country: string
  billing_city: string | null
  billing_postal_code: string | null
  billing_street: string | null
  billing_house_number: string | null
  billing_tax_number: string | null
}

/** Opti / select — max 500 ügyfél, ABC + számlázás. */
export async function listCustomersForSelect(
  supabase: SupabaseClient,
  tenantId: string
): Promise<OptiCustomerOption[]> {
  const { data, error } = await supabase
    .from('customers')
    .select(
      `
      id,
      name,
      email,
      mobile,
      billing_name,
      billing_country,
      billing_city,
      billing_postal_code,
      billing_street,
      billing_house_number,
      billing_tax_number
    `
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(500)

  if (error) {
    console.error('listCustomersForSelect', error.message)
    throw new Error('Nem sikerült betölteni az ügyfeleket.')
  }

  return (data ?? []).map((row) => ({
    ...row,
    billing_country: row.billing_country || 'Magyarország'
  }))
}

