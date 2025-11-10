import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase not configured for pages API')
    return null
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// GET /api/pages - Get all pages with their actual UUIDs
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }

    // Fetch all pages with their actual UUIDs
    const { data: pages, error } = await supabase
      .from('pages')
      .select('id, path, name, description, category')
      .order('path')

    if (error) {
      console.error('Error fetching pages:', error)
      
return NextResponse.json({ 
        error: 'Failed to fetch pages',
        pages: [] 
      }, { status: 500 })
    }

    return NextResponse.json({ pages })
  } catch (error) {
    console.error('Error in pages GET:', error)
    
return NextResponse.json({ 
      error: 'Internal server error',
      pages: [] 
    }, { status: 500 })
  }
}
