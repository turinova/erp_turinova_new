import type { SupabaseClient } from '@supabase/supabase-js'

export type PaymentMethodListItem = {
  id: string
  name: string
  comment: string | null
  active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export type PaymentMethodOption = {
  id: string
  name: string
  is_default: boolean
}

/** Partner beküldés dialógus — aktív mód + comment. */
export type PartnerPaymentMethodOption = {
  id: string
  name: string
  comment: string | null
  is_default: boolean
}

export async function listPaymentMethods(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PaymentMethodListItem[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, name, comment, active, is_default, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    console.error('listPaymentMethods', error.message)
    throw new Error('Nem sikerült betölteni a fizetési módokat.')
  }

  return ((data ?? []) as PaymentMethodListItem[]).map((row) => ({
    ...row,
    is_default: Boolean(row.is_default)
  }))
}

/** Aktív módok a megrendelés / befizetés selecthez. */
export async function listActivePaymentMethods(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PaymentMethodOption[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, name, is_default')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    console.error('listActivePaymentMethods', error.message)
    throw new Error('Nem sikerült betölteni a fizetési módokat.')
  }

  return ((data ?? []) as PaymentMethodOption[]).map((row) => ({
    ...row,
    is_default: Boolean(row.is_default)
  }))
}

/** Partner: kapcsolt cég aktív módjai (+ comment a beküldés UI-hoz). */
export async function listActivePaymentMethodsForPartner(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PartnerPaymentMethodOption[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, name, comment, is_default')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    console.error('listActivePaymentMethodsForPartner', error.message)
    throw new Error('Nem sikerült betölteni a fizetési módokat.')
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    comment: (row.comment as string | null) ?? null,
    is_default: Boolean(row.is_default)
  }))
}
