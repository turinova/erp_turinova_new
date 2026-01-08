import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { sendEmail } from '@/lib/email'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * POST /api/email/send
 * Send email using SMTP settings from database
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
    const { to, subject, html, po_id, smtp_setting_id } = body

    // Validation
    if (!to || !to.trim()) {
      return NextResponse.json(
        { error: 'Címzett email cím kötelező' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to.trim())) {
      return NextResponse.json(
        { error: 'Érvényes email cím szükséges' },
        { status: 400 }
      )
    }

    if (!subject || !subject.trim()) {
      return NextResponse.json(
        { error: 'Tárgy kötelező' },
        { status: 400 }
      )
    }

    if (!html || !html.trim()) {
      return NextResponse.json(
        { error: 'Email tartalom kötelező' },
        { status: 400 }
      )
    }

    // Send email (with optional smtp_setting_id for account selection)
    const result = await sendEmail({
      to: to.trim(),
      subject: subject.trim(),
      html: html.trim(),
      smtpSettingId: smtp_setting_id,
    })

    // Update purchase order email tracking if po_id is provided
    if (po_id && result.success) {
      await supabaseServer
        .from('purchase_orders')
        .update({
          email_sent: true,
          email_sent_at: new Date().toISOString()
        })
        .eq('id', po_id)
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: error.message || 'Hiba az email küldésekor' },
      { status: 500 }
    )
  }
}

