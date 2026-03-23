import type { SupabaseClient } from '@supabase/supabase-js'

export type SzamlazzConnection = {
  id: string
  password: string
  api_url: string
  connection_type: string
}

/**
 * Resolve Számlázz Agent connection: order.connection_id first, else first active szamlazz connection.
 */
export async function getSzamlazzConnectionForOrder(
  supabase: SupabaseClient,
  order: { connection_id?: string | null }
): Promise<SzamlazzConnection | null> {
  if (order.connection_id) {
    const { data: c } = await supabase
      .from('webshop_connections')
      .select('id, password, api_url, connection_type')
      .eq('id', order.connection_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (c && c.connection_type === 'szamlazz') {
      return c as SzamlazzConnection
    }
  }

  const { data: list } = await supabase
    .from('webshop_connections')
    .select('id, password, api_url, connection_type')
    .eq('connection_type', 'szamlazz')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)

  return (list && list[0] ? list[0] : null) as SzamlazzConnection | null
}

/**
 * Load a specific Számlázz connection by id (e.g. buffer auto-proforma forced connection).
 */
export async function getSzamlazzConnectionById(
  supabase: SupabaseClient,
  id: string
): Promise<SzamlazzConnection | null> {
  const { data: c } = await supabase
    .from('webshop_connections')
    .select('id, password, api_url, connection_type')
    .eq('id', id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()
  if (c && c.connection_type === 'szamlazz' && String(c.password || '').trim()) {
    return c as SzamlazzConnection
  }
  return null
}
