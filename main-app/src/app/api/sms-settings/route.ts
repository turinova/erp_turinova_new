import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * GET /api/sms-settings
 * Fetch all SMS templates
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
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all SMS templates
    const { data, error } = await supabase
      .from('sms_settings')
      .select('*')
      .order('template_name', { ascending: true })

    if (error) {
      console.error('Error fetching SMS settings:', error)
      return NextResponse.json({ error: 'Failed to fetch SMS settings', details: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error in GET /api/sms-settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/sms-settings
 * Update SMS message template for a specific template ID
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, message_template } = body

    // Validation
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }

    if (!message_template || typeof message_template !== 'string' || !message_template.trim()) {
      return NextResponse.json({ error: 'Message template is required' }, { status: 400 })
    }

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
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update SMS settings for specific template
    const { data, error } = await supabase
      .from('sms_settings')
      .update({
        message_template: message_template.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating SMS settings:', error)
      return NextResponse.json({ error: 'Failed to update SMS settings', details: error.message }, { status: 500 })
    }

    console.log('[SMS Settings] Template updated successfully')
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PATCH /api/sms-settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

