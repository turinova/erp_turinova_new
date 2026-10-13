import type { SupabaseClient } from '@supabase/supabase-js'

export type PaymentMethodListItem = {
  id: string
  name: string
  comment: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type PaymentMethodOption = {
  id: string
  name: string
}

/** Partner beküldés dialógus — aktív mód + comment. */
export type PartnerPaymentMethodOption = {
  id: string
  name: string
  comment: string | null
}

export async function listPaymentMethods(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PaymentMethodListItem[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, name, comment, active, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listPaymentMethods', error.message)
    throw new Error('Nem sikerült betölteni a fizetési módokat.')
  }

  return data ?? []
}

/** Aktív módok a megrendelés / befizetés selecthez. */
export async function listActivePaymentMethods(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PaymentMethodOption[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listActivePaymentMethods', error.message)
    throw new Error('Nem sikerült betölteni a fizetési módokat.')
  }

  return data ?? []
}

/** Partner: kapcsolt cég aktív módjai (+ comment a beküldés UI-hoz). */
export async function listActivePaymentMethodsForPartner(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PartnerPaymentMethodOption[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, name, comment')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listActivePaymentMethodsForPartner', error.message)
    throw new Error('Nem sikerült betölteni a fizetési módokat.')
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    comment: (row.comment as string | null) ?? null
  }))
}
