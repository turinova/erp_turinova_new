import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * GET /api/email-settings
 * Get all SMTP settings (or active only if ?active=true)
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

    // Check if only active accounts are requested
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'

    let query = supabaseServer
      .from('smtp_settings')
      .select('id, host, port, secure, "user", from_email, from_name, signature_html, is_active, imap_host, imap_port, imap_secure, created_at, updated_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching SMTP settings:', error)
      return NextResponse.json({ error: 'Hiba a beállítások lekérdezésekor' }, { status: 500 })
    }

    // Always return array (for both active only and all accounts)
    return NextResponse.json(data || [])
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
    const { host, port, secure, user: smtpUser, password, from_email, from_name, signature_html, is_active, imap_host, imap_port, imap_secure } = body

    // Validation
    if (!host || !port || !smtpUser || !password || !from_email || !from_name) {
      return NextResponse.json(
        { error: 'Minden mező kitöltése kötelező' },
        { status: 400 }
      )
    }

    // IMAP validation (required)
    if (!imap_host || !imap_port) {
      return NextResponse.json(
        { error: 'IMAP beállítások kötelezőek' },
        { status: 400 }
      )
    }

    // Check for duplicate email address
    const { data: existing } = await supabaseServer
      .from('smtp_settings')
      .select('id')
      .eq('from_email', from_email.trim())
      .is('deleted_at', null)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Ez az email cím már használatban van' },
        { status: 400 }
      )
    }

    // Encrypt password (for now, store as-is, but should be encrypted in production)
    // TODO: Implement password encryption
    const encryptedPassword = password

    // Note: Multiple accounts can be active simultaneously (removed auto-deactivation)

    const { data, error } = await supabaseServer
      .from('smtp_settings')
      .insert({
        host,
        port: parseInt(port),
        secure: secure ?? true,
        "user": smtpUser,
        password: encryptedPassword,
        from_email: from_email.trim(),
        from_name,
        signature_html: signature_html || null,
        is_active: is_active ?? true,
        imap_host: imap_host || host, // Default to SMTP host if not provided
        imap_port: parseInt(imap_port) || 993,
        imap_secure: imap_secure ?? true
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

