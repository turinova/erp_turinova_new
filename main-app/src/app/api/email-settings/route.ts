import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * GET /api/email-settings
 * Get active SMTP settings
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value, ...options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabaseServer
      .from('smtp_settings')
      .select('id, host, port, secure, "user", from_email, from_name, is_active, created_at, updated_at')
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      console.error('Error fetching SMTP settings:', error)
      return NextResponse.json({ error: 'Hiba a beállítások lekérdezésekor' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error('Error in GET /api/email-settings', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/email-settings
 * Create new SMTP settings
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value, ...options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { host, port, secure, user: smtpUser, password, from_email, from_name, is_active } = body

    // Validation
    if (!host || !port || !smtpUser || !password || !from_email || !from_name) {
      return NextResponse.json(
        { error: 'Minden mező kitöltése kötelező' },
        { status: 400 }
      )
    }

    // Encrypt password (for now, store as-is, but should be encrypted in production)
    // TODO: Implement password encryption
    const encryptedPassword = password

    // If setting as active, deactivate others first
    if (is_active) {
      await supabaseServer
        .from('smtp_settings')
        .update({ is_active: false })
        .is('deleted_at', null)
    }

    const { data, error } = await supabaseServer
      .from('smtp_settings')
      .insert({
        host,
        port: parseInt(port),
        secure: secure ?? true,
        "user": smtpUser,
        password: encryptedPassword,
        from_email,
        from_name,
        is_active: is_active ?? true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating SMTP settings:', error)
      return NextResponse.json({ error: 'Hiba a beállítások mentésekor' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error('Error in POST /api/email-settings', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

