import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: await cookies() })

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Setting up permission system...')

    // Create pages table
    const { error: pagesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS pages (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          path VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(100),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    if (pagesError) {
      console.error('Error creating pages table:', pagesError)
      return NextResponse.json({ error: 'Failed to create pages table' }, { status: 500 })
    }

    // Create user_permissions table
    const { error: permissionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_permissions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
          can_view BOOLEAN DEFAULT false,
          can_edit BOOLEAN DEFAULT false,
          can_delete BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, page_id)
        );
      `
    })

    if (permissionsError) {
      console.error('Error creating user_permissions table:', permissionsError)
      return NextResponse.json({ error: 'Failed to create user_permissions table' }, { status: 500 })
    }

    // Insert default pages
    const { error: insertError } = await supabase
      .from('pages')
      .upsert([
        { path: '/home', name: 'Főoldal', description: 'Rendszer főoldala', category: 'Általános' },
        { path: '/company', name: 'Cégadatok', description: 'Cégadatok kezelése', category: 'Törzsadatok' },
        { path: '/customers', name: 'Ügyfelek', description: 'Ügyfelek kezelése', category: 'Törzsadatok' },
        { path: '/vat', name: 'Adónemek', description: 'Adónemek kezelése', category: 'Törzsadatok' },
        { path: '/users', name: 'Felhasználók', description: 'Felhasználók kezelése', category: 'Rendszer' },
        { path: '/opti', name: 'Optimalizáló', description: 'Optimalizáló eszköz', category: 'Eszközök' },
        { path: '/optimalizalo', name: 'Optimalizáló', description: 'Optimalizáló eszköz', category: 'Eszközök' }
      ], { onConflict: 'path' })

    if (insertError) {
      console.error('Error inserting pages:', insertError)
      return NextResponse.json({ error: 'Failed to insert pages' }, { status: 500 })
    }

    // Get all pages
    const { data: pages, error: pagesFetchError } = await supabase
      .from('pages')
      .select('id')
      .eq('is_active', true)

    if (pagesFetchError) {
      console.error('Error fetching pages:', pagesFetchError)
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 })
    }

    // Give admin permissions to current user
    const permissions = pages.map(page => ({
      user_id: session.user.id,
      page_id: page.id,
      can_view: true,
      can_edit: true,
      can_delete: true
    }))

    const { error: permissionsInsertError } = await supabase
      .from('user_permissions')
      .upsert(permissions, { onConflict: 'user_id, page_id' })

    if (permissionsInsertError) {
      console.error('Error inserting user permissions:', permissionsInsertError)
      return NextResponse.json({ error: 'Failed to insert user permissions' }, { status: 500 })
    }

    console.log('✅ Permission system setup complete!')

    return NextResponse.json({ 
      message: 'Permission system setup complete!',
      pagesCreated: pages.length,
      permissionsSet: permissions.length
    })

  } catch (error) {
    console.error('Error setting up permissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
