// Server-side Connections Utilities
// For use in server components and API routes

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export interface WebshopConnection {
  id: string
  name: string
  connection_type: 'shoprenter' | 'unas' | 'shopify'
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
  created_at: string
  updated_at: string
}

/**
 * Get all webshop connections (server-side)
 */
export async function getAllConnections(): Promise<WebshopConnection[]> {
  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables')
      return []
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

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
  const cookieStore = await cookies()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

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
}
