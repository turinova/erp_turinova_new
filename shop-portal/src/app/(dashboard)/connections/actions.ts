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
}

// Create connection action
export async function createConnectionAction(formData: ConnectionFormData) {
  try {
    const { name, connection_type, api_url, username, password, is_active = true } = formData

    if (!name || !connection_type || !api_url || !username || !password) {
      return { success: false, error: 'Minden mező kitöltése kötelező' }
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
        is_active
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
    const { name, connection_type, api_url, username, password, is_active = true } = formData

    if (!name || !connection_type || !api_url || !username || !password) {
      return { success: false, error: 'Minden mező kitöltése kötelező' }
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
      .update({
        name: name.trim(),
        connection_type,
        api_url: api_url.trim(),
        username: username.trim(),
        password, // Store as-is for now (TODO: encrypt)
        is_active,
        updated_at: new Date().toISOString()
      })
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
