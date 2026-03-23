// Server-side Connections Utilities
// For use in server components and API routes

import { getTenantSupabase } from './tenant-supabase'

export interface WebshopConnection {
  id: string
  name: string
  connection_type: 'shoprenter' | 'unas' | 'shopify' | 'szamlazz'
  api_url: string
  username: string
  password: string // Encrypted in production
  is_active: boolean
  last_tested_at: string | null
  last_test_status: 'success' | 'failed' | null
  last_test_error: string | null
  search_console_property_url: string | null
  search_console_client_email: string | null
  search_console_private_key: string | null
  search_console_enabled: boolean
  /** Számlázz: buffer→order importkor automatikus díjbekérő (fizetési mód + kapcsoló) */
  buffer_auto_proforma_enabled?: boolean
  /** Automatikus díjbekérő: napok száma a kiállítás napjától a fizetési határidőig (0–365) */
  buffer_auto_proforma_due_days?: number
  created_at: string
  updated_at: string
}

/**
 * Get all webshop connections (server-side)
 */
export async function getAllConnections(): Promise<WebshopConnection[]> {
  try {
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('User not authenticated:', userError?.message || 'No user')
      return []
    }

    const { data: connections, error } = await supabase
      .from('webshop_connections')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching connections:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return []
    }

    return connections || []
  } catch (error) {
    console.error('Exception in getAllConnections:', error instanceof Error ? error.message : String(error))
    return []
  }
}

/**
 * Get a single connection by ID (server-side)
 */
export async function getConnectionById(id: string): Promise<WebshopConnection | null> {
  try {
    // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
    const supabase = await getTenantSupabase()

    const { data: connection, error } = await supabase
      .from('webshop_connections')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Error fetching connection:', error)
      return null
    }

    return connection
  } catch (error) {
    console.error('Exception in getConnectionById:', error instanceof Error ? error.message : String(error))
    return null
  }
}
