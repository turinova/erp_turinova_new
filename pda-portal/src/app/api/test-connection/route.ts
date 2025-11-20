import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Test endpoint to verify Supabase connection and check if function exists
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({
        error: 'Missing environment variables',
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceKey
      }, { status: 500 })
    }
    
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // Test 1: Check if we can query users table (should work)
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .limit(1)
    
    // Test 2: Check if function exists by trying to call it
    const { data: functionTest, error: functionError } = await supabaseAdmin
      .rpc('lookup_user_pin', { pin_code: '123456' })
    
    // Test 3: Check if user_pins table exists (direct query)
    const { data: pinsTest, error: pinsError } = await supabaseAdmin
      .from('user_pins')
      .select('pin')
      .limit(1)
    
    return NextResponse.json({
      connection: {
        url: supabaseUrl.substring(0, 30) + '...',
        hasServiceKey: !!serviceKey
      },
      tests: {
        usersTable: {
          success: !usersError,
          error: usersError?.message,
          data: users ? `${users.length} user(s) found` : null
        },
        userPinsTable: {
          success: !pinsError,
          error: pinsError?.message,
          code: pinsError?.code
        },
        lookupFunction: {
          success: !functionError,
          error: functionError?.message,
          code: functionError?.code,
          data: functionTest
        }
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

