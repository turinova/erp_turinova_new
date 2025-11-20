import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Temporary endpoint to test schema access
export async function GET() {
  try {
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
    
    // Try to query the table
    const { data, error } = await supabaseAdmin
      .from('user_pins')
      .select('*')
      .limit(1)
    
    if (error) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        hint: error.hint
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Schema is accessible',
      sampleData: data
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}

