import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Get current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user_pins record for the user
    const { data, error } = await supabase
      .from('user_pins')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching user pin:', error)
      return NextResponse.json({ error: 'Failed to fetch user pin' }, { status: 500 })
    }

    return NextResponse.json(data || null)
  } catch (error) {
    console.error('Error in GET /api/user-pins/[userId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const body = await request.json()
    const { pin, worker_id, is_active } = body

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Get current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate PIN format (exactly 6 digits)
    if (!pin || !/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'A PIN pontosan 6 számjegyből kell álljon' },
        { status: 400 }
      )
    }

    // Check if PIN is already taken by another user
    const { data: existingPin, error: checkError } = await supabase
      .from('user_pins')
      .select('user_id')
      .eq('pin', pin)
      .neq('user_id', userId)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking PIN uniqueness:', checkError)
      return NextResponse.json({ error: 'Hiba a PIN ellenőrzése során' }, { status: 500 })
    }

    if (existingPin) {
      return NextResponse.json(
        { error: 'Ez a PIN már használatban van' },
        { status: 400 }
      )
    }

    // Validate worker_id if provided
    if (worker_id) {
      const { data: worker, error: workerError } = await supabase
        .from('workers')
        .select('id')
        .eq('id', worker_id)
        .is('deleted_at', null)
        .maybeSingle()

      if (workerError || !worker) {
        return NextResponse.json(
          { error: 'Érvénytelen dolgozó ID' },
          { status: 400 }
        )
      }
    }

    // Check if user_pins record exists
    const { data: existingRecord, error: fetchError } = await supabase
      .from('user_pins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing record:', fetchError)
      return NextResponse.json({ error: 'Hiba a rekord ellenőrzése során' }, { status: 500 })
    }

    let result
    if (existingRecord) {
      // Update existing record
      const { data, error } = await supabase
        .from('user_pins')
        .update({
          pin,
          worker_id: worker_id || null,
          is_active: is_active !== undefined ? is_active : true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('Error updating user pin:', error)
        return NextResponse.json({ error: 'Hiba a PIN frissítése során' }, { status: 500 })
      }

      result = data
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('user_pins')
        .insert({
          user_id: userId,
          pin,
          worker_id: worker_id || null,
          is_active: is_active !== undefined ? is_active : true
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating user pin:', error)
        return NextResponse.json({ error: 'Hiba a PIN létrehozása során' }, { status: 500 })
      }

      result = data
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in PUT /api/user-pins/[userId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

