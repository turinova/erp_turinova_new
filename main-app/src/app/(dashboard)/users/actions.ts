'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Create user action
export async function createUserAction(formData: { email: string; password: string; full_name?: string }) {
  try {
    const { email, password, full_name } = formData

    if (!email || !password) {
      return { success: false, error: 'Email és jelszó megadása kötelező' }
    }

    // Create admin client
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { success: false, error: 'Service role key not configured' }
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || ''
      }
    })

    if (authError) {
      return { success: false, error: authError.message }
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' }
    }

    revalidatePath('/users')
    return { success: true, user: authData.user }
  } catch (error) {
    console.error('Error creating user:', error)
    return { success: false, error: 'Hiba a felhasználó létrehozásakor' }
  }
}

// Delete users action
export async function deleteUsersAction(userIds: string[]) {
  try {
    if (!userIds || userIds.length === 0) {
      return { success: false, error: 'Nincs kiválasztott felhasználó' }
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Create admin client
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { success: false, error: 'Service role key not configured' }
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Soft delete from public.users
    const { error: deleteError } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', userIds)

    if (deleteError) {
      return { success: false, error: 'Failed to delete users' }
    }

    // Ban users in auth.users
    const banResults = await Promise.allSettled(
      userIds.map(userId =>
        supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
      )
    )

    const failedBans = banResults.filter(result =>
      result.status === 'rejected' ||
      (result.status === 'fulfilled' && result.value.error)
    )

    if (failedBans.length > 0) {
      console.warn(`Failed to ban ${failedBans.length} users`)
    }

    revalidatePath('/users')
    return { success: true, count: userIds.length }
  } catch (error) {
    console.error('Error deleting users:', error)
    return { success: false, error: 'Hiba a felhasználók törlésekor' }
  }
}

// Update user permission action
export async function updatePermissionAction(
  userId: string,
  pagePath: string,
  canAccess: boolean
) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Get page ID
    const { data: page, error: pageError } = await supabase
      .from('pages')
      .select('id')
      .eq('path', pagePath)
      .single()

    if (pageError || !page) {
      return { success: false, error: 'Page not found' }
    }

    // Update permission
    const { error } = await supabase
      .from('user_permissions')
      .upsert({
        user_id: userId,
        page_id: page.id,
        can_access: canAccess
      }, {
        onConflict: 'user_id,page_id'
      })

    if (error) {
      return { success: false, error: 'Failed to update permission' }
    }

    // Note: revalidatePath removed for performance - batch API handles this
    return { success: true }
  } catch (error) {
    console.error('Error updating permission:', error)
    return { success: false, error: 'Hiba a jogosultság frissítésekor' }
  }
}

