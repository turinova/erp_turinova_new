import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client for permissions
function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase not configured for permissions API')
    return null
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const supabase = createServerClient()
    
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }

    const { userId } = await params

    console.log(`Fetching permissions for user: ${userId}`)

    // Use server-side client to bypass RLS policies
    const supabaseServer = createServerClient()

    // First, check if the user exists in the auth system
    const { data: userData, error: userError } = await supabaseServer.auth.admin.getUserById(userId)
    
    if (userError || !userData.user) {
      console.log(`User ${userId} not found in auth system`)
      return NextResponse.json({ paths: [] }) // Return empty permissions for non-existent users
    }

    // Use the existing permission system structure
    // Based on the migration file, we have user_permissions table with user_id, page_id, can_view, can_edit, can_delete
    // and pages table with id, path
    const { data, error } = await supabaseServer
      .from('user_permissions')
      .select(`
        can_view,
        pages!inner(path)
      `)
      .eq('user_id', userId)
      .eq('can_view', true)

    console.log('Permission query result:', data, 'Error:', error)

    if (error) {
      console.error('Error fetching permissions:', error)
      // Don't return 500 error, just return empty permissions
      console.log(`Returning empty permissions for user ${userId} due to error`)
      return NextResponse.json({ paths: [] })
    }

    const paths = data?.map((item: any) => item.pages.path) || []
    
    console.log(`Fetched ${paths.length} allowed paths for user ${userId}:`, paths)
    
    return NextResponse.json({ paths })

  } catch (error) {
    console.error('Error in fetchUserPermissions:', error)
    // Don't return 500 error, just return empty permissions
    console.log(`Returning empty permissions for user ${userId} due to exception`)
    return NextResponse.json({ paths: [] })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const supabase = createServerClient()
    
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }

    const { userId } = await params
    const body = await request.json()
    const { permissions } = body // permissions should be an array of { path: string, can_view: boolean }

    console.log(`Updating permissions for user: ${userId}`, permissions)

    if (!permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ error: 'Permissions array is required' }, { status: 400 })
    }

    const supabaseServer = createServerClient()

    // First, get all available pages
    const { data: pages, error: pagesError } = await supabaseServer
      .from('pages')
      .select('id, path')

    if (pagesError) {
      console.error('Error fetching pages:', pagesError)
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 })
    }

    // Create a map of path to page_id
    const pathToPageId = new Map(pages.map(page => [page.path, page.id]))

    // Prepare permission records
    const permissionRecords = permissions.map(permission => {
      const pageId = pathToPageId.get(permission.path)
      if (!pageId) {
        throw new Error(`Page not found: ${permission.path}`)
      }
      return {
        user_id: userId,
        page_id: pageId,
        can_view: permission.can_view,
        can_edit: permission.can_edit || false,
        can_delete: permission.can_delete || false
      }
    })

    // Delete existing permissions for this user
    const { error: deleteError } = await supabaseServer
      .from('user_permissions')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error deleting existing permissions:', deleteError)
      return NextResponse.json({ error: 'Failed to delete existing permissions' }, { status: 500 })
    }

    // Insert new permissions
    const { error: insertError } = await supabaseServer
      .from('user_permissions')
      .insert(permissionRecords)

    if (insertError) {
      console.error('Error inserting new permissions:', insertError)
      return NextResponse.json({ error: 'Failed to insert new permissions' }, { status: 500 })
    }

    console.log(`Successfully updated permissions for user ${userId}`)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Permissions updated successfully',
      updatedPermissions: permissionRecords.length
    })

  } catch (error) {
    console.error('Error in updateUserPermissions:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
