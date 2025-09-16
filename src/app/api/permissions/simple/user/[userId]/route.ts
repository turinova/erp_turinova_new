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

// GET /api/permissions/simple/user/[userId] - Get simple user permissions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    console.log('Checking permissions for user:', userId)
    const supabase = createServerClient()

    // Fetch user's simple permissions
    const { data: permissions, error } = await supabase
      .from('user_permissions')
      .select('user_id, page_id, can_view')
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching simple permissions:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json({ 
        error: 'Failed to fetch permissions',
        permissions: [] 
      }, { status: 500 })
    }

    // First, fetch all pages to get their paths
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('id, path')
      .eq('is_active', true)

    if (pagesError) {
      console.error('Error fetching pages:', pagesError)
      console.error('Pages error details:', JSON.stringify(pagesError, null, 2))
      return NextResponse.json({ 
        error: 'Failed to fetch pages',
        permissions: [] 
      }, { status: 500 })
    }

    // Create a map of page IDs to paths
    const pageIdToPath: { [key: string]: string } = {}
    pages?.forEach(page => {
      pageIdToPath[page.id] = page.path
    })

    // Transform to simple format - just can_access based on can_view
    const transformedPermissions = permissions?.map(p => ({
      user_id: p.user_id,
      page_path: pageIdToPath[p.page_id] || `/page-${p.page_id}`,
      can_access: p.can_view || false
    })) || []

    console.log('Transformed permissions:', transformedPermissions)
    console.log('Available pages:', Object.keys(pageIdToPath))
    
    return NextResponse.json({ permissions: transformedPermissions })
  } catch (error) {
    console.error('Error in simple permissions GET:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      permissions: [] 
    }, { status: 500 })
  }
}

// PUT /api/permissions/simple/user/[userId] - Update simple user permissions
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

    // First, fetch all pages to get their actual UUIDs
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('id, path')
      .eq('is_active', true)

    if (pagesError) {
      console.error('Error fetching pages:', pagesError)
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 })
    }

    // Create a map of page paths to actual UUIDs
    const pagePathToId: { [key: string]: string } = {}
    pages?.forEach(page => {
      pagePathToId[page.path] = page.id
    })

    const permissionsToInsert = permissions.map((p: any) => {
      const pageId = pagePathToId[p.page_path]
      return {
        user_id: userId,
        page_id: pageId,
        can_view: p.can_access || false,
        can_edit: false, // Always false for simple system
        can_delete: false // Always false for simple system
      }
    }).filter(p => p.page_id) // Only include valid page IDs

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
    console.error('Error in simple permissions PUT:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}