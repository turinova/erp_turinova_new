import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { createClient } from '@supabase/supabase-js'

import type { CreateUserRequest, UserFilters } from '@/types/user'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseServiceKey

if (!isSupabaseConfigured) {
  console.warn('Supabase not configured for users API. Some features may not work.')
}

const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseServiceKey!) : null

// GET /api/users - Get all users
export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const role = searchParams.get('role')
    const is_active = searchParams.get('is_active')

    // Use Supabase Admin API to get users
    const { data: users, error } = await supabase.auth.admin.listUsers()

    if (error) {
      console.error('Error fetching users:', error)
      
return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Transform and filter the data
    let transformedUsers = users.users?.map(user => ({
      id: user.id,
      email: user.email!,
      full_name: user.user_metadata?.full_name || '',
      phone: user.user_metadata?.phone || '',
      role: user.user_metadata?.role || 'user',
      is_active: !!user.email_confirmed_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_sign_in_at: user.last_sign_in_at
    })) || []

    // Apply filters
    if (search) {
      transformedUsers = transformedUsers.filter(user => 
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        user.full_name.toLowerCase().includes(search.toLowerCase())
      )
    }

    if (role) {
      transformedUsers = transformedUsers.filter(user => user.role === role)
    }

    if (is_active !== null) {
      const activeFilter = is_active === 'true'

      transformedUsers = transformedUsers.filter(user => user.is_active === activeFilter)
    }

    // Sort by created_at descending
    transformedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({ users: transformedUsers })
  } catch (error) {
    console.error('Error in GET /api/users:', error)
    
return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }

    const body: CreateUserRequest = await request.json()
    const { email, password, full_name, phone, role, is_active = true } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: is_active,
      user_metadata: {
        full_name,
        phone,
        role: role || 'user'
      }
    })

    if (authError) {
      console.error('Error creating user:', authError)
      
return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Transform the response
    const user = {
      id: authData.user.id,
      email: authData.user.email!,
      full_name: authData.user.user_metadata?.full_name || '',
      phone: authData.user.user_metadata?.phone || '',
      role: authData.user.user_metadata?.role || 'user',
      is_active: !!authData.user.email_confirmed_at,
      created_at: authData.user.created_at,
      updated_at: authData.user.updated_at,
      last_sign_in_at: authData.user.last_sign_in_at
    }

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/users:', error)
    
return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
