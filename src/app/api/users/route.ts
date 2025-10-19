import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all users from the public.users table (excluding soft deleted)
    // First try with deleted_at column, fallback to basic query if column doesn't exist
    let users, error;
    
    try {
      const result = await supabase
        .from('users')
        .select('id, email, full_name, created_at, last_sign_in_at, deleted_at')
        .is('deleted_at', null) // Only get non-deleted users
        .order('created_at', { ascending: false });
      
      users = result.data;
      error = result.error;
    } catch (columnError) {
      // Fallback: column doesn't exist yet, get all users
      const result = await supabase
        .from('users')
        .select('id, email, full_name, created_at, last_sign_in_at')
        .order('created_at', { ascending: false });
      
      users = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    return NextResponse.json(users || [])
    
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, password, full_name } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Create Supabase Admin client for user creation
    const { createClient } = await import('@supabase/supabase-js')
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set')
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
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

    console.log('Attempting to create user with email:', email)

    // Use admin API to create user with email already confirmed
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email - user can login immediately
      user_metadata: {
        full_name: full_name || ''
      }
    })

    if (authError) {
      console.error('Error creating user in auth:', authError)
      console.error('Auth error details:', {
        message: authError.message,
        status: authError.status,
        code: authError.code,
        details: authError.details
      })
      return NextResponse.json({ 
        error: authError.message,
        details: authError.details,
        code: authError.code,
        status: authError.status
      }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    console.log('User created successfully with admin API:', authData.user.id)

    return NextResponse.json({ 
      message: 'User created successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name: full_name || '',
        created_at: authData.user.created_at
      }
    })
    
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userIds } = body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'User IDs are required' }, { status: 400 })
    }

    // Create admin client to disable users in auth.users
    const { createClient } = await import('@supabase/supabase-js')
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set')
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
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

    try {
      // Step 1: Soft delete users from public.users
      const { error: deleteError } = await supabase
        .from('users')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', userIds);

      if (deleteError) {
        console.error('Error soft deleting users:', deleteError)
        return NextResponse.json({ error: 'Failed to delete users' }, { status: 500 })
      }

      // Step 2: Ban users in auth.users so they can't login
      // Ban for 876000 hours (approximately 100 years - effectively permanent)
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
        console.warn(`Failed to ban ${failedBans.length} users in auth.users`)
      }

      console.log(`Successfully soft deleted and banned ${userIds.length} user(s)`)

      return NextResponse.json({ 
        message: `${userIds.length} user(s) deleted successfully` 
      });
    } catch (tableError) {
      console.log('Error during user deletion:', tableError);
      return NextResponse.json({ 
        error: 'Failed to delete users',
        details: tableError instanceof Error ? tableError.message : 'Unknown error'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error deleting users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}