'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export interface ConnectionFormData {
  name: string
  connection_type: 'shoprenter' | 'unas' | 'shopify'
  api_url: string
  username: string
  password: string
  is_active?: boolean
  search_console_property_url?: string
  search_console_client_email?: string
  search_console_private_key?: string
  search_console_enabled?: boolean
}

// Create connection action
export async function createConnectionAction(formData: ConnectionFormData) {
  try {
    const { 
      name, 
      connection_type, 
      api_url, 
      username, 
      password, 
      is_active = true,
      search_console_property_url,
      search_console_client_email,
      search_console_private_key,
      search_console_enabled = false
    } = formData

    if (!name || !connection_type || !api_url || !username || !password) {
      return { success: false, error: 'Minden mező kitöltése kötelező' }
    }

    // Validate Search Console fields if enabled
    if (search_console_enabled) {
      if (!search_console_property_url || !search_console_client_email || !search_console_private_key) {
        return { success: false, error: 'Search Console mezők kitöltése kötelező, ha az integráció engedélyezve van' }
      }
    }

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

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // TODO: Encrypt password in production
    const { data, error } = await supabase
      .from('webshop_connections')
      .insert({
        name: name.trim(),
        connection_type,
        api_url: api_url.trim(),
        username: username.trim(),
        password, // Store as-is for now (TODO: encrypt)
        is_active,
        search_console_property_url: search_console_enabled ? search_console_property_url?.trim() || null : null,
        search_console_client_email: search_console_enabled ? search_console_client_email?.trim() || null : null,
        search_console_private_key: search_console_enabled ? search_console_private_key || null : null,
        search_console_enabled: search_console_enabled || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating connection:', error)
      return { success: false, error: error.message || 'Hiba a kapcsolat létrehozásakor' }
    }

    revalidatePath('/connections')
    return { success: true, connection: data }
  } catch (error) {
    console.error('Error creating connection:', error)
    return { success: false, error: 'Hiba a kapcsolat létrehozásakor' }
  }
}

// Update connection action
export async function updateConnectionAction(id: string, formData: ConnectionFormData) {
  try {
    const { 
      name, 
      connection_type, 
      api_url, 
      username, 
      password, 
      is_active = true,
      search_console_property_url,
      search_console_client_email,
      search_console_private_key,
      search_console_enabled = false
    } = formData

    if (!name || !connection_type || !api_url || !username) {
      return { success: false, error: 'Alap mezők kitöltése kötelező' }
    }

    // Validate Search Console fields if enabled
    if (search_console_enabled) {
      if (!search_console_property_url || !search_console_client_email) {
        return { success: false, error: 'Search Console property URL és client email kötelező, ha az integráció engedélyezve van' }
      }
    }

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

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get existing connection to check if password/private key needs to be updated
    const { data: existingConnection } = await supabase
      .from('webshop_connections')
      .select('password, search_console_private_key')
      .eq('id', id)
      .single()

    // Build update object
    const updateData: any = {
      name: name.trim(),
      connection_type,
      api_url: api_url.trim(),
      username: username.trim(),
      is_active,
      search_console_property_url: search_console_enabled ? search_console_property_url?.trim() || null : null,
      search_console_client_email: search_console_enabled ? search_console_client_email?.trim() || null : null,
      search_console_enabled: search_console_enabled || false,
      updated_at: new Date().toISOString()
    }

    // Only update password if provided (not empty)
    if (password && password.trim().length > 0) {
      updateData.password = password // TODO: Encrypt in production
    } else if (!existingConnection?.password) {
      // If no password provided and no existing password, it's an error
      return { success: false, error: 'Jelszó megadása kötelező, ha még nincs beállítva' }
    }
    // If password not provided but exists, keep the existing one (don't update)

    // Only update private key if provided (not empty)
    if (search_console_enabled) {
      if (search_console_private_key && search_console_private_key.trim().length > 0) {
        updateData.search_console_private_key = search_console_private_key
      } else if (!existingConnection?.search_console_private_key) {
        // If enabled but no existing key and no new key provided, it's an error
        return { success: false, error: 'Search Console private key kötelező, ha az integráció engedélyezve van és még nincs beállítva' }
      }
      // If private key not provided but exists, keep the existing one (don't update)
    } else {
      // If disabled, clear Search Console fields
      updateData.search_console_property_url = null
      updateData.search_console_client_email = null
      updateData.search_console_private_key = null
    }

    // TODO: Encrypt password in production
    const { data, error } = await supabase
      .from('webshop_connections')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      console.error('Error updating connection:', error)
      return { success: false, error: error.message || 'Hiba a kapcsolat frissítésekor' }
    }

    revalidatePath('/connections')
    return { success: true, connection: data }
  } catch (error) {
    console.error('Error updating connection:', error)
    return { success: false, error: 'Hiba a kapcsolat frissítésekor' }
  }
}

// Delete connections action (soft delete)
export async function deleteConnectionsAction(connectionIds: string[]) {
  try {
    if (!connectionIds || connectionIds.length === 0) {
      return { success: false, error: 'Nincs kiválasztott kapcsolat' }
    }

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

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('webshop_connections')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', connectionIds)

    if (deleteError) {
      console.error('Error deleting connections:', deleteError)
      return { success: false, error: 'Hiba a kapcsolatok törlésekor' }
    }

    revalidatePath('/connections')
    return { success: true, count: connectionIds.length }
  } catch (error) {
    console.error('Error deleting connections:', error)
    return { success: false, error: 'Hiba a kapcsolatok törlésekor' }
  }
}
