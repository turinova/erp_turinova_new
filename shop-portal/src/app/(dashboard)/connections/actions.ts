'use server'

import { revalidatePath } from 'next/cache'
import { getTenantSupabase } from '@/lib/tenant-supabase'

export interface ConnectionFormData {
  name: string
  connection_type: 'shoprenter' | 'szamlazz'
  api_url?: string
  username?: string
  password?: string
  agent_key?: string // For szamlazz.hu
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
      agent_key,
      is_active = true,
      search_console_property_url,
      search_console_client_email,
      search_console_private_key,
      search_console_enabled = false
    } = formData

    if (!name || !connection_type) {
      return { success: false, error: 'A kapcsolat neve és típusa kötelező' }
    }

    // Validate based on connection type
    if (connection_type === 'shoprenter') {
      if (!api_url || !username || !password) {
        return { success: false, error: 'ShopRenter kapcsolathoz az API URL, Client ID és Client Secret kötelező' }
      }
    } else if (connection_type === 'szamlazz') {
      if (!agent_key) {
        return { success: false, error: 'Szamlazz.hu kapcsolathoz az Agent Key kötelező' }
      }
    }

    // Validate Search Console fields if enabled (only for ShopRenter)
    if (search_console_enabled && connection_type === 'shoprenter') {
      if (!search_console_property_url || !search_console_client_email || !search_console_private_key) {
        return { success: false, error: 'Search Console mezők kitöltése kötelező, ha az integráció engedélyezve van' }
      }
    }

    // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Build insert data based on connection type
    const insertData: any = {
      name: name.trim(),
      connection_type,
      is_active,
      search_console_enabled: search_console_enabled && connection_type === 'shoprenter' ? true : false
    }

    if (connection_type === 'shoprenter') {
      insertData.api_url = api_url!.trim()
      insertData.username = username!.trim()
      insertData.password = password // Store as-is for now (TODO: encrypt)
      insertData.search_console_property_url = search_console_enabled ? search_console_property_url?.trim() || null : null
      insertData.search_console_client_email = search_console_enabled ? search_console_client_email?.trim() || null : null
      insertData.search_console_private_key = search_console_enabled ? search_console_private_key || null : null
    } else if (connection_type === 'szamlazz') {
      // For szamlazz, store agent_key in password field (temporary solution until schema is updated)
      insertData.api_url = '' // Not used for szamlazz
      insertData.username = '' // Not used for szamlazz
      insertData.password = agent_key // Store agent_key in password field for now
    }

    // TODO: Encrypt password/agent_key in production
    const { data, error } = await supabase
      .from('webshop_connections')
      .insert(insertData)
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
      agent_key,
      is_active = true,
      search_console_property_url,
      search_console_client_email,
      search_console_private_key,
      search_console_enabled = false
    } = formData

    if (!name || !connection_type) {
      return { success: false, error: 'A kapcsolat neve és típusa kötelező' }
    }

    // Validate based on connection type
    if (connection_type === 'shoprenter') {
      if (!api_url || !username) {
        return { success: false, error: 'ShopRenter kapcsolathoz az API URL és Client ID kötelező' }
      }
    } else if (connection_type === 'szamlazz') {
      if (!agent_key) {
        return { success: false, error: 'Szamlazz.hu kapcsolathoz az Agent Key kötelező' }
      }
    }

    // Validate Search Console fields if enabled (only for ShopRenter)
    if (search_console_enabled && connection_type === 'shoprenter') {
      if (!search_console_property_url || !search_console_client_email) {
        return { success: false, error: 'Search Console property URL és client email kötelező, ha az integráció engedélyezve van' }
      }
    }

    // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get existing connection to check if password/private key needs to be updated
    const { data: existingConnection } = await supabase
      .from('webshop_connections')
      .select('password, search_console_private_key, connection_type')
      .eq('id', id)
      .single()

    // Build update object
    const updateData: any = {
      name: name.trim(),
      connection_type,
      is_active,
      updated_at: new Date().toISOString()
    }

    if (connection_type === 'shoprenter') {
      updateData.api_url = api_url!.trim()
      updateData.username = username!.trim()
      updateData.search_console_enabled = search_console_enabled || false
      updateData.search_console_property_url = search_console_enabled ? search_console_property_url?.trim() || null : null
      updateData.search_console_client_email = search_console_enabled ? search_console_client_email?.trim() || null : null

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
    } else if (connection_type === 'szamlazz') {
      // For szamlazz, store agent_key in password field (temporary solution until schema is updated)
      updateData.api_url = '' // Not used for szamlazz
      updateData.username = '' // Not used for szamlazz
      updateData.password = agent_key // Store agent_key in password field
      updateData.search_console_enabled = false
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

    // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
    const supabase = await getTenantSupabase()

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
