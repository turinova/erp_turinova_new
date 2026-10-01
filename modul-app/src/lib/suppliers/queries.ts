import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  SupplierAddressType,
  SupplierCurrency,
  SupplierStatus
} from '@/lib/suppliers/parse'
import type { OrderChannelType } from '@/lib/suppliers/order-channels'

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

export type SupplierOrderChannel = {
  id: string
  channel_type: OrderChannelType
  name: string | null
  url_template: string | null
  description: string | null
  is_default: boolean
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
  email_po_intro_html: string | null
  status: SupplierStatus
  default_currency: SupplierCurrency
  default_tax_rate_id: string | null
  default_payment_method_id: string | null
  default_payment_terms_days: number
  created_at: string
  updated_at: string
  addresses: SupplierAddress[]
  contacts: SupplierContact[]
  order_channels: SupplierOrderChannel[]
}

/** PO gyorsítás: e-mail + webshop sablon a kiválasztott beszállítóhoz. */
export type SupplierProcurementAids = {
  supplierId: string
  name: string
  email: string | null
  emailPoIntroHtml: string | null
  internetUrlTemplate: string | null
  hasEmailChannel: boolean
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
      email_po_intro_html,
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
      ),
      supplier_order_channels (
        id,
        channel_type,
        name,
        url_template,
        description,
        is_default,
        deleted_at
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

  const orderChannels = (
    (data.supplier_order_channels ?? []) as (SupplierOrderChannel & {
      deleted_at: string | null
    })[]
  )
    .filter((c) => !c.deleted_at)
    .map((c) => ({
      id: c.id,
      channel_type: c.channel_type,
      name: c.name,
      url_template: c.url_template,
      description: c.description,
      is_default: c.is_default
    }))
    .sort((a, b) => Number(b.is_default) - Number(a.is_default))

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
    email_po_intro_html: data.email_po_intro_html ?? null,
    status: data.status as SupplierStatus,
    default_currency: data.default_currency as SupplierCurrency,
    default_tax_rate_id: data.default_tax_rate_id,
    default_payment_method_id: data.default_payment_method_id,
    default_payment_terms_days: Number(data.default_payment_terms_days),
    created_at: data.created_at,
    updated_at: data.updated_at,
    addresses,
    contacts,
    order_channels: orderChannels
  }
}

export async function getSupplierProcurementAids(
  supabase: SupabaseClient,
  tenantId: string,
  supplierId: string
): Promise<SupplierProcurementAids | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select(
      `
      id,
      name,
      email,
      email_po_intro_html,
      supplier_order_channels (
        channel_type,
        url_template,
        is_default,
        deleted_at
      )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', supplierId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getSupplierProcurementAids', error.message)
    return null
  }
  if (!data) return null

  const channels = (
    (data.supplier_order_channels ?? []) as {
      channel_type: string
      url_template: string | null
      is_default: boolean
      deleted_at: string | null
    }[]
  ).filter((c) => !c.deleted_at)

  const internet = channels
    .filter((c) => c.channel_type === 'internet' && c.url_template)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default))[0]

  const hasEmailChannel = channels.some((c) => c.channel_type === 'email')

  return {
    supplierId: data.id,
    name: data.name,
    email: data.email,
    emailPoIntroHtml: data.email_po_intro_html ?? null,
    internetUrlTemplate: internet?.url_template ?? null,
    hasEmailChannel: hasEmailChannel || Boolean(data.email)
  }
}

/** Beszállítói cikkszámok a PO tételekhez (accessory_id → sku). */
export async function mapAccessorySupplierSkus(
  supabase: SupabaseClient,
  tenantId: string,
  supplierId: string,
  accessoryIds: string[]
): Promise<Record<string, string>> {
  const ids = [...new Set(accessoryIds.filter(Boolean))]
  if (ids.length === 0) return {}

  const { data, error } = await supabase
    .from('accessory_suppliers')
    .select('accessory_id, supplier_sku')
    .eq('tenant_id', tenantId)
    .eq('supplier_id', supplierId)
    .in('accessory_id', ids)

  if (error) {
    console.error('mapAccessorySupplierSkus', error.message)
    return {}
  }

  const out: Record<string, string> = {}
  for (const row of data ?? []) {
    const sku = (row.supplier_sku as string | null)?.trim()
    if (sku) out[row.accessory_id as string] = sku
  }
  return out
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
