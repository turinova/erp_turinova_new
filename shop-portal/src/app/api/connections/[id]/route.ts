import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

/**
 * GET /api/connections/[id]
 * Get a single connection by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const { data: connection, error } = await supabase
      .from('webshop_connections')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
      }
      console.error('Error fetching connection:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json(connection)
  } catch (error) {
    console.error('Error fetching connection:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/connections/[id]
 * Update a connection
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
      if (!search_console_property_url || !search_console_client_email) {
        return NextResponse.json(
          { error: 'Search Console property URL és client email kötelező, ha az integráció engedélyezve van' },
          { status: 400 }
        )
      }
      // Private key is only required if it's not already set (or if user wants to update it)
      // We'll check this by fetching the existing connection
    }

    // Get existing connection to check if private key needs to be updated
    const { data: existingConnection } = await supabase
      .from('webshop_connections')
      .select('search_console_private_key')
      .eq('id', id)
      .single()

    // Build update object
    const updateData: any = {
      name: name.trim(),
      connection_type,
      api_url: api_url.trim(),
      username: username.trim(),
      password, // TODO: Encrypt in production
      is_active: is_active !== false,
      search_console_property_url: search_console_enabled ? search_console_property_url?.trim() || null : null,
      search_console_client_email: search_console_enabled ? search_console_client_email?.trim() || null : null,
      search_console_enabled: search_console_enabled || false,
      updated_at: new Date().toISOString()
    }

    // Only update private key if provided (user wants to change it)
    if (search_console_enabled && search_console_private_key && search_console_private_key.trim().length > 0) {
      updateData.search_console_private_key = search_console_private_key
    } else if (search_console_enabled && !existingConnection?.search_console_private_key) {
      // If enabled but no existing key and no new key provided, it's an error
      return NextResponse.json(
        { error: 'Search Console private key kötelező, ha az integráció engedélyezve van és még nincs beállítva' },
        { status: 400 }
      )
    }
    // If private key not provided but exists, keep the existing one (don't update)

    // Update connection
    const { data, error } = await supabase
      .from('webshop_connections')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
      }
      console.error('Error updating connection:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a kapcsolat frissítésekor' },
        { status: 500 }
      )
    }

    revalidatePath('/connections')
    return NextResponse.json({ success: true, connection: data })
  } catch (error) {
    console.error('Error updating connection:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/connections/[id]
 * Soft delete a connection
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Soft delete
    const { error } = await supabase
      .from('webshop_connections')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
      }
      console.error('Error deleting connection:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a kapcsolat törlésekor' },
        { status: 500 }
      )
    }

    revalidatePath('/connections')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting connection:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
