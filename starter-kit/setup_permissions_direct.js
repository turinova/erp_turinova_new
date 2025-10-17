// Direct database setup script
// Run this with: node setup_permissions_direct.js

const { createClient } = require('@supabase/supabase-js')

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupPermissions() {
  try {
    console.log('Setting up permission system...')

    // Create pages table
    console.log('Creating pages table...')
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
    } else {
      console.log('✅ Pages table created')
    }

    // Create user_permissions table
    console.log('Creating user_permissions table...')
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
    } else {
      console.log('✅ User permissions table created')
    }

    // Insert default pages
    console.log('Inserting default pages...')
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
    } else {
      console.log('✅ Default pages inserted')
    }

    // Get all users and give first user admin permissions
    console.log('Setting up user permissions...')
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      console.error('Error fetching users:', usersError)
    } else if (users.users.length > 0) {
      const firstUser = users.users[0]
      console.log(`Setting up permissions for first user: ${firstUser.email}`)

      // Get all pages
      const { data: pages, error: pagesFetchError } = await supabase
        .from('pages')
        .select('id')
        .eq('is_active', true)

      if (pagesFetchError) {
        console.error('Error fetching pages:', pagesFetchError)
      } else {
        // Give admin permissions to first user
        const permissions = pages.map(page => ({
          user_id: firstUser.id,
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
        } else {
          console.log('✅ Admin permissions set for first user')
        }
      }
    }

    console.log('🎉 Permission system setup complete!')
    console.log('You can now use the permission management system.')

  } catch (error) {
    console.error('Error setting up permissions:', error)
  }
}

setupPermissions()
