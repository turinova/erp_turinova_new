import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const createServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Check if user has permission to access a specific page
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const pagePath = searchParams.get('pagePath')
    
    if (!userId || !pagePath) {
      return NextResponse.json({ error: 'Missing userId or pagePath' }, { status: 400 })
    }
    
    const supabase = createServerClient()
    
    // Check if user has permission for this page
    const { data: permission, error } = await supabase
      .from('user_permissions')
      .select(`
        can_view,
        pages!inner (
          path
        )
      `)
      .eq('user_id', userId)
      .eq('pages.path', pagePath)
      .single()
    
    if (error) {
      // If no permission found, user doesn't have access
      return NextResponse.json({ 
        hasAccess: false, 
        message: 'No permission found for this page' 
      })
    }
    
    return NextResponse.json({ 
      hasAccess: permission.can_view,
      message: permission.can_view ? 'Access granted' : 'Access denied'
    })
  } catch (error) {
    console.error('Permission check error:', error)
    return NextResponse.json({ 
      hasAccess: false, 
      message: 'Error checking permissions' 
    }, { status: 500 })
  }
}