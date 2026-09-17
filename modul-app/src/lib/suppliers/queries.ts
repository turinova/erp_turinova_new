import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  SupplierAddressType,
  SupplierCurrency,
  SupplierStatus
} from '@/lib/suppliers/parse'

export type SupplierListItem = {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: SupplierStatus
  default_payment_terms_days: number
  city: string | null
  updated_at: string
}

export type SupplierAddress = {
  id: string
  label: string | null
  address_type: SupplierAddressType
  country: string
  postal_code: string | null
  city: string | null
  street: string | null
  house_number: string | null
  is_default: boolean
}

export type SupplierContact = {
  id: string
  name: string
  email: string | null
  phone: string | null
  is_primary: boolean
  note: string | null
}

export type SupplierDetail = {
  id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  tax_number: string | null
  eu_vat_number: string | null
  company_reg_number: string | null
  iban: string | null
  bic: string | null
  account_holder: string | null
  notes: string | null
  status: SupplierStatus
  default_currency: SupplierCurrency
  default_tax_rate_id: string | null
  default_payment_method_id: string | null
  default_payment_terms_days: number
  created_at: string
  updated_at: string
  addresses: SupplierAddress[]
  contacts: SupplierContact[]
}

export type SupplierListParams = {
  tenantId: string
  q?: string
  status?: SupplierStatus | 'all'
  page?: number
  limit?: number
}

export type SupplierListResult = {
  rows: SupplierListItem[]
  total: number
  page: number
  limit: number
}

export type SupplierSelectOption = {
  id: string
  name: string
  default_currency: SupplierCurrency
  default_tax_rate_id: string | null
  default_payment_method_id: string | null
  default_payment_terms_days: number
}

export async function listSuppliers(
  supabase: SupabaseClient,
  params: SupplierListParams
): Promise<SupplierListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('suppliers')
    .select(
      `
      id,
      name,
      email,
      phone,
      status,
      default_payment_terms_days,
      updated_at,
      supplier_addresses ( city, is_default )
    `,
      { count: 'exact' }
    )
    .eq('tenant_id', params.tenantId)
    .is('deleted_at', null)

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }

  const q = params.q?.trim()
  if (q) {
    const safe = q.replace(/[%_,]/g, '')
    if (safe) {
      query = query.or(
        `name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%,tax_number.ilike.%${safe}%`
      )
    }
  }

  const { data, error, count } = await query
    .order('name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('listSuppliers', error.message)
    throw new Error('Nem sikerült betölteni a beszállítókat.')
  }

  const rows: SupplierListItem[] = (data ?? []).map((row) => {
    const addrs = (row.supplier_addresses ?? []) as {
      city: string | null
      is_default: boolean
    }[]
    const defaultAddr =
      addrs.find((a) => a.is_default) ?? addrs[0] ?? null
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      status: row.status as SupplierStatus,
      default_payment_terms_days: Number(row.default_payment_terms_days),
      city: defaultAddr?.city ?? null,
      updated_at: row.updated_at
    }
  })

  return {
    rows,
    total: count ?? 0,
    page,
    limit
  }
}

export async function getSupplier(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<SupplierDetail | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select(
      `
      id,
      name,
      email,
      phone,
      website,
      tax_number,
      eu_vat_number,
      company_reg_number,
      iban,
      bic,
      account_holder,
      notes,
      status,
      default_currency,
      default_tax_rate_id,
      default_payment_method_id,
      default_payment_terms_days,
      created_at,
      updated_at,
      supplier_addresses (
        id,
        label,
        address_type,
        country,
        postal_code,
        city,
        street,
        house_number,
        is_default
      ),
      supplier_contacts (
        id,
        name,
        email,
        phone,
        is_primary,
        note
      )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getSupplier', error.message)
    throw new Error('Nem sikerült betölteni a beszállítót.')
  }

  if (!data) return null

  const addresses = (
    (data.supplier_addresses ?? []) as SupplierAddress[]
  ).slice().sort((a, b) => Number(b.is_default) - Number(a.is_default))

  const contacts = (
    (data.supplier_contacts ?? []) as SupplierContact[]
  ).slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary))

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    website: data.website,
    tax_number: data.tax_number,
    eu_vat_number: data.eu_vat_number,
    company_reg_number: data.company_reg_number,
    iban: data.iban,
    bic: data.bic,
    account_holder: data.account_holder,
    notes: data.notes,
    status: data.status as SupplierStatus,
    default_currency: data.default_currency as SupplierCurrency,
    default_tax_rate_id: data.default_tax_rate_id,
    default_payment_method_id: data.default_payment_method_id,
    default_payment_terms_days: Number(data.default_payment_terms_days),
    created_at: data.created_at,
    updated_at: data.updated_at,
    addresses,
    contacts
  }
}

/** Aktív beszállítók PO selecthez. */
export async function listActiveSuppliersForSelect(
  supabase: SupabaseClient,
  tenantId: string
): Promise<SupplierSelectOption[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select(
      `
      id,
      name,
      default_currency,
      default_tax_rate_id,
      default_payment_method_id,
      default_payment_terms_days
    `
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(500)

  if (error) {
    console.error('listActiveSuppliersForSelect', error.message)
    throw new Error('Nem sikerült betölteni a beszállítókat.')
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    default_currency: row.default_currency as SupplierCurrency,
    default_tax_rate_id: row.default_tax_rate_id,
    default_payment_method_id: row.default_payment_method_id,
    default_payment_terms_days: Number(row.default_payment_terms_days)
  }))
}
