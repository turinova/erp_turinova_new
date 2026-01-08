import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * PUT /api/email-settings/[id]
 * Update SMTP settings
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    if (!host || !port || !smtpUser || !from_email || !from_name) {
      return NextResponse.json(
        { error: 'Minden mező kitöltése kötelező (jelszó kivételével)' },
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

    // Build update object
    const updateData: any = {
      host,
      port: parseInt(port),
      secure: secure ?? true,
      "user": smtpUser,
      from_email,
      from_name,
      signature_html: signature_html || null,
      is_active: is_active ?? true,
      imap_host: imap_host || host, // Default to SMTP host if not provided
      imap_port: parseInt(imap_port) || 993,
      imap_secure: imap_secure ?? true
    }

    // Only update password if provided
    if (password && password.trim()) {
      // TODO: Implement password encryption
      updateData.password = password
    }

    // Check for duplicate email address (excluding current record)
    if (from_email) {
      const { data: existing } = await supabaseServer
        .from('smtp_settings')
        .select('id')
        .eq('from_email', from_email.trim())
        .neq('id', id)
        .is('deleted_at', null)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: 'Ez az email cím már használatban van' },
          { status: 400 }
        )
      }
      updateData.from_email = from_email.trim()
    }

    // Note: Multiple accounts can be active simultaneously (removed auto-deactivation)

    const { data, error } = await supabaseServer
      .from('smtp_settings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating SMTP settings:', error)
      return NextResponse.json({ error: 'Hiba a beállítások frissítésekor' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error('Error in PUT /api/email-settings/[id]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/email-settings/[id]
 * Soft delete SMTP settings
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Soft delete by setting deleted_at
    const { data, error } = await supabaseServer
      .from('smtp_settings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error deleting SMTP settings:', error)
      return NextResponse.json({ error: 'Hiba a beállítások törlésekor' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('Error in DELETE /api/email-settings/[id]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

