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
    const { host, port, secure, user: smtpUser, password, from_email, from_name, is_active } = body

    // Validation
    if (!host || !port || !smtpUser || !from_email || !from_name) {
      return NextResponse.json(
        { error: 'Minden mező kitöltése kötelező (jelszó kivételével)' },
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
      is_active: is_active ?? true
    }

    // Only update password if provided
    if (password && password.trim()) {
      // TODO: Implement password encryption
      updateData.password = password
    }

    // If setting as active, deactivate others first
    if (is_active) {
      await supabaseServer
        .from('smtp_settings')
        .update({ is_active: false })
        .neq('id', id)
        .is('deleted_at', null)
    }

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

