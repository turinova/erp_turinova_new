import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'

export async function GET(req: NextRequest) {
  try {
    // Get token from cookie
    const token = req.cookies.get('pda_token')?.value
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify JWT token
    const secret = new TextEncoder().encode(process.env.PDA_JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    
    const workerId = payload.workerId as string | null
    
    if (!workerId) {
      return NextResponse.json(
        { color: '#1976d2' }, // Default color
        { status: 200 }
      )
    }

    // Create Supabase client
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Fetch worker color
    const { data: worker, error } = await supabaseAdmin
      .from('workers')
      .select('color')
      .eq('id', workerId)
      .is('deleted_at', null)
      .single()

    if (error || !worker) {
      return NextResponse.json(
        { color: '#1976d2' }, // Default color if worker not found
        { status: 200 }
      )
    }

    return NextResponse.json({
      color: worker.color || '#1976d2'
    })

  } catch (error) {
    console.error('Error fetching worker color:', error)
    return NextResponse.json(
      { color: '#1976d2' }, // Default color on error
      { status: 200 }
    )
  }
}

