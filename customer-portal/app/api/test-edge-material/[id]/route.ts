import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client with service role key
function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase not configured for test-edge-material API')
    return null
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServerClient()
    
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }

    const { id } = await params

    console.log('=== TESTING EDGE MATERIAL EXISTENCE ===')
    console.log('Testing ID:', id)
    
    console.log('Using server-side supabase client')
    
    // First, check if the record exists at all (including deleted ones)
    const { data: allRecords, error: allError } = await supabase
      .from('edge_materials')
      .select('id, deleted_at')
      .eq('id', id)
    
    console.log('All records query result:', allRecords)
    console.log('All records query error:', allError)
    
    // Then check if it exists and is not deleted
    const { data: activeRecord, error: activeError } = await supabase
      .from('edge_materials')
      .select('id, deleted_at')
      .eq('id', id)
      .is('deleted_at', null)
    
    console.log('Active record query result:', activeRecord)
    console.log('Active record query error:', activeError)
    
    // Check if the ID format is valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const isValidUUID = uuidRegex.test(id)
    
    return NextResponse.json({
      id,
      isValidUUID,
      existsInDatabase: allRecords && allRecords.length > 0,
      isActive: activeRecord && activeRecord.length > 0,
      allRecords,
      activeRecord,
      allError,
      activeError
    })
  } catch (error) {
    console.error('Test error:', error)
    
return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
