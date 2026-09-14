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
