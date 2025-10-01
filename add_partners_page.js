const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://xgkaviefifbllbmfbyfe.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhna2F2aWVmaWZibGxibWZieWZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE0NjE1MSwiZXhwIjoyMDcyNzIyMTUxfQ.-LslYzl8Mhl14UOIr19lSHAKxpuv_roxXM7SPZm3U5Y'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addPartnersPage() {
  try {
    // Add the partners page
    const { data: pageData, error: pageError } = await supabase
      .from('pages')
      .insert({
        path: '/partners',
        name: 'Beszállítók',
        description: 'Beszállítók kezelése',
        category: 'Törzsadatok'
      })
      .select()
      .single()

    if (pageError) {
      console.error('Error adding page:', pageError)
      return
    }

    console.log('Page added:', pageData)

    // Get all users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      console.error('Error getting users:', usersError)
      return
    }

    console.log('Found users:', users.users.length)

    // Give all users permission for the partners page
    for (const user of users.users) {
      const { error: permError } = await supabase
        .from('user_permissions')
        .insert({
          user_id: user.id,
          page_id: pageData.id,
          can_view: true,
          can_edit: true,
          can_delete: true
        })

      if (permError) {
        console.error(`Error adding permission for user ${user.id}:`, permError)
      } else {
        console.log(`Permission added for user ${user.email}`)
      }
    }

    console.log('Partners page and permissions added successfully!')
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

addPartnersPage()
