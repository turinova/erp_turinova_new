import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAllConnections } from '@/lib/connections-server'

/**
 * GET /api/connections
 * Get all webshop connections
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connections = await getAllConnections()
    return NextResponse.json(connections)
  } catch (error) {
    console.error('Error fetching connections:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/connections
 * Create a new webshop connection
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      name, 
      connection_type, 
      api_url, 
      username, 
      password, 
      is_active,
      search_console_property_url,
      search_console_client_email,
      search_console_private_key,
      search_console_enabled
    } = body

    // Validation
    if (!name || !connection_type || !api_url || !username || !password) {
      return NextResponse.json(
        { error: 'Minden mező kitöltése kötelező' },
        { status: 400 }
      )
    }

    // Validate Search Console fields if enabled
    if (search_console_enabled) {
      if (!search_console_property_url || !search_console_client_email || !search_console_private_key) {
        return NextResponse.json(
          { error: 'Search Console mezők kitöltése kötelező, ha az integráció engedélyezve van' },
          { status: 400 }
        )
      }
    }

    // Create connection
    const { data, error } = await supabase
      .from('webshop_connections')
      .insert({
        name: name.trim(),
        connection_type,
        api_url: api_url.trim(),
        username: username.trim(),
        password, // TODO: Encrypt in production
        is_active: is_active !== false,
        search_console_property_url: search_console_enabled ? search_console_property_url?.trim() || null : null,
        search_console_client_email: search_console_enabled ? search_console_client_email?.trim() || null : null,
        search_console_private_key: search_console_enabled ? search_console_private_key || null : null,
        search_console_enabled: search_console_enabled || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating connection:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a kapcsolat létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, connection: data }, { status: 201 })
  } catch (error) {
    console.error('Error creating connection:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
