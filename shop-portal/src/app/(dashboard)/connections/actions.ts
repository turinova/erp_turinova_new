'use server'

import { revalidatePath } from 'next/cache'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { normalizeSzamlazzApiUrl } from '@/lib/szamlazz-agent'

function parseBufferAutoProformaDueDays(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return 8
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  if (!Number.isFinite(n)) return 8
  return Math.min(365, Math.max(0, Math.round(n)))
}

export interface ConnectionFormData {
  name: string
  connection_type: 'shoprenter' | 'szamlazz'
  api_url?: string
  username?: string
  password?: string
  agent_key?: string // For szamlazz.hu
  is_active?: boolean
  /** Számlázz: automatikus díjbekérő puffer import után (fizetési mód flaggel együtt) */
  buffer_auto_proforma_enabled?: boolean
  /** Számlázz: díjbekérő fizetési határideje = kiállítás + ennyi nap (0–365, alap 8) */
  buffer_auto_proforma_due_days?: number
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
      buffer_auto_proforma_enabled = false,
      buffer_auto_proforma_due_days,
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
      if (!String(agent_key || '').trim()) {
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

    const dueDays = parseBufferAutoProformaDueDays(buffer_auto_proforma_due_days)

    // Build credentials for matching / restore
    let matchApiUrl = ''
    let matchUsername = ''
    let matchPassword: string = ''

    if (connection_type === 'shoprenter') {
      matchApiUrl = api_url!.trim()
      matchUsername = username!.trim()
      matchPassword = password!
    } else if (connection_type === 'szamlazz') {
      matchPassword = String(agent_key).trim()
    }

    // Check if deleted connection exists with same credentials (restoration)
    let deletedConnection: { id: string; [key: string]: unknown } | null = null
    let checkError: { code?: string; message?: string } | null = null

    if (connection_type === 'shoprenter') {
      const res = await supabase
        .from('webshop_connections')
        .select('*')
        .eq('connection_type', connection_type)
        .eq('api_url', matchApiUrl)
        .eq('username', matchUsername)
        .eq('password', matchPassword)
        .not('deleted_at', 'is', null)
        .maybeSingle()
      deletedConnection = res.data
      checkError = res.error
    } else if (connection_type === 'szamlazz') {
      const res = await supabase
        .from('webshop_connections')
        .select('*')
        .eq('connection_type', 'szamlazz')
        .eq('username', '')
        .eq('password', matchPassword)
        .not('deleted_at', 'is', null)
        .maybeSingle()
      deletedConnection = res.data
      checkError = res.error
    }

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking for deleted connection:', checkError)
      // Continue with creation if check fails
    }

    let connectionData
    let isRestored = false

    if (deletedConnection) {
      // Restore deleted connection instead of creating new one
      const updateData: any = {
        deleted_at: null,
        name: name.trim(),
        is_active,
        updated_at: new Date().toISOString()
      }

      if (connection_type === 'shoprenter') {
        updateData.search_console_enabled = search_console_enabled && connection_type === 'shoprenter' ? true : false
        updateData.search_console_property_url = search_console_enabled ? search_console_property_url?.trim() || null : null
        updateData.search_console_client_email = search_console_enabled ? search_console_client_email?.trim() || null : null
        updateData.search_console_private_key = search_console_enabled ? search_console_private_key || null : null
      } else if (connection_type === 'szamlazz') {
        updateData.api_url = normalizeSzamlazzApiUrl(api_url)
        updateData.password = matchPassword
        updateData.username = ''
        updateData.buffer_auto_proforma_enabled = Boolean(buffer_auto_proforma_enabled)
        updateData.buffer_auto_proforma_due_days = dueDays
      }

      const { data: restoredConnection, error: restoreError } = await supabase
        .from('webshop_connections')
        .update(updateData)
        .eq('id', deletedConnection.id)
        .select()
        .single()

      if (restoreError) {
        console.error('Error restoring connection:', restoreError)
        return { success: false, error: restoreError.message || 'Hiba a kapcsolat visszaállításakor' }
      }

      connectionData = restoredConnection
      isRestored = true
    } else {
      // Create new connection
      const insertData: any = {
        name: name.trim(),
        connection_type,
        is_active,
        search_console_enabled: search_console_enabled && connection_type === 'shoprenter' ? true : false
      }

      if (connection_type === 'shoprenter') {
        insertData.api_url = matchApiUrl
        insertData.username = matchUsername
        insertData.password = matchPassword // Store as-is for now (TODO: encrypt)
        insertData.search_console_property_url = search_console_enabled ? search_console_property_url?.trim() || null : null
        insertData.search_console_client_email = search_console_enabled ? search_console_client_email?.trim() || null : null
        insertData.search_console_private_key = search_console_enabled ? search_console_private_key || null : null
      } else if (connection_type === 'szamlazz') {
        insertData.api_url = normalizeSzamlazzApiUrl(api_url)
        insertData.username = ''
        insertData.password = matchPassword
        insertData.buffer_auto_proforma_enabled = Boolean(buffer_auto_proforma_enabled)
        insertData.buffer_auto_proforma_due_days = dueDays
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

      connectionData = data
    }

    revalidatePath('/connections')
    return { 
      success: true, 
      connection: connectionData,
      restored: isRestored
    }
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
      buffer_auto_proforma_enabled = false,
      buffer_auto_proforma_due_days,
      search_console_property_url,
      search_console_client_email,
      search_console_private_key,
      search_console_enabled = false
    } = formData

    if (!name || !connection_type) {
      return { success: false, error: 'A kapcsolat neve és típusa kötelező' }
    }

    const dueDaysUpdate = parseBufferAutoProformaDueDays(buffer_auto_proforma_due_days)

    // Validate based on connection type
    if (connection_type === 'shoprenter') {
      if (!api_url || !username) {
        return { success: false, error: 'ShopRenter kapcsolathoz az API URL és Client ID kötelező' }
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

    if (connection_type === 'szamlazz') {
      const trimmedKey = String(agent_key || '').trim()
      if (!trimmedKey && !existingConnection?.password) {
        return {
          success: false,
          error: 'Szamlazz.hu: adja meg az Agent Key-t, vagy hagyja a meglévő kulcsot.'
        }
      }
    }

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
      updateData.api_url = normalizeSzamlazzApiUrl(api_url)
      updateData.username = ''
      updateData.search_console_enabled = false
      updateData.search_console_property_url = null
      updateData.search_console_client_email = null
      updateData.search_console_private_key = null
      updateData.buffer_auto_proforma_enabled = Boolean(buffer_auto_proforma_enabled)
      updateData.buffer_auto_proforma_due_days = dueDaysUpdate
      const trimmedKey = String(agent_key || '').trim()
      if (trimmedKey) {
        updateData.password = trimmedKey
      }
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
