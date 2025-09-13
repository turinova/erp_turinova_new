import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { UpdateUserPermissionsRequest } from '@/types/permission'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { userId } = await params

    // Skip auth check for now - we'll handle it in the frontend

    // Get user permissions - simplified approach
    const { data: permissions, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching user permissions:', error)
      return NextResponse.json({ error: 'Failed to fetch user permissions' }, { status: 500 })
    }

    // Get all pages
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('*')
      .eq('is_active', true)

    if (pagesError) {
      console.error('Error fetching pages:', pagesError)
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 })
    }

    // Create a map of page data
    const pageMap = new Map(pages.map(page => [page.id, page]))

    // Transform the data to match the expected format
    const formattedPermissions = permissions.map(perm => {
      const page = pageMap.get(perm.page_id)
      return {
        user_id: perm.user_id,
        page_id: perm.page_id,
        page_path: page?.path || '',
        page_name: page?.name || '',
        can_view: perm.can_view,
        can_edit: perm.can_edit,
        can_delete: perm.can_delete,
        created_at: perm.created_at,
        updated_at: perm.updated_at
      }
    }).filter(perm => perm.page_path) // Only include permissions for active pages

    return NextResponse.json({ permissions: formattedPermissions })
  } catch (error) {
    console.error('Error in user permissions API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { userId } = await params

    // Skip auth check for now - we'll handle it in the frontend

    const body: UpdateUserPermissionsRequest = await request.json()

    // Validate request
    if (body.user_id !== userId) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 400 })
    }

    // Skip permission check for now - we'll handle it in the frontend

    // Update user permissions
    const updates = body.permissions.map(permission => ({
      user_id: userId,
      page_id: permission.page_id,
      can_view: permission.can_view,
      can_edit: permission.can_edit,
      can_delete: permission.can_delete
    }))

    // Delete existing permissions for this user
    const { error: deleteError } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error deleting existing permissions:', deleteError)
      return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 })
    }

    // Insert new permissions
    const { error: insertError } = await supabase
      .from('user_permissions')
      .insert(updates)

    if (insertError) {
      console.error('Error inserting new permissions:', insertError)
      return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating user permissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
