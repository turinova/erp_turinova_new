import type { SupabaseClient } from '@supabase/supabase-js'

/** Tabon látható cím — ne vágódjon le a lényeg. */
export function truncateTabTitle(value: string, max = 48): string {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`
}

function joinTabParts(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' · ')
}

export async function quoteTabTitle(
  supabase: SupabaseClient,
  tenantId: string,
  quoteId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select('quote_number, order_number, project_name, customers ( name )')
    .eq('tenant_id', tenantId)
    .eq('id', quoteId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) return null

  const customerRaw = data.customers as
    | { name: string }
    | { name: string }[]
    | null
  const customerName = Array.isArray(customerRaw)
    ? customerRaw[0]?.name
    : customerRaw?.name

  return truncateTabTitle(
    joinTabParts(data.quote_number, customerName ?? data.project_name)
  )
}

export async function partnerQuoteTabTitle(
  supabase: SupabaseClient,
  partnerUserId: string,
  quoteId: string,
  mode: 'quote' | 'order'
): Promise<string | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select('quote_number, order_number, project_name')
    .eq('partner_profile_id', partnerUserId)
    .eq('id', quoteId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) return null

  const primary =
    mode === 'order'
      ? data.order_number || data.quote_number
      : data.quote_number

  return truncateTabTitle(joinTabParts(primary, data.project_name))
}

export async function customerTabTitle(
  supabase: SupabaseClient,
  tenantId: string,
  customerId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('name')
    .eq('tenant_id', tenantId)
    .eq('id', customerId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data?.name) return null
  return truncateTabTitle(data.name)
}

export async function namedEntityTabTitle(
  supabase: SupabaseClient,
  table:
    | 'sheet_materials'
    | 'linear_materials'
    | 'edge_materials'
    | 'accessories',
  tenantId: string,
  id: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from(table)
    .select('name')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data?.name) return null
  return truncateTabTitle(data.name)
}

export async function platformTenantTabTitle(
  admin: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle()

  if (error || !data?.name) return null
  return truncateTabTitle(data.name)
}

export async function platformPartnerTabTitle(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from('partner_profiles')
    .select('name, email')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  const label = data.name?.trim() || data.email?.trim()
  if (!label) return null
  return truncateTabTitle(label)
}
