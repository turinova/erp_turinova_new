import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// GET /api/permissions/individual/user/[userId] - Get individual user permissions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const supabase = createServerClient()

    // Fetch user's individual permissions
    const { data: permissions, error } = await supabase
      .from('user_permissions')
      .select(`
        *,
        pages (
          id,
          path,
          name,
          description,
          category
        )
      `)
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching individual permissions:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch permissions',
        permissions: [] 
      }, { status: 500 })
    }

    // Transform the data to match our interface
    const transformedPermissions = permissions?.map(p => ({
      user_id: p.user_id,
      page_id: p.page_id,
      page_path: p.pages?.path || '',
      page_name: p.pages?.name || '',
      can_view: p.can_view || false,
      can_edit: p.can_edit || false,
      can_delete: p.can_delete || false
    })) || []

    return NextResponse.json({ permissions: transformedPermissions })
  } catch (error) {
    console.error('Error in individual permissions GET:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      permissions: [] 
    }, { status: 500 })
  }
}

// PUT /api/permissions/individual/user/[userId] - Update individual user permissions
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const body = await request.json()
    const { permissions } = body

    if (!permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ error: 'Invalid permissions data' }, { status: 400 })
    }

    const supabase = createServerClient()

    // Delete existing permissions for this user
    const { error: deleteError } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error deleting existing permissions:', deleteError)
      return NextResponse.json({ error: 'Failed to clear existing permissions' }, { status: 500 })
    }

    // Insert new permissions
    const permissionsToInsert = permissions.map((p: any) => ({
      user_id: userId,
      page_id: p.page_id,
      can_view: p.can_view || false,
      can_edit: p.can_edit || false,
      can_delete: p.can_delete || false
    }))

    const { error: insertError } = await supabase
      .from('user_permissions')
      .insert(permissionsToInsert)

    if (insertError) {
      console.error('Error inserting new permissions:', insertError)
      return NextResponse.json({ error: 'Failed to save permissions' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Permissions updated successfully' 
    })
  } catch (error) {
    console.error('Error in individual permissions PUT:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
