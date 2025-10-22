import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { createClient } from '@supabase/supabase-js'

import type { UpdateUserRequest } from '@/types/user'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseServiceKey

if (!isSupabaseConfigured) {
  console.warn('Supabase not configured for users/[id] API')
}

const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseServiceKey!) : null

// GET /api/users/[id] - Get a specific user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }

    const { id } = await params

    const { data: user, error } = await supabase.auth.admin.getUserById(id)

    if (error) {
      console.error('Error fetching user:', error)
      
return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Transform the response
    const transformedUser = {
      id: user.user.id,
      email: user.user.email!,
      full_name: user.user.user_metadata?.full_name || '',
      phone: user.user.user_metadata?.phone || '',
      role: user.user.user_metadata?.role || 'user',
      is_active: !!user.user.email_confirmed_at,
      created_at: user.user.created_at,
      updated_at: user.user.updated_at,
      last_sign_in_at: user.user.last_sign_in_at
    }

    return NextResponse.json({ user: transformedUser })
  } catch (error) {
    console.error('Error in GET /api/users/[id]:', error)
    
return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/users/[id] - Update a user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }

    const { id } = await params
    const body: UpdateUserRequest = await request.json()
    const { email, password, full_name, phone, role, is_active } = body

    // Get current user first to preserve existing metadata
    const { data: currentUser } = await supabase.auth.admin.getUserById(id)
    const currentMetadata = currentUser?.user?.user_metadata || {}

    // Prepare update data
    const updateData: any = {}
    
    if (email !== undefined) updateData.email = email
    if (password !== undefined && password.trim() !== '') updateData.password = password
    
    // Merge user metadata
    const newMetadata = { ...currentMetadata }

    if (full_name !== undefined) newMetadata.full_name = full_name
    if (phone !== undefined) newMetadata.phone = phone
    if (role !== undefined) newMetadata.role = role
    
    if (Object.keys(newMetadata).length > 0) {
      updateData.user_metadata = newMetadata
    }
    
    if (is_active !== undefined) {
      updateData.email_confirm = is_active
    }

    const { data: user, error } = await supabase.auth.admin.updateUserById(id, updateData)

    if (error) {
      console.error('Error updating user:', error)
      
return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Transform the response
    const transformedUser = {
      id: user.user.id,
      email: user.user.email!,
      full_name: user.user.user_metadata?.full_name || '',
      phone: user.user.user_metadata?.phone || '',
      role: user.user.user_metadata?.role || 'user',
      is_active: !!user.user.email_confirmed_at,
      created_at: user.user.created_at,
      updated_at: user.user.updated_at,
      last_sign_in_at: user.user.last_sign_in_at
    }

    return NextResponse.json({ user: transformedUser })
  } catch (error) {
    console.error('Error in PUT /api/users/[id]:', error)
    
return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/users/[id] - Delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { error } = await supabase.auth.admin.deleteUser(id)

    if (error) {
      console.error('Error deleting user:', error)
      
return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/users/[id]:', error)
    
return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
